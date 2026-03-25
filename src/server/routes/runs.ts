import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { type RunCompleteEvent, type RunOutputEvent, eventBus } from "../../core/events.js";
import { getJobById } from "../../db/jobs.js";
import { getRunById, getRunsByJobId } from "../../db/runs.js";

const runs = new Hono();

// GET /api/jobs/:id/runs
runs.get("/:id/runs", (c) => {
	const jobId = c.req.param("id");
	const job = getJobById(jobId);
	if (!job) {
		return c.json({ error: "Job not found" }, 404);
	}

	const limit = Number(c.req.query("limit") || "20");
	const offset = Number(c.req.query("offset") || "0");
	const jobRuns = getRunsByJobId(jobId, limit, offset);
	return c.json(jobRuns);
});

// GET /api/jobs/:id/runs/:runId
runs.get("/:id/runs/:runId", (c) => {
	const run = getRunById(c.req.param("runId"));
	if (!run) {
		return c.json({ error: "Run not found" }, 404);
	}
	return c.json(run);
});

// GET /api/jobs/:id/runs/:runId/stream — SSE live output
runs.get("/:id/runs/:runId/stream", (c) => {
	const runId = c.req.param("runId");
	const run = getRunById(runId);

	if (!run) {
		return c.json({ error: "Run not found" }, 404);
	}

	// If run is already complete, send the full output and close
	if (run.status !== "running") {
		return streamSSE(c, async (stream) => {
			if (run.stdout) {
				await stream.writeSSE({ data: run.stdout, event: "stdout" });
			}
			if (run.stderr) {
				await stream.writeSSE({ data: run.stderr, event: "stderr" });
			}
			await stream.writeSSE({
				data: JSON.stringify({
					exitCode: run.exitCode,
					status: run.status,
				}),
				event: "complete",
			});
		});
	}

	// Live streaming for running jobs
	return streamSSE(c, async (stream) => {
		const onOutput = async (event: RunOutputEvent) => {
			if (event.runId !== runId) return;
			try {
				await stream.writeSSE({ data: event.data, event: event.stream });
			} catch {
				// Stream closed
			}
		};

		const onComplete = async (event: RunCompleteEvent) => {
			if (event.runId !== runId) return;
			try {
				await stream.writeSSE({
					data: JSON.stringify({
						exitCode: event.exitCode,
						status: event.status,
					}),
					event: "complete",
				});
			} catch {
				// Stream closed
			}
			cleanup();
		};

		eventBus.on("run:output", onOutput);
		eventBus.on("run:complete", onComplete);

		const cleanup = () => {
			eventBus.off("run:output", onOutput);
			eventBus.off("run:complete", onComplete);
		};

		stream.onAbort(() => {
			cleanup();
		});

		// Keep stream open until complete
		await new Promise<void>((resolve) => {
			const checkDone = (event: RunCompleteEvent) => {
				if (event.runId === runId) {
					eventBus.off("run:complete", checkDone);
					resolve();
				}
			};
			eventBus.on("run:complete", checkDone);

			stream.onAbort(() => {
				eventBus.off("run:complete", checkDone);
				resolve();
			});
		});
	});
});

export { runs as runsRouter };
