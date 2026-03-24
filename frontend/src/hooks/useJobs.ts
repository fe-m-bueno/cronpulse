import { useCallback, useEffect, useState } from "react";
import { api, type Job } from "../lib/api";
import { useSSE } from "./useSSE";

export function useJobs() {
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const { messages } = useSSE("/api/events");

	const refetch = useCallback(async () => {
		try {
			const data = await api.fetchJobs();
			setJobs(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch jobs");
		} finally {
			setLoading(false);
		}
	}, []);

	// Initial fetch
	useEffect(() => {
		refetch();
	}, [refetch]);

	// Re-fetch when SSE notifies of changes
	useEffect(() => {
		const lastMessage = messages[messages.length - 1];
		if (!lastMessage) return;
		if (
			lastMessage.event === "job:status-change" ||
			lastMessage.event === "jobs:updated"
		) {
			refetch();
		}
	}, [messages, refetch]);

	return { jobs, loading, error, refetch };
}
