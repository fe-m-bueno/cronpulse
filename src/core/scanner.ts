import { readCrontab } from "./detector.js";
import { generateJobId, getNextRunTime, toHumanReadable } from "./parser.js";
import { getAllJobs, upsertJob, removeStaleJobs } from "../db/jobs.js";
import { eventBus } from "./events.js";

export function scanCrontab(): { scanned: number } {
	const entries = readCrontab();
	const activeIds: string[] = [];

	for (const entry of entries) {
		const id = generateJobId(entry.schedule, entry.command);
		const nextRun = getNextRunTime(entry.schedule);
		const humanSchedule = toHumanReadable(entry.schedule);

		upsertJob({
			id,
			name: entry.name || entry.command,
			scheduleExpression: entry.schedule,
			scheduleHuman: humanSchedule,
			command: entry.command,
			source: entry.source,
			nextRunAt: nextRun?.toISOString() || null,
		});

		activeIds.push(id);
	}

	if (activeIds.length > 0) {
		removeStaleJobs(activeIds);
	}

	return { scanned: entries.length };
}

let previousJobIds: string | null = null;

export function scanCrontabIfChanged(): boolean {
	const entries = readCrontab();
	const activeIds: string[] = [];

	for (const entry of entries) {
		activeIds.push(generateJobId(entry.schedule, entry.command));
	}

	const currentHash = activeIds.sort().join(",");
	if (currentHash === previousJobIds) {
		return false;
	}

	previousJobIds = currentHash;
	scanCrontab();

	const jobs = getAllJobs();
	eventBus.emit("jobs:updated", { jobCount: jobs.length });
	return true;
}
