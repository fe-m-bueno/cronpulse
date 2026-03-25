import { Button } from "@/components/ui/button";
import { type SystemInfo, api } from "@/lib/api";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsPage() {
	const [system, setSystem] = useState<SystemInfo | null>(null);

	useEffect(() => {
		api.fetchSystem().then(setSystem).catch(console.error);
	}, []);

	return (
		<div className="max-w-lg space-y-8">
			<h1 className="text-lg font-semibold tracking-tight">Settings</h1>

			{system && (
				<section className="space-y-3">
					<h2 className="text-sm font-medium">System</h2>
					<div className="border rounded-lg divide-y text-sm">
						<InfoRow label="Platform" value={system.os} />
						<InfoRow label="Jobs" value={String(system.jobCount)} />
						<InfoRow label="Version" value={system.version} />
						<InfoRow label="Source" value={system.crontabPath} />
						<InfoRow label="Docker" value={system.isDocker ? "Yes" : "No"} />
					</div>
				</section>
			)}

			<section className="space-y-3">
				<h2 className="text-sm font-medium">Configuration</h2>
				<div className="border rounded-lg p-4 space-y-4">
					<Field
						id="retention"
						label="Log retention"
						hint="Runs kept per job"
						type="number"
						defaultValue={50}
					/>
					<Field
						id="port"
						label="Port"
						hint="Requires restart"
						type="number"
						defaultValue={7575}
						readOnly
					/>
					<div className="flex gap-2 pt-2">
						<Button size="sm" className="gap-1.5 text-xs">
							<Save className="h-3.5 w-3.5" />
							Save
						</Button>
						<Button size="sm" variant="outline" className="gap-1.5 text-xs">
							<RotateCcw className="h-3.5 w-3.5" />
							Reset
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between px-4 py-2.5">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-mono text-xs">{value}</span>
		</div>
	);
}

function Field({
	id,
	label,
	hint,
	type,
	defaultValue,
	readOnly,
}: {
	id: string;
	label: string;
	hint: string;
	type: string;
	defaultValue: number;
	readOnly?: boolean;
}) {
	return (
		<div className="space-y-1">
			<label htmlFor={id} className="text-sm">
				{label}
			</label>
			<input
				id={id}
				type={type}
				defaultValue={defaultValue}
				readOnly={readOnly}
				className="w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
			/>
			<p className="text-xs text-muted-foreground">{hint}</p>
		</div>
	);
}
