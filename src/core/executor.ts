import { type ChildProcess, spawn } from "node:child_process";
import { updateJobStatus } from "../db/jobs.js";
import { createRun, pruneRuns, updateRun } from "../db/runs.js";
import type { Job, TriggerType } from "../types/index.js";
import { detectOS } from "./detector.js";
import {
	type JobStatusChangeEvent,
	type RunCompleteEvent,
	type RunOutputEvent,
	eventBus,
} from "./events.js";
import { getNextRunTime } from "./parser.js";

const MAX_BUFFER_SIZE = 1024 * 1024;
const maxKeep = Number(process.env.CRONPULSE_LOG_RETENTION || "50");

const activeProcesses = new Map<string, { child: ChildProcess; jobId: string }>();

function stripLeadingSleep(command: string): string {
	return command.replace(/^sleep\s+\d+\s*&&\s*/i, "");
}

/**
 * Wrap a Windows command so paths with spaces are quoted for PowerShell.
 * Detects .exe/.cmd/.bat/.ps1 paths containing spaces and uses & "path" syntax.
 */
function wrapWindowsCommand(command: string): string {
	// Match an executable path at the start (with or without extension)
	const match = command.match(/^(.+?\.\w{2,4})\s*(.*)/);
	if (match) {
		const exe = match[1].trim();
		const args = match[2].trim();
		if (exe.includes(" ") && !exe.startsWith('"') && !exe.startsWith("&")) {
			return args ? `& "${exe}" ${args}` : `& "${exe}"`;
		}
	}
	return command;
}

export function executeJob(job: Job, trigger: TriggerType, skipSleep = false): string {
	const runId = createRun(job.id, trigger);
	const startTime = Date.now();

	updateJobStatus(job.id, { status: "running" });
	eventBus.emit("job:status-change", {
		jobId: job.id,
		status: "running",
	} satisfies JobStatusChangeEvent);

	let command = skipSleep ? stripLeadingSleep(job.command) : job.command;
	let stdoutBuffer = "";
	let stderrBuffer = "";

	const isWin = detectOS() === "win32";

	// On Windows, wrap executable paths containing spaces with quotes
	// e.g. C:\Program Files\app.exe arg1 → & "C:\Program Files\app.exe" arg1
	if (isWin) {
		command = wrapWindowsCommand(command);
	}

	const child = spawn(command, [], {
		shell: isWin ? "powershell.exe" : true,
		stdio: "pipe",
		detached: !isWin,
		windowsHide: true,
		env: { ...process.env, PYTHONUNBUFFERED: "1" },
	});

	activeProcesses.set(runId, { child, jobId: job.id });

	child.stdout.on("data", (chunk: Buffer) => {
		const data = chunk.toString();
		if (stdoutBuffer.length < MAX_BUFFER_SIZE) {
			stdoutBuffer += data.slice(0, MAX_BUFFER_SIZE - stdoutBuffer.length);
		}
		eventBus.emit("run:output", {
			runId,
			jobId: job.id,
			stream: "stdout",
			data,
		} satisfies RunOutputEvent);
	});

	child.stderr.on("data", (chunk: Buffer) => {
		const data = chunk.toString();
		if (stderrBuffer.length < MAX_BUFFER_SIZE) {
			stderrBuffer += data.slice(0, MAX_BUFFER_SIZE - stderrBuffer.length);
		}
		eventBus.emit("run:output", {
			runId,
			jobId: job.id,
			stream: "stderr",
			data,
		} satisfies RunOutputEvent);
	});

	function finalizeRun(exitCode: number) {
		activeProcesses.delete(runId);

		const durationMs = Date.now() - startTime;
		const status = exitCode === 0 ? "succeeded" : "failed";
		const finishedAt = new Date().toISOString();

		updateRun(runId, {
			finishedAt,
			durationMs,
			exitCode,
			stdout: stdoutBuffer,
			stderr: stderrBuffer,
			status,
		});

		const nextRunAt = getNextRunTime(job.scheduleExpression);
		updateJobStatus(job.id, {
			status,
			lastRunAt: finishedAt,
			lastDurationMs: durationMs,
			nextRunAt: nextRunAt?.toISOString(),
		});

		eventBus.emit("run:complete", {
			runId,
			jobId: job.id,
			exitCode,
			status,
		} satisfies RunCompleteEvent);

		eventBus.emit("job:status-change", {
			jobId: job.id,
			status,
		} satisfies JobStatusChangeEvent);

		pruneRuns(job.id, maxKeep);
	}

	child.on("close", (exitCode) => finalizeRun(exitCode ?? 1));

	child.on("error", (err) => {
		stderrBuffer += `\nProcess error: ${err.message}`;
		finalizeRun(1);
	});

	return runId;
}

function killProcessGroup(pid: number, signal: NodeJS.Signals) {
	try {
		process.kill(-pid, signal);
	} catch {
		try {
			process.kill(pid, signal);
		} catch {
			// already dead
		}
	}
}

export function stopRun(runId: string): boolean {
	const entry = activeProcesses.get(runId);
	if (!entry || !entry.child.pid) return false;
	killProcessGroup(entry.child.pid, "SIGTERM");
	const pid = entry.child.pid;
	setTimeout(() => {
		if (activeProcesses.has(runId)) {
			killProcessGroup(pid, "SIGKILL");
		}
	}, 5000);
	return true;
}

export function stopJobRuns(jobId: string): number {
	let stopped = 0;
	for (const [runId, entry] of activeProcesses) {
		if (entry.jobId === jobId) {
			stopRun(runId);
			stopped++;
		}
	}
	return stopped;
}
