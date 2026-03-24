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
	scanInterval = setInterval(() => {
		try {
			scanCrontabIfChanged();
		} catch (err) {
			console.error("Watcher scan error:", err);
		}
	}, 30_000);

	statusInterval = setInterval(async () => {
		try {
			await checkOverdueJobs();
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

async function checkOverdueJobs(): Promise<void> {
	const jobs = getAllJobs();
	const now = Date.now();
	const db = getDb();

	const cronLogs = await getRecentCronRuns(120);

	for (const job of jobs) {
		if (!job.enabled || job.status === "running" || !job.nextRunAt) continue;

		const nextRun = new Date(job.nextRunAt).getTime();
		const isPastDue = now > nextRun;
		const isOverdue = job.status === "overdue";

		// Skip jobs whose next run is still in the future (unless already overdue)
		if (!isPastDue && !isOverdue) continue;

		// Check 1: did CronPulse record a run? (manual "Run Now")
		const cronpulseRun = db
			.prepare(
				"SELECT started_at FROM runs WHERE job_id = ? AND started_at >= ? LIMIT 1",
			)
			.get(job.id, new Date(nextRun - 60_000).toISOString()) as { started_at: string } | undefined;

		// Check 2: did the system cron daemon run it? (journalctl/syslog)
		// Compare against the previous expected run, not the next one
		// (nextRunAt may already have been advanced by a prior check)
		const systemRan = cronLogs.some((log) =>
			commandMatchesCronLog(job.command, log.command),
		);

		const nextNextRun = getNextRunTime(job.scheduleExpression);
		const updates: { status?: Job["status"]; nextRunAt?: string } = {};

		if (cronpulseRun || systemRan) {
			// It ran — mark succeeded if currently idle/overdue
			if (job.status === "overdue" || job.status === "idle") {
				updates.status = "succeeded";
			}
		} else if (job.status !== "overdue") {
			updates.status = "overdue";
		}

		if (nextNextRun) {
			updates.nextRunAt = nextNextRun.toISOString();
		}

		if (Object.keys(updates).length > 0) {
			updateJobStatus(job.id, updates);
			if (updates.status) {
				eventBus.emit("job:status-change", { jobId: job.id, status: updates.status });
			}
		}
	}
}
