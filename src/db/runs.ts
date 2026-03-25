import { randomUUID } from "node:crypto";
import type { Run, RunStatus, TriggerType } from "../types/index.js";
import { getDb } from "./index.js";

function rowToRun(row: Record<string, unknown>): Run {
	return {
		id: row.id as string,
		jobId: row.job_id as string,
		startedAt: row.started_at as string,
		finishedAt: (row.finished_at as string) || null,
		durationMs: (row.duration_ms as number) ?? null,
		exitCode: (row.exit_code as number) ?? null,
		stdout: (row.stdout as string) || "",
		stderr: (row.stderr as string) || "",
		trigger: row.trigger_type as TriggerType,
		status: row.status as RunStatus,
	};
}

export function createRun(jobId: string, trigger: TriggerType): string {
	const db = getDb();
	const id = randomUUID();
	db.prepare(
		`INSERT INTO runs (id, job_id, trigger_type, status, started_at)
		 VALUES (?, ?, ?, 'running', ?)`,
	).run(id, jobId, trigger, new Date().toISOString());
	return id;
}

export function updateRun(
	id: string,
	updates: {
		finishedAt?: string;
		durationMs?: number;
		exitCode?: number;
		stdout?: string;
		stderr?: string;
		status?: RunStatus;
	},
): void {
	const db = getDb();
	const sets: string[] = [];
	const values: unknown[] = [];

	if (updates.finishedAt !== undefined) {
		sets.push("finished_at = ?");
		values.push(updates.finishedAt);
	}
	if (updates.durationMs !== undefined) {
		sets.push("duration_ms = ?");
		values.push(updates.durationMs);
	}
	if (updates.exitCode !== undefined) {
		sets.push("exit_code = ?");
		values.push(updates.exitCode);
	}
	if (updates.stdout !== undefined) {
		sets.push("stdout = ?");
		values.push(updates.stdout);
	}
	if (updates.stderr !== undefined) {
		sets.push("stderr = ?");
		values.push(updates.stderr);
	}
	if (updates.status !== undefined) {
		sets.push("status = ?");
		values.push(updates.status);
	}

	if (sets.length === 0) return;

	values.push(id);
	db.prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getRunsByJobId(jobId: string, limit = 20, offset = 0): Run[] {
	const db = getDb();
	const rows = db
		.prepare("SELECT * FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?")
		.all(jobId, limit, offset);
	return rows.map((row) => rowToRun(row as Record<string, unknown>));
}

export function getRunById(runId: string): Run | undefined {
	const db = getDb();
	const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId);
	return row ? rowToRun(row as Record<string, unknown>) : undefined;
}

export function pruneRuns(jobId: string, maxKeep = 50): void {
	const db = getDb();
	db.prepare(
		`DELETE FROM runs WHERE job_id = ? AND id NOT IN (
			SELECT id FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?
		)`,
	).run(jobId, jobId, maxKeep);
}
