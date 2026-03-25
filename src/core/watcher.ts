import { randomUUID } from "node:crypto";
import { getAllJobs, updateJobStatus } from "../db/jobs.js";
import { getDb } from "../db/index.js";
import { eventBus } from "./events.js";
import { getNextRunTime } from "./parser.js";
import { scanCrontabIfChanged } from "./scanner.js";
import { getRecentCronRuns, commandMatchesCronLog } from "./syslog.js";
import type { Job } from "../types/index.js";

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
		const matchingLogs = cronLogs
			.filter((log) => commandMatchesCronLog(job.command, log.command))
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
				db.prepare(
					`INSERT INTO runs (id, job_id, trigger_type, status, started_at, finished_at)
					 VALUES (?, ?, 'scheduled', 'succeeded', ?, ?)`,
				).run(runId, job.id, logTime, logTime);
			}
		}

		// Update lastRunAt from the most recent log
		const latestLog = matchingLogs[matchingLogs.length - 1];
		if (latestLog) {
			const logTime = latestLog.timestamp.toISOString();
			if (!job.lastRunAt || logTime > job.lastRunAt) {
				updateJobStatus(job.id, {
					status: "succeeded",
					lastRunAt: logTime,
				});
				if (job.status !== "succeeded") {
					eventBus.emit("job:status-change", { jobId: job.id, status: "succeeded" });
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
					.prepare(
						"SELECT id FROM runs WHERE job_id = ? AND started_at >= ? LIMIT 1",
					)
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
