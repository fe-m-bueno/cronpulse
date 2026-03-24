import { Hono } from "hono";
import { executeJob, stopJobRuns } from "../../core/executor.js";
import { getAllJobs, getJobById } from "../../db/jobs.js";

const jobs = new Hono();


jobs.get("/", (c) => {
	const allJobs = getAllJobs();
	return c.json(allJobs);
});


jobs.get("/:id", (c) => {
	const job = getJobById(c.req.param("id"));
	if (!job) {
		return c.json({ error: "Job not found" }, 404);
	}
	return c.json(job);
});


jobs.post("/:id/run", (c) => {
	const job = getJobById(c.req.param("id"));
	if (!job) {
		return c.json({ error: "Job not found" }, 404);
	}

	const skipSleep = c.req.query("skipSleep") === "true";
	const runId = executeJob(job, "manual", skipSleep);
	return c.json({ runId }, 202);
});

jobs.post("/:id/stop", (c) => {
	const job = getJobById(c.req.param("id"));
	if (!job) {
		return c.json({ error: "Job not found" }, 404);
	}
	const stopped = stopJobRuns(job.id);
	if (stopped === 0) {
		return c.json({ error: "No running processes for this job" }, 404);
	}
	return c.json({ stopped });
});

export { jobs as jobsRouter };
