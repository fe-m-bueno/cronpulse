import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors.js";
import { eventsRouter } from "./routes/events.js";
import { jobsRouter } from "./routes/jobs.js";
import { runsRouter } from "./routes/runs.js";
import { systemRouter } from "./routes/system.js";

export function createApp(): Hono {
	const app = new Hono();

	app.use("*", corsMiddleware);

	app.route("/api/jobs", runsRouter);
	app.route("/api/jobs", jobsRouter);
	app.route("/api/system", systemRouter);
	app.route("/api", systemRouter);
	app.route("/api/events", eventsRouter);

	app.use("/*", serveStatic({ root: "./dist/frontend" }));

	// Cache index.html in memory for SPA fallback
	const indexPath = join(process.cwd(), "dist", "frontend", "index.html");
	const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf-8") : null;

	app.get("*", (c) => {
		if (indexHtml) {
			return c.html(indexHtml);
		}
		return c.text("CronPulse - Frontend not built. Run: pnpm build:frontend", 200);
	});

	return app;
}
