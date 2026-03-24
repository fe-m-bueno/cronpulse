import { type ChildProcess, spawn } from "node:child_process";
import { updateJobStatus } from "../db/jobs.js";
import { createRun, pruneRuns, updateRun } from "../db/runs.js";
import type { Job, TriggerType } from "../types/index.js";
import { detectOS } from "./detector.js";
import { getNextRunTime } from "./parser.js";
import {
	eventBus,
	type RunOutputEvent,
	type RunCompleteEvent,
	type JobStatusChangeEvent,
} from "./events.js";

const MAX_BUFFER_SIZE = 1024 * 1024;
const maxKeep = Number(process.env.CRONPULSE_LOG_RETENTION || "50");

const activeProcesses = new Map<string, { child: ChildProcess; jobId: string }>();

function stripLeadingSleep(command: string): string {
	return command.replace(/^sleep\s+\d+\s*&&\s*/i, "");
}

export function executeJob(job: Job, trigger: TriggerType, skipSleep = false): string {
	const runId = createRun(job.id, trigger);
	const startTime = Date.now();

	updateJobStatus(job.id, { status: "running" });
	eventBus.emit("job:status-change", {
		jobId: job.id,
		status: "running",
	} satisfies JobStatusChangeEvent);

	const command = skipSleep ? stripLeadingSleep(job.command) : job.command;
	let stdoutBuffer = "";
	let stderrBuffer = "";

	const isWin = detectOS() === "win32";
	const child = spawn(command, [], {
		shell: isWin ? "cmd.exe" : true,
		stdio: "pipe",
		detached: !isWin,
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
