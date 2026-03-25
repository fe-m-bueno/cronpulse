import { randomUUID } from "node:crypto";
import { getDb } from "../db/index.js";
import { getAllJobs, updateJobStatus } from "../db/jobs.js";
import type { Job } from "../types/index.js";
import { eventBus } from "./events.js";
import { getNextRunTime } from "./parser.js";
import { scanCrontabIfChanged } from "./scanner.js";
import { commandMatchesCronLog, getRecentCronRuns } from "./syslog.js";
import type { CronLogEntry } from "./syslog.js";

let scanInterval: ReturnType<typeof setInterval> | null = null;
let statusInterval: ReturnType<typeof setInterval> | null = null;

export function startWatcher(): void {
	// Run an immediate check on startup
	checkJobs().catch((err) => console.error("Watcher initial check error:", err));

	scanInterval = setInterval(() => {
		try {
			scanCrontabIfChanged();
		} catch (err) {
			console.error("Watcher scan error:", err);
		}
	}, 30_000);

	statusInterval = setInterval(async () => {
		try {
			await checkJobs();
		} catch (err) {
			console.error("Watcher status check error:", err);
		}
	}, 10_000);
}

export function stopWatcher(): void {
	if (scanInterval) {
		clearInterval(scanInterval);
		scanInterval = null;
	}
	if (statusInterval) {
		clearInterval(statusInterval);
		statusInterval = null;
	}
}

async function checkJobs(): Promise<void> {
	const jobs = getAllJobs();
	const now = Date.now();
	const db = getDb();

	const cronLogs = await getRecentCronRuns(1440);

	for (const job of jobs) {
		if (!job.enabled || job.status === "running") continue;

		// Find ALL matching system log entries for this job
		// On Windows (schtasks), match by task name; on Linux/Mac, match by command
		const matchingLogs = cronLogs
			.filter((log) => matchJobToLog(job, log))
			.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		// Record any system runs we haven't seen yet
		for (const log of matchingLogs) {
			const logTime = log.timestamp.toISOString();

			// Check if we already have a run recorded around this time (±2 min)
			const existing = db
				.prepare(
					`SELECT id FROM runs WHERE job_id = ?
					 AND started_at BETWEEN ? AND ?
					 LIMIT 1`,
				)
				.get(
					job.id,
					new Date(log.timestamp.getTime() - 120_000).toISOString(),
					new Date(log.timestamp.getTime() + 120_000).toISOString(),
				);

			if (!existing) {
				// Create a run entry for this system execution
				const runId = randomUUID();
				const runStatus = log.exitCode != null && log.exitCode !== 0 ? "failed" : "succeeded";
				db.prepare(
					`INSERT INTO runs (id, job_id, trigger_type, status, exit_code, started_at, finished_at)
					 VALUES (?, ?, 'scheduled', ?, ?, ?, ?)`,
				).run(runId, job.id, runStatus, log.exitCode ?? null, logTime, logTime);
			}
		}

		// Update lastRunAt from the most recent log
		const latestLog = matchingLogs[matchingLogs.length - 1];
		if (latestLog) {
			const logTime = latestLog.timestamp.toISOString();
			if (!job.lastRunAt || logTime > job.lastRunAt) {
				const newStatus =
					latestLog.exitCode != null && latestLog.exitCode !== 0 ? "failed" : "succeeded";
				updateJobStatus(job.id, {
					status: newStatus,
					lastRunAt: logTime,
				});
				if (job.status !== newStatus) {
					eventBus.emit("job:status-change", { jobId: job.id, status: newStatus });
				}
			}
		}

		// Handle overdue detection (only for periodic jobs, not @reboot)
		const isReboot = job.scheduleExpression.startsWith("@reboot");
		if (!isReboot && job.nextRunAt) {
			const nextRun = new Date(job.nextRunAt).getTime();
			const isPastDue = now > nextRun;

			if (isPastDue) {
				// Check if it ran since the expected time
				const ranSinceExpected = matchingLogs.some(
					(log) => log.timestamp.getTime() >= nextRun - 60_000,
				);

				const cronpulseRun = db
					.prepare("SELECT id FROM runs WHERE job_id = ? AND started_at >= ? LIMIT 1")
					.get(job.id, new Date(nextRun - 60_000).toISOString());

				if (!ranSinceExpected && !cronpulseRun && job.status !== "overdue") {
					updateJobStatus(job.id, { status: "overdue" });
					eventBus.emit("job:status-change", { jobId: job.id, status: "overdue" });
				}
			}

			// Advance nextRunAt
			const nextNextRun = getNextRunTime(job.scheduleExpression);
			if (nextNextRun) {
				updateJobStatus(job.id, { nextRunAt: nextNextRun.toISOString() });
			}
		}
	}
}

/**
 * Match a job to a log entry. On Windows, Event Log entries contain the task name
 * (e.g. "\MyBackup"), not the command. So we match against job.name for schtasks jobs.
 */
function matchJobToLog(job: Job, log: CronLogEntry): boolean {
	if (log.taskName && job.source === "schtasks") {
		// Windows: match task name from Event Log against job name
		const normalize = (s: string) => s.replace(/^\\+/, "").toLowerCase().trim();
		return normalize(job.name) === normalize(log.taskName);
	}
	return commandMatchesCronLog(job.command, log.command);
}
