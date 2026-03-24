import { StatusBadge } from "./StatusBadge";
import { TimeAgo } from "./TimeAgo";
import type { Run } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";

export function RunHistory({
	runs,
	selectedRunId,
	onSelectRun,
}: {
	runs: Run[];
	selectedRunId: string | null;
	onSelectRun: (run: Run) => void;
}) {
	if (runs.length === 0) {
		return (
			<div className="border rounded-lg py-12 text-center text-sm text-muted-foreground">
				No runs yet
			</div>
		);
	}

	return (
		<div className="border rounded-lg divide-y overflow-hidden">
			{runs.map((run, i) => (
				<button
					type="button"
					key={run.id}
					className={cn(
						"w-full text-left px-3 py-2.5 text-xs flex items-center justify-between gap-3 transition-colors hover:bg-secondary/50",
						selectedRunId === run.id && "bg-secondary",
					)}
					onClick={() => onSelectRun(run)}
				>
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground tabular-nums w-4 text-right">
							{runs.length - i}
						</span>
						<StatusBadge status={run.status} />
					</div>
					<div className="flex items-center gap-3 text-muted-foreground">
						<TimeAgo date={run.startedAt} />
						<span className="tabular-nums">{formatDuration(run.durationMs)}</span>
						{run.exitCode !== null && (
							<span className={cn("tabular-nums", run.exitCode === 0 ? "text-emerald-600" : "text-red-500")}>
								{run.exitCode}
							</span>
						)}
						<span className="text-muted-foreground/60 capitalize">{run.trigger}</span>
					</div>
				</button>
			))}
		</div>
	);
}
