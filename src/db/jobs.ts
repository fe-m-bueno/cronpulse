import type { Job, JobStatus } from "../types/index.js";
import { getDb } from "./index.js";

function rowToJob(row: Record<string, unknown>): Job {
	return {
		id: row.id as string,
		name: row.name as string,
		scheduleExpression: row.schedule_expression as string,
		scheduleHuman: row.schedule_human as string,
		command: row.command as string,
		source: row.source as Job["source"],
		status: row.status as JobStatus,
		lastRunAt: (row.last_run_at as string) || null,
		lastDurationMs: (row.last_duration_ms as number) ?? null,
		nextRunAt: (row.next_run_at as string) || null,
		enabled: Boolean(row.enabled),
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}

export function getAllJobs(): Job[] {
	const db = getDb();
	const rows = db.prepare("SELECT * FROM jobs ORDER BY name").all();
	return rows.map((row) => rowToJob(row as Record<string, unknown>));
}

export function getJobById(id: string): Job | undefined {
	const db = getDb();
	const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
	return row ? rowToJob(row as Record<string, unknown>) : undefined;
}

export function upsertJob(job: {
	id: string;
	name: string;
	scheduleExpression: string;
	scheduleHuman: string;
	command: string;
	source: Job["source"];
	nextRunAt: string | null;
}): void {
	const db = getDb();
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO jobs (id, name, schedule_expression, schedule_human, command, source, next_run_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			schedule_expression = excluded.schedule_expression,
			schedule_human = excluded.schedule_human,
			command = excluded.command,
			source = excluded.source,
			next_run_at = excluded.next_run_at,
			updated_at = excluded.updated_at`,
	).run(
		job.id,
		job.name,
		job.scheduleExpression,
		job.scheduleHuman,
		job.command,
		job.source,
		job.nextRunAt,
		now,
		now,
	);
}

export function updateJobStatus(
	id: string,
	updates: {
		status?: JobStatus;
		lastRunAt?: string;
		lastDurationMs?: number;
		nextRunAt?: string;
	},
): void {
	const db = getDb();
	const sets: string[] = ["updated_at = ?"];
	const values: unknown[] = [new Date().toISOString()];

	if (updates.status !== undefined) {
		sets.push("status = ?");
		values.push(updates.status);
	}
	if (updates.lastRunAt !== undefined) {
		sets.push("last_run_at = ?");
		values.push(updates.lastRunAt);
	}
	if (updates.lastDurationMs !== undefined) {
		sets.push("last_duration_ms = ?");
		values.push(updates.lastDurationMs);
	}
	if (updates.nextRunAt !== undefined) {
		sets.push("next_run_at = ?");
		values.push(updates.nextRunAt);
	}

	values.push(id);
	db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function resetOrphanedRunningJobs(): number {
	const db = getDb();
	const result = db.prepare(
		"UPDATE jobs SET status = 'idle', updated_at = ? WHERE status = 'running'",
	).run(new Date().toISOString());
	// Also mark any running runs as failed
	db.prepare(
		"UPDATE runs SET status = 'failed', finished_at = ?, exit_code = -1, stderr = 'Process lost (server restarted)' WHERE status = 'running'",
	).run(new Date().toISOString());
	return result.changes;
}

export function removeStaleJobs(activeIds: string[]): void {
	if (activeIds.length === 0) return;
	const db = getDb();
	const placeholders = activeIds.map(() => "?").join(",");
	db.prepare(`DELETE FROM jobs WHERE id NOT IN (${placeholders})`).run(...activeIds);
}
