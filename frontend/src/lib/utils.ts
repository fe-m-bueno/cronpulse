import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function timeAgo(date: string | Date): string {
	const now = Date.now();
	const then = new Date(date).getTime();
	const diff = now - then;

	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return `${seconds}s ago`;

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function formatDuration(ms: number | null): string {
	if (ms === null) return "—";
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.floor((ms % 60_000) / 1000);
	return `${minutes}m ${seconds}s`;
}

export function formatCountdown(targetDate: string | Date): string {
	const target = new Date(targetDate).getTime();
	const now = Date.now();
	const diff = target - now;

	if (diff <= 0) return "now";

	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return `in ${seconds}s`;

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		const secs = seconds % 60;
		return `in ${minutes}m ${secs}s`;
	}

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours < 24) return `in ${hours}h ${mins}m`;

	const days = Math.floor(hours / 24);
	return `in ${days}d ${hours % 24}h`;
}
