import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { RunHistory } from "@/components/RunHistory";
import { LogViewer } from "@/components/LogViewer";
import { api, type Job, type Run } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { ArrowLeft, Play, Square, Timer, Calendar } from "lucide-react";

export function JobDetail() {
	const { id } = useParams<{ id: string }>();
	const [job, setJob] = useState<Job | null>(null);
	const [runs, setRuns] = useState<Run[]>([]);
	const [selectedRun, setSelectedRun] = useState<Run | null>(null);
	const [loading, setLoading] = useState(true);
	const [running, setRunning] = useState(false);
	const [skipSleep, setSkipSleep] = useState(true);
	const hasSelectedInitialRun = useRef(false);
	const { messages } = useSSE("/api/events");

	const loadData = useCallback(async () => {
		if (!id) return;
		try {
			const [jobData, runsData] = await Promise.all([
				api.fetchJob(id),
				api.fetchRuns(id),
			]);
			setJob(jobData);
			setRuns(runsData);
			if (!hasSelectedInitialRun.current && runsData.length > 0) {
				setSelectedRun(runsData[0]);
				hasSelectedInitialRun.current = true;
			}
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => { loadData(); }, [loadData]);

	useEffect(() => {
		const last = messages[messages.length - 1];
		if (last?.event === "job:status-change" || last?.event === "jobs:updated") loadData();
	}, [messages, loadData]);

	async function handleRun() {
		if (!job) return;
		setRunning(true);
		try {
			const { runId } = await api.triggerRun(job.id, skipSleep);
			const runsData = await api.fetchRuns(job.id);
			setRuns(runsData);
			const newRun = runsData.find((r) => r.id === runId);
			if (newRun) setSelectedRun(newRun);
		} finally {
			setRunning(false);
		}
	}

	async function handleStop() {
		if (!job) return;
		try {
			await api.stopJob(job.id);
			loadData();
		} catch {
			// no running process
		}
	}

	async function handleSelectRun(run: Run) {
		if (!id) return;
		try {
			setSelectedRun(await api.fetchRun(id, run.id));
		} catch {
			setSelectedRun(run);
		}
	}

	if (loading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-28 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (!job) {
		return (
			<div className="border rounded-lg py-20 text-center">
				<p className="text-muted-foreground">Job not found</p>
				<Link to="/" className="text-sm text-foreground underline mt-2 inline-block">Back</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Link to="/" className="hover:text-foreground flex items-center gap-1 transition-colors">
					<ArrowLeft className="h-3.5 w-3.5" />
					Jobs
				</Link>
				<span>/</span>
				<span className="text-foreground truncate">{job.name}</span>
			</div>

			<div className="border rounded-lg bg-card p-5 space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
					<div className="space-y-1.5">
						<div className="flex items-center gap-3">
							<h1 className="text-base font-semibold">{job.name}</h1>
							<StatusBadge status={job.status} />
						</div>
						<div className="flex items-center gap-4 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								{job.scheduleHuman || job.scheduleExpression}
							</span>
							{job.nextRunAt && (
								<span className="flex items-center gap-1">
									<Timer className="h-3 w-3" />
									<Countdown targetDate={job.nextRunAt} />
								</span>
							)}
						</div>
					</div>
					<div className="flex items-center gap-3">
						{job.command.match(/^sleep\s+\d+\s*&&/i) && job.status !== "running" && (
							<label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
								<input
									type="checkbox"
									checked={skipSleep}
									onChange={(e) => setSkipSleep(e.target.checked)}
									className="rounded border-border"
								/>
								Skip sleep
							</label>
						)}
						{job.status === "running" ? (
							<Button
								size="sm"
								variant="destructive"
								onClick={handleStop}
								className="gap-1.5"
							>
								<Square className="h-3.5 w-3.5" />
								Stop
							</Button>
						) : (
							<Button
								size="sm"
								onClick={handleRun}
								disabled={running}
								className="gap-1.5"
							>
								<Play className="h-3.5 w-3.5" />
								Run Now
							</Button>
						)}
					</div>
				</div>

				<div className="bg-secondary/50 rounded-md p-3">
					<pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
						{job.command}
					</pre>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="space-y-3">
					<h2 className="text-sm font-medium">Run History</h2>
					<RunHistory runs={runs} selectedRunId={selectedRun?.id ?? null} onSelectRun={handleSelectRun} />
				</div>
				<div className="space-y-3">
					<h2 className="text-sm font-medium">Output</h2>
					{selectedRun ? (
						<LogViewer run={selectedRun} jobId={job.id} />
					) : (
						<div className="border rounded-lg bg-neutral-950 h-72 flex items-center justify-center text-neutral-500 text-sm">
							Select a run
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
