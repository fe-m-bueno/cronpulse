import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { RawCronEntry } from "../types/index.js";
import { parseCrontabOutput } from "./detector.js";

export function readHostCrontabs(basePath: string): RawCronEntry[] {
	const entries: RawCronEntry[] = [];
	const cronDPath = process.env.CRONPULSE_CRON_D_PATH || "/host-cron.d";
	const dirs: Array<{ path: string; source: "crontab" | "cron.d" }> = [
		{ path: basePath, source: "crontab" },
		{ path: cronDPath, source: "cron.d" },
	];

	for (const { path: dir, source } of dirs) {
		try {
			const files = readdirSync(dir);
			for (const file of files) {
				if (file.startsWith(".")) continue;
				try {
					const content = readFileSync(join(dir, file), "utf-8");
					entries.push(...parseCrontabOutput(content, source));
				} catch {
					// Skip unreadable files
				}
			}
		} catch {
			// Directory doesn't exist or permission denied
		}
	}

	return entries;
}
