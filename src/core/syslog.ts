import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectOS } from "./detector.js";

const execFileAsync = promisify(execFile);

export interface CronLogEntry {
	timestamp: Date;
	user: string;
	command: string;
	/** On Windows, this holds the task name from Event Log (used for matching instead of command) */
	taskName?: string;
}

export async function getRecentCronRuns(sinceMinutesAgo: number): Promise<CronLogEntry[]> {
	const os = detectOS();
	if (os === "win32") return getWindowsRecentRuns(sinceMinutesAgo);

	try {
		const since = `${sinceMinutesAgo} minutes ago`;
		const { stdout } = await execFileAsync(
			"journalctl",
			["-t", "CRON", "--since", since, "--no-pager", "-q"],
			{ timeout: 5000 },
		);

		return parseJournalctlOutput(stdout);
	} catch {
		// journalctl not available or no permissions — try syslog
		return parseSyslog(sinceMinutesAgo);
	}
}

function parseJournalctlOutput(output: string): CronLogEntry[] {
	const entries: CronLogEntry[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		// Match lines like: mar 24 17:00:01 pop-os CRON[468337]: (felipebueno) CMD (cd /home/...)
		const match = line.match(
			/^(\w+\s+\d+\s+\d+:\d+:\d+)\s+\S+\s+CRON\[\d+\]:\s+\((\w+)\)\s+CMD\s+\((.+)\)$/,
		);
		if (!match) continue;

		const [, dateStr, user, command] = match;
		const timestamp = parseJournalDate(dateStr);
		if (timestamp) {
			entries.push({ timestamp, user, command: command.trim() });
		}
	}

	return entries;
}

const MONTHS: Record<string, number> = {
	jan: 0,
	fev: 1,
	feb: 1,
	mar: 2,
	abr: 3,
	apr: 3,
	mai: 4,
	may: 4,
	jun: 5,
	jul: 6,
	ago: 7,
	aug: 7,
	set: 8,
	sep: 8,
	out: 9,
	oct: 9,
	nov: 10,
	dez: 11,
	dec: 11,
};

function parseJournalDate(dateStr: string): Date | null {
	// journalctl outputs local time: "mar 24 17:00:01"
	const parts = dateStr.match(/(\w+)\s+(\d+)\s+(\d+):(\d+):(\d+)/);
	if (!parts) return null;
	const month = MONTHS[parts[1].toLowerCase()];
	if (month === undefined) return null;
	// new Date(y, m, d, h, m, s) creates in LOCAL timezone — correct
	return new Date(
		new Date().getFullYear(),
		month,
		Number(parts[2]),
		Number(parts[3]),
		Number(parts[4]),
		Number(parts[5]),
	);
}

async function parseSyslog(sinceMinutesAgo: number): Promise<CronLogEntry[]> {
	try {
		const { stdout } = await execFileAsync("grep", ["CRON", "/var/log/syslog"], { timeout: 5000 });

		const cutoff = new Date(Date.now() - sinceMinutesAgo * 60_000);
		return parseJournalctlOutput(stdout).filter((e) => e.timestamp >= cutoff);
	} catch {
		return [];
	}
}

async function getWindowsRecentRuns(sinceMinutesAgo: number): Promise<CronLogEntry[]> {
	try {
		const { stdout } = await execFileAsync(
			"powershell",
			[
				"-NoProfile",
				"-Command",
				`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TaskScheduler/Operational'; Id=102; StartTime=(Get-Date).AddMinutes(-${sinceMinutesAgo})} -ErrorAction SilentlyContinue | Select-Object TimeCreated, Message | ConvertTo-Json`,
			],
			{ timeout: 10000, windowsHide: true },
		);

		if (!stdout.trim()) return [];

		const events = JSON.parse(stdout);
		const items = Array.isArray(events) ? events : [events];
		const cutoff = new Date(Date.now() - sinceMinutesAgo * 60_000);

		return items
			.map((e: { TimeCreated: string; Message: string }) => {
				const taskMatch = e.Message?.match(/Task .+?"(.+?)"/);
				const taskPath = taskMatch?.[1] || e.Message || "";
				return {
					timestamp: new Date(e.TimeCreated),
					user: "SYSTEM",
					command: taskPath,
					taskName: taskPath,
				};
			})
			.filter((e: CronLogEntry) => e.timestamp >= cutoff);
	} catch {
		return [];
	}
}

/**
 * Check if a specific command was executed by cron around a given time.
 * Uses fuzzy matching — checks if the cron log command contains the job command
 * or vice versa (cron logs may truncate or wrap commands differently).
 */
export function commandMatchesCronLog(jobCommand: string, cronLogCommand: string): boolean {
	const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

	const a = normalize(jobCommand);
	const b = normalize(cronLogCommand);

	// Exact match
	if (a === b) return true;

	// One contains the other (cron logs may include or omit shell wrappers)
	if (a.includes(b) || b.includes(a)) return true;

	// Match by significant substring — first 80 chars of the actual command
	const sig = a.slice(0, 80);
	return b.includes(sig);
}
