import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import type { RawCronEntry } from "../types/index.js";
import { readHostCrontabs } from "./docker.js";

export function detectOS(): "linux" | "darwin" | "win32" {
	const os = platform();
	if (os === "linux" || os === "darwin" || os === "win32") return os;
	return "linux";
}

let _isDocker: boolean | null = null;
export function isDocker(): boolean {
	if (_isDocker !== null) return _isDocker;
	_isDocker =
		process.env.CRONPULSE_DOCKER === "true" || existsSync("/.dockerenv");
	return _isDocker;
}

export function readCrontab(): RawCronEntry[] {
	if (isDocker()) {
		const path = process.env.CRONPULSE_CRONTAB_PATH || "/host-crontabs";
		return readHostCrontabs(path);
	}

	const os = detectOS();
	if (os === "win32") {
		return readSchtasks();
	}
	return readUnixCrontab();
}

function readUnixCrontab(): RawCronEntry[] {
	const entries: RawCronEntry[] = [];

	// User crontab
	try {
		const output = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
		entries.push(...parseCrontabOutput(output, "crontab"));
	} catch {
		// No crontab for user
	}

	// System cron directories
	const cronDirs = ["/etc/cron.d"];
	for (const dir of cronDirs) {
		try {
			if (!existsSync(dir)) continue;
			const files = readdirSync(dir);
			for (const file of files) {
				if (file.startsWith(".")) continue;
				try {
					const content = readFileSync(join(dir, file), "utf-8");
					entries.push(...parseCrontabOutput(content, "cron.d"));
				} catch {
					// Permission denied or other read error
				}
			}
		} catch {
			// Permission denied
		}
	}

	return entries;
}

export function parseCrontabOutput(
	output: string,
	source: "crontab" | "cron.d",
): RawCronEntry[] {
	const entries: RawCronEntry[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines, comments, and variable assignments
		if (!trimmed || trimmed.startsWith("#") || trimmed.includes("=")) continue;

		// Match @reboot/@daily/etc. or standard 5-field cron expression
		const specialMatch = trimmed.match(
			/^(@(?:reboot|yearly|annually|monthly|weekly|daily|hourly|midnight))\s+(.+)$/i,
		);
		const standardMatch = trimmed.match(
			/^((?:\S+\s+){4}\S+)\s+(.+)$/,
		);

		const match = specialMatch || standardMatch;
		if (!match) continue;

		const schedule = match[1].trim();
		let command = match[2].trim();
		let name: string | undefined;

		// If source is cron.d, first field after schedule might be username
		if (source === "cron.d") {
			const parts = command.split(/\s+/);
			if (parts.length > 1) {
				// Skip the username field
				command = parts.slice(1).join(" ");
			}
		}

		// Extract name from inline comment at end of command
		const commentMatch = command.match(/^(.+?)\s+#\s*(.+)$/);
		if (commentMatch) {
			command = commentMatch[1].trim();
			name = commentMatch[2].trim();
		}

		// Generate a name from the command if none
		if (!name) {
			name = generateNameFromCommand(command);
		}

		entries.push({ schedule, command, name, source });
	}

	return entries;
}

const SHELL_BUILTINS = new Set([
	"[", "[[", "test", "cd", "echo", "sleep", "if", "then", "else", "fi",
	"for", "do", "done", "while", "case", "esac", "true", "false", "exec",
	"eval", "export", "source", ".", "set", "unset", "shift",
]);

function generateNameFromCommand(command: string): string {
	const tokens = command.split(/[\s|;&]+/).filter(Boolean);

	// Find the first meaningful token (skip shell builtins, flags, paths-only)
	for (const token of tokens) {
		if (token.startsWith("-") || token.startsWith("$")) continue;
		if (/^\d+$/.test(token)) continue;
		if (token.startsWith(">") || token === "&&" || token === "||") continue;
		const base = token.replace(/^.*\//, "").replace(/\.\w+$/, "");
		if (!base || SHELL_BUILTINS.has(base)) continue;
		if (base.length > 30) return `${base.slice(0, 27)}...`;
		return base;
	}

	// Fallback: truncate the command
	const fallback = command.slice(0, 30).replace(/\s+/g, "-");
	return fallback || "unnamed";
}

function readSchtasks(): RawCronEntry[] {
	const entries: RawCronEntry[] = [];

	try {
		const output = execSync('schtasks /Query /FO CSV /V', {
			encoding: "utf-8",
		});

		const lines = output.split("\n").filter((l) => l.trim());
		if (lines.length < 2) return entries;

		// Parse CSV header
		const headers = parseCSVLine(lines[0]);
		const taskNameIdx = headers.indexOf('"TaskName"');
		const scheduleTypeIdx = headers.indexOf('"Schedule Type"');
		const commandIdx = headers.findIndex((h) =>
			h.includes("Task To Run"),
		);

		for (let i = 1; i < lines.length; i++) {
			const fields = parseCSVLine(lines[i]);
			if (fields.length <= Math.max(taskNameIdx, commandIdx)) continue;

			const taskName = fields[taskNameIdx]?.replace(/"/g, "") || "";
			const command = fields[commandIdx]?.replace(/"/g, "") || "";
			const scheduleType = fields[scheduleTypeIdx]?.replace(/"/g, "") || "";

			// Skip system tasks
			if (taskName.startsWith("\\Microsoft\\")) continue;
			if (!command || command === "N/A") continue;

			entries.push({
				schedule: scheduleType,
				command,
				name: taskName.replace(/^\\/, ""),
				source: "schtasks",
			});
		}
	} catch {
		// schtasks not available
	}

	return entries;
}

function parseCSVLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;

	for (const char of line) {
		if (char === '"') {
			inQuotes = !inQuotes;
			current += char;
		} else if (char === "," && !inQuotes) {
			fields.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	if (current.trim()) fields.push(current.trim());
	return fields;
}
