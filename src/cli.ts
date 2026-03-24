import { serve } from "@hono/node-server";
import { program } from "commander";
import { getDb, closeDb } from "./db/index.js";
import { getAllJobs, resetOrphanedRunningJobs } from "./db/jobs.js";
import { executeJob } from "./core/executor.js";
import { eventBus } from "./core/events.js";
import { startWatcher, stopWatcher } from "./core/watcher.js";
import { scanCrontab } from "./core/scanner.js";
import { createApp } from "./server/index.js";

program
	.name("cronpulse")
	.description("Local-first cron job monitoring dashboard")
	.version("0.1.0");

program
	.option("-p, --port <number>", "Server port", "7575")
	.option("-v, --verbose", "Verbose logging")
	.option("--no-open", "Don't open browser on startup")
	.action(async (opts) => {
		const port = Number(opts.port);

		getDb();
		resetOrphanedRunningJobs();
		scanCrontab();
		startWatcher();

		const app = createApp();

		console.log(`\n  CronPulse running at http://localhost:${port}\n`);

		serve({ fetch: app.fetch, port });

		if (opts.open !== false) {
			try {
				const openModule = await import("open");
				await openModule.default(`http://localhost:${port}`);
			} catch {
				// open package not available
			}
		}

		function shutdown() {
			console.log("\n  Shutting down CronPulse...\n");
			stopWatcher();
			closeDb();
			process.exit(0);
		}

		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);
	});

program
	.command("list")
	.description("List all detected cron jobs")
	.action(() => {
		getDb();
		scanCrontab();

		const jobs = getAllJobs();
		if (jobs.length === 0) {
			console.log("No cron jobs detected.");
			closeDb();
			return;
		}

		console.log(`\n  Found ${jobs.length} cron job(s):\n`);
		console.log(
			"  " +
				"NAME".padEnd(30) +
				"SCHEDULE".padEnd(25) +
				"STATUS".padEnd(12) +
				"NEXT RUN",
		);
		console.log("  " + "─".repeat(90));

		for (const job of jobs) {
			const nextRun = job.nextRunAt
				? new Date(job.nextRunAt).toLocaleString()
				: "—";
			console.log(
				"  " +
					job.name.slice(0, 28).padEnd(30) +
					(job.scheduleHuman || job.scheduleExpression).slice(0, 23).padEnd(25) +
					job.status.padEnd(12) +
					nextRun,
			);
		}
		console.log();
		closeDb();
	});

program
	.command("run <name>")
	.description("Run a specific job by name or ID")
	.action((nameOrId: string) => {
		getDb();
		scanCrontab();

		const jobs = getAllJobs();
		const matches = jobs.filter(
			(j) =>
				j.id.startsWith(nameOrId) ||
				j.name.toLowerCase().includes(nameOrId.toLowerCase()),
		);

		if (matches.length === 0) {
			console.error(`  No job matching "${nameOrId}"`);
			closeDb();
			process.exit(1);
		}

		if (matches.length > 1) {
			console.log(`  Multiple jobs matching "${nameOrId}":\n`);
			for (const m of matches) {
				console.log(`    ${m.id.slice(0, 8)}  ${m.name}`);
			}
			console.log(`\n  Be more specific.\n`);
			closeDb();
			process.exit(1);
		}

		const job = matches[0];
		console.log(`\n  Running: ${job.name}`);
		console.log(`  Command: ${job.command}\n`);

		const runId = executeJob(job, "manual");

		eventBus.on("run:output", (event) => {
			if (event.runId !== runId) return;
			process.stdout.write(event.data);
		});

		eventBus.on("run:complete", (event) => {
			if (event.runId !== runId) return;
			console.log(`\n  Exit code: ${event.exitCode}`);
			console.log(`  Status: ${event.status}\n`);
			closeDb();
			process.exit(event.exitCode ?? 1);
		});
	});

program.parse();
