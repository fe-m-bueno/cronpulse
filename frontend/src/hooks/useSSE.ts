import { useCallback, useEffect, useRef, useState } from "react";

interface SSEMessage {
	event: string;
	data: string;
}

const MAX_MESSAGES = 100;

export function useSSE(url: string | null) {
	const [messages, setMessages] = useState<SSEMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const sourceRef = useRef<EventSource | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const connect = useCallback(() => {
		if (!url) return;
		if (sourceRef.current) {
			sourceRef.current.close();
		}

		const source = new EventSource(url);
		sourceRef.current = source;

		source.onopen = () => setConnected(true);
		source.onerror = () => {
			setConnected(false);
			source.close();
			reconnectRef.current = setTimeout(connect, 3000);
		};

		for (const eventType of [
			"status",
			"job:status-change",
			"jobs:updated",
			"stdout",
			"stderr",
			"complete",
			"heartbeat",
		]) {
			source.addEventListener(eventType, (e) => {
				const event = e as MessageEvent;
				setMessages((prev) => {
					const next = [...prev, { event: eventType, data: event.data }];
					return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
				});
			});
		}
	}, [url]);

	useEffect(() => {
		connect();
		return () => {
			sourceRef.current?.close();
			if (reconnectRef.current) clearTimeout(reconnectRef.current);
		};
	}, [connect]);

	const clear = useCallback(() => setMessages([]), []);

	return { messages, connected, clear };
}
