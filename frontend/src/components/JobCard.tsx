import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Countdown } from "./Countdown";
import { api, type Job } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { TimeAgo } from "./TimeAgo";
import { Play, Square, Clock, Timer } from "lucide-react";
import { useState } from "react";

export function JobCard({
	job,
	onRunTriggered,
}: { job: Job; onRunTriggered: () => void }) {
	const navigate = useNavigate();
	const [running, setRunning] = useState(false);

	async function handleRun(e: React.MouseEvent) {
		e.stopPropagation();
		setRunning(true);
		try {
			await api.triggerRun(job.id, true);
			onRunTriggered();
		} finally {
			setRunning(false);
		}
	}

	async function handleStop(e: React.MouseEvent) {
		e.stopPropagation();
		try {
			await api.stopJob(job.id);
			onRunTriggered();
		} catch {
			// no running process
		}
	}

	return (
		<div
			className="group border rounded-lg bg-card p-4 space-y-3 cursor-pointer hover:border-neutral-300 transition-colors"
			onClick={() => navigate(`/jobs/${job.id}`)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3 className="text-sm font-medium truncate group-hover:text-foreground">
						{job.name}
					</h3>
					<p className="text-xs text-muted-foreground mt-0.5">
						{job.scheduleHuman || job.scheduleExpression}
					</p>
				</div>
				<StatusBadge status={job.status} />
			</div>

			<div className="bg-secondary/50 rounded-md px-3 py-2">
				<code className="text-[11px] font-mono text-muted-foreground truncate block">
					{job.command}
				</code>
			</div>

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3 text-xs text-muted-foreground">
					{job.lastRunAt && (
						<span className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							<TimeAgo date={job.lastRunAt} />
							{job.lastDurationMs !== null && (
								<span className="opacity-60">· {formatDuration(job.lastDurationMs)}</span>
							)}
						</span>
					)}
					{job.nextRunAt && (
						<span className="flex items-center gap-1">
							<Timer className="h-3 w-3" />
							<Countdown targetDate={job.nextRunAt} />
						</span>
					)}
				</div>
				{job.status === "running" ? (
					<Button
						size="sm"
						variant="ghost"
						className="h-7 px-2.5 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
						onClick={handleStop}
					>
						<Square className="h-3 w-3" />
						Stop
					</Button>
				) : (
					<Button
						size="sm"
						variant="ghost"
						className="h-7 px-2.5 text-xs gap-1"
						onClick={handleRun}
						disabled={running}
					>
						<Play className="h-3 w-3" />
						Run
					</Button>
				)}
			</div>
		</div>
	);
}
