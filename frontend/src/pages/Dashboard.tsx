import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobs } from "@/hooks/useJobs";
import { type Job, type SystemInfo, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Grid3x3, List, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

function StatusSummary({ jobs }: { jobs: Job[] }) {
	const counts = { succeeded: 0, failed: 0, running: 0, idle: 0, overdue: 0 };
	for (const j of jobs) counts[j.status]++;

	const items = [
		{ key: "succeeded", label: "passed", color: "bg-emerald-500", count: counts.succeeded },
		{ key: "running", label: "running", color: "bg-blue-500", count: counts.running },
		{ key: "failed", label: "failed", color: "bg-red-500", count: counts.failed },
		{ key: "overdue", label: "overdue", color: "bg-amber-500", count: counts.overdue },
		{ key: "idle", label: "idle", color: "bg-neutral-300", count: counts.idle },
	].filter((i) => i.count > 0);

	return (
		<div className="flex items-center gap-4 text-xs text-muted-foreground">
			{items.map((item) => (
				<span key={item.key} className="flex items-center gap-1.5">
					<span className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
					{item.count} {item.label}
				</span>
			))}
		</div>
	);
}

function ViewToggle({
	view,
	onChange,
}: { view: "grid" | "list"; onChange: (v: "grid" | "list") => void }) {
	return (
		<div className="flex border rounded-md overflow-hidden">
			<Button
				variant="ghost"
				size="sm"
				className={cn("h-8 w-8 p-0 rounded-none", view === "grid" && "bg-secondary")}
				onClick={() => onChange("grid")}
			>
				<Grid3x3 className="h-3.5 w-3.5" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				className={cn("h-8 w-8 p-0 rounded-none border-l", view === "list" && "bg-secondary")}
				onClick={() => onChange("list")}
			>
				<List className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

export function Dashboard() {
	const { jobs, loading, refetch } = useJobs();
	const [system, setSystem] = useState<SystemInfo | null>(null);
	const [view, setView] = useState<"grid" | "list">(
		() => (localStorage.getItem("cronpulse:view") as "grid" | "list") || "grid",
	);
	const [scanning, setScanning] = useState(false);

	useEffect(() => {
		api.fetchSystem().then(setSystem).catch(console.error);
	}, []);

	function toggleView(v: "grid" | "list") {
		setView(v);
		localStorage.setItem("cronpulse:view", v);
	}

	async function handleScan() {
		setScanning(true);
		try {
			await api.triggerScan();
			await refetch();
		} finally {
			setScanning(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-lg font-semibold tracking-tight">Cron Jobs</h1>
					{system && (
						<p className="text-xs text-muted-foreground mt-0.5">
							{system.jobCount} jobs on {system.os}
							{system.isDocker && " · Docker"}
						</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleScan}
						disabled={scanning}
						className="h-8 gap-1.5 text-xs"
					>
						<RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
						Scan
					</Button>
					<ViewToggle view={view} onChange={toggleView} />
				</div>
			</div>

			{!loading && jobs.length > 0 && <StatusSummary jobs={jobs} />}

			{loading ? (
				<div
					className={cn(
						view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2",
					)}
				>
					{Array.from({ length: 6 }).map((_, idx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
						<Skeleton key={idx} className="h-36 rounded-lg" />
					))}
				</div>
			) : jobs.length === 0 ? (
				<div className="border rounded-lg py-20 text-center">
					<p className="text-muted-foreground text-sm">No cron jobs detected</p>
					<Button variant="outline" className="mt-4 gap-1.5 text-xs" onClick={handleScan}>
						<RefreshCw className="h-3.5 w-3.5" />
						Re-scan
					</Button>
				</div>
			) : (
				<div
					className={cn(
						view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2",
					)}
				>
					{jobs.map((job) => (
						<JobCard key={job.id} job={job} onRunTriggered={refetch} />
					))}
				</div>
			)}
		</div>
	);
}
