import { execFile } from "node:child_process";
import { closeSync, openSync, readSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { detectOS } from "./detector.js";

const execFileAsync = promisify(execFile);

export interface CronLogEntry {
	timestamp: Date;
	user: string;
	command: string;
	/** On Windows, this holds the task name from schtasks (used for matching instead of command) */
	taskName?: string;
	/** Exit code from the task scheduler (Windows only) */
	exitCode?: number;
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
	// Use Get-ScheduledTaskInfo which reads from the Task Scheduler API directly,
	// not the Event Log (which is often disabled on Windows).
	// Write a temp .ps1 file to avoid all escaping/quoting issues with -Command.
	const psScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$cutoff = (Get-Date).AddMinutes(-${sinceMinutesAgo})
Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\\Microsoft\\*' -and $_.State -ne 'Disabled' } | ForEach-Object { $info = $_ | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue; if ($info -and $info.LastRunTime -and $info.LastRunTime -gt $cutoff) { [PSCustomObject]@{ TaskName = $_.TaskPath + $_.TaskName; LastRunTime = $info.LastRunTime.ToString('o'); LastResult = $info.LastTaskResult } } } | ConvertTo-Json
`;

	const psPath = join(tmpdir(), "cronpulse-schtasks.ps1");
	try {
		writeFileSync(psPath, psScript, "utf-8");

		const { stdout } = await execFileAsync(
			"powershell",
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath],
			{ timeout: 30000, windowsHide: true },
		);

		if (!stdout.trim()) return [];

		const parsed = JSON.parse(stdout);
		const items: { TaskName: string; LastRunTime: string; LastResult: number }[] = Array.isArray(
			parsed,
		)
			? parsed
			: [parsed];

		return items.map((e) => ({
			timestamp: new Date(e.LastRunTime),
			user: "SYSTEM",
			command: e.TaskName,
			taskName: e.TaskName,
			exitCode: e.LastResult,
		}));
	} catch (err) {
		console.error("Failed to get Windows scheduled task runs:", err);
		return [];
	} finally {
		try {
			unlinkSync(psPath);
		} catch {}
	}
}

/**
 * Extract log file path from a cron command.
 * Detects patterns like:
 *   - >> /path/to/file
 *   - >> /path/to/file 2>&1
 *   - 2>&1 | tee -a /path/to/file
 *   - | tee -a /path/to/file
 *   - > /path/to/file
 */
export function extractLogFilePath(command: string): string | null {
	// Match: | tee [-a] /path/to/file
	const teeMatch = command.match(/\|\s*tee\s+(?:-a\s+)?(\S+)\s*$/);
	if (teeMatch) return teeMatch[1];

	// Match: >> /path/to/file or > /path/to/file (with optional 2>&1 before or after)
	const redirectMatch = command.match(/>>?\s+(\S+?)(?:\s+2>&1)?\s*$/);
	if (redirectMatch) return redirectMatch[1];

	// Match: 2>&1 >> /path/to/file
	const redirect2Match = command.match(/2>&1\s+>>?\s+(\S+)\s*$/);
	if (redirect2Match) return redirect2Match[1];

	return null;
}

/**
 * Read the tail of a log file, returning at most `maxBytes` from the end.
 * Returns null if the file doesn't exist or can't be read.
 */
export function readLogTail(filePath: string, maxBytes = 64 * 1024): string | null {
	try {
		const stat = statSync(filePath);
		if (!stat.isFile()) return null;

		const size = stat.size;
		if (size === 0) return null;

		const buf = Buffer.alloc(Math.min(size, maxBytes));
		const fd = openSync(filePath, "r");
		try {
			readSync(fd, buf, 0, buf.length, Math.max(0, size - buf.length));
		} finally {
			closeSync(fd);
		}

		return buf.toString("utf-8");
	} catch {
		return null;
	}
}

/**
 * Read log content that was written around a specific timestamp.
 * Tries to extract the portion of the log file relevant to a specific run
 * by reading the tail and looking for timestamp-adjacent content.
 */
export function readLogForRun(
	command: string,
	_runTimestamp: Date,
	maxBytes = 32 * 1024,
): string | null {
	const logPath = extractLogFilePath(command);
	if (!logPath) return null;

	return readLogTail(logPath, maxBytes);
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
