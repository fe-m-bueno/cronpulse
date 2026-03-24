import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let db: Database.Database | null = null;

function getDataDir(): string {
	const dir = process.env.CRONPULSE_DATA_DIR || join(homedir(), ".cronpulse");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

export function getDb(): Database.Database {
	if (db) return db;

	const dbPath = join(getDataDir(), "data.db");
	db = new Database(dbPath);

	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	runMigrations(db);

	return db;
}

function runMigrations(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			schedule_expression TEXT NOT NULL,
			schedule_human TEXT NOT NULL DEFAULT '',
			command TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'crontab',
			status TEXT NOT NULL DEFAULT 'idle',
			last_run_at TEXT,
			last_duration_ms INTEGER,
			next_run_at TEXT,
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS runs (
			id TEXT PRIMARY KEY,
			job_id TEXT NOT NULL,
			started_at TEXT NOT NULL DEFAULT (datetime('now')),
			finished_at TEXT,
			duration_ms INTEGER,
			exit_code INTEGER,
			stdout TEXT NOT NULL DEFAULT '',
			stderr TEXT NOT NULL DEFAULT '',
			trigger_type TEXT NOT NULL DEFAULT 'manual',
			status TEXT NOT NULL DEFAULT 'running',
			FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
		CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);

		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);
}

export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}
