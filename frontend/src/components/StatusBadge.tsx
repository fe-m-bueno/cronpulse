import type { Job } from "@/lib/api";
import { cn } from "@/lib/utils";

type Status = Job["status"] | "running" | "succeeded" | "failed";

const config: Record<string, { label: string; dotColor: string; textColor: string }> = {
	idle: { label: "Idle", dotColor: "bg-neutral-300", textColor: "text-muted-foreground" },
	running: { label: "Running", dotColor: "bg-blue-500", textColor: "text-blue-600" },
	succeeded: { label: "Passed", dotColor: "bg-emerald-500", textColor: "text-emerald-600" },
	failed: { label: "Failed", dotColor: "bg-red-500", textColor: "text-red-600" },
	overdue: { label: "Overdue", dotColor: "bg-amber-500", textColor: "text-amber-600" },
};

export function StatusBadge({ status }: { status: Status }) {
	const c = config[status] || config.idle;

	return (
		<span className={cn("inline-flex items-center gap-1.5 text-xs", c.textColor)}>
			<span className="relative flex h-2 w-2">
				{status === "running" && (
					<span
						className={cn("absolute inset-0 rounded-full animate-ping opacity-75", c.dotColor)}
					/>
				)}
				<span className={cn("relative rounded-full h-2 w-2", c.dotColor)} />
			</span>
			{c.label}
		</span>
	);
}
