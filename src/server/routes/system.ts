import { platform, uptime } from "node:os";
import { Hono } from "hono";
import { isDocker } from "../../core/detector.js";
import { scanCrontab } from "../../core/scanner.js";
import { getAllJobs } from "../../db/jobs.js";
import type { SystemInfo } from "../../types/index.js";

const system = new Hono();

system.get("/", (c) => {
	const jobs = getAllJobs();
	const info: SystemInfo = {
		os: platform(),
		uptime: uptime(),
		crontabPath: process.env.CRONPULSE_CRONTAB_PATH || "crontab -l",
		jobCount: jobs.length,
		version: "0.1.0",
		isDocker: isDocker(),
	};
	return c.json(info);
});

system.post("/scan", (c) => {
	const { scanned } = scanCrontab();
	const jobs = getAllJobs();
	return c.json({ scanned, jobs });
});

export { system as systemRouter };
