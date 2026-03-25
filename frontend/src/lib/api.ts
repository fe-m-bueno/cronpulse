export interface Job {
	id: string;
	name: string;
	scheduleExpression: string;
	scheduleHuman: string;
	command: string;
	source: string;
	status: "idle" | "running" | "succeeded" | "failed" | "overdue";
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
	trigger: "scheduled" | "manual";
	status: "running" | "succeeded" | "failed";
}

export interface SystemInfo {
	os: string;
	uptime: number;
	crontabPath: string;
	jobCount: number;
	version: string;
	isDocker: boolean;
}

const BASE = "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...options,
	});
	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export const api = {
	fetchJobs: () => apiFetch<Job[]>("/api/jobs"),
	fetchJob: (id: string) => apiFetch<Job>(`/api/jobs/${id}`),
	triggerRun: (jobId: string, skipSleep = false) =>
		apiFetch<{ runId: string }>(`/api/jobs/${jobId}/run?skipSleep=${skipSleep}`, {
			method: "POST",
		}),
	fetchRuns: (jobId: string, limit = 20, offset = 0) =>
		apiFetch<Run[]>(`/api/jobs/${jobId}/runs?limit=${limit}&offset=${offset}`),
	fetchRun: (jobId: string, runId: string) => apiFetch<Run>(`/api/jobs/${jobId}/runs/${runId}`),
	fetchSystem: () => apiFetch<SystemInfo>("/api/system"),
	stopJob: (jobId: string) =>
		apiFetch<{ stopped: number }>(`/api/jobs/${jobId}/stop`, { method: "POST" }),
	triggerScan: () => apiFetch<{ scanned: number; jobs: Job[] }>("/api/scan", { method: "POST" }),
};
