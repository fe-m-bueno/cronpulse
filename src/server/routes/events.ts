import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { type JobStatusChangeEvent, type JobsUpdatedEvent, eventBus } from "../../core/events.js";

const events = new Hono();

// GET /api/events — global SSE stream for status updates
events.get("/", (c) => {
	return streamSSE(c, async (stream) => {
		await stream.writeSSE({
			data: JSON.stringify({ type: "connected" }),
			event: "status",
		});

		const onStatusChange = async (event: JobStatusChangeEvent) => {
			try {
				await stream.writeSSE({
					data: JSON.stringify(event),
					event: "job:status-change",
				});
			} catch {
				cleanup();
			}
		};

		const onJobsUpdated = async (event: JobsUpdatedEvent) => {
			try {
				await stream.writeSSE({
					data: JSON.stringify(event),
					event: "jobs:updated",
				});
			} catch {
				cleanup();
			}
		};

		eventBus.on("job:status-change", onStatusChange);
		eventBus.on("jobs:updated", onJobsUpdated);

		// Heartbeat
		const heartbeat = setInterval(async () => {
			try {
				await stream.writeSSE({ data: "", event: "heartbeat" });
			} catch {
				cleanup();
			}
		}, 30000);

		const cleanup = () => {
			eventBus.off("job:status-change", onStatusChange);
			eventBus.off("jobs:updated", onJobsUpdated);
			clearInterval(heartbeat);
		};

		stream.onAbort(() => {
			cleanup();
		});

		// Keep stream open
		await new Promise(() => {});
	});
});

export { events as eventsRouter };
