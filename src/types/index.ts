export type JobStatus = "idle" | "running" | "succeeded" | "failed" | "overdue";
export type RunStatus = "running" | "succeeded" | "failed";
export type TriggerType = "scheduled" | "manual";
export type JobSource = "crontab" | "schtasks" | "cron.d";

export interface Job {
	id: string;
	name: string;
	scheduleExpression: string;
	scheduleHuman: string;
	command: string;
	source: JobSource;
	status: JobStatus;
	lastRunAt: string | null;
	lastDurationMs: number | null;
	nextRunAt: string | null;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface Run {
	id: string;
	jobId: string;
	startedAt: string;
	finishedAt: string | null;
	durationMs: number | null;
	exitCode: number | null;
	stdout: string;
	stderr: string;
	trigger: TriggerType;
	status: RunStatus;
}

export interface RawCronEntry {
	schedule: string;
	command: string;
	name?: string;
	source: JobSource;
}

export interface SystemInfo {
	os: string;
	uptime: number;
	crontabPath: string;
	jobCount: number;
	version: string;
	isDocker: boolean;
}
