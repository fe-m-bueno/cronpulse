import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSSE } from "@/hooks/useSSE";
import type { Run } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ArrowDown, Check, Clipboard, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LogLine {
	stream: "stdout" | "stderr";
	text: string;
}

export function LogViewer({ run, jobId }: { run: Run; jobId: string }) {
	const [lines, setLines] = useState<LogLine[]>([]);
	const [pinToBottom, setPinToBottom] = useState(true);
	const [search, setSearch] = useState("");
	const [showSearch, setShowSearch] = useState(false);
	const [copied, setCopied] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const isRunning = run.status === "running";
	const { messages } = useSSE(isRunning ? `/api/jobs/${jobId}/runs/${run.id}/stream` : null);

	useEffect(() => {
		if (isRunning) return;
		const parsed: LogLine[] = [];
		if (run.stdout) {
			for (const t of run.stdout.split("\n")) parsed.push({ stream: "stdout", text: t });
		}
		if (run.stderr) {
			for (const t of run.stderr.split("\n")) parsed.push({ stream: "stderr", text: t });
		}
		setLines(parsed);
	}, [run.stdout, run.stderr, isRunning]);

	useEffect(() => {
		if (!isRunning) return;
		const last = messages[messages.length - 1];
		if (!last || (last.event !== "stdout" && last.event !== "stderr")) return;
		setLines((prev) => [
			...prev,
			...last.data.split("\n").map((text) => ({ stream: last.event as "stdout" | "stderr", text })),
		]);
	}, [messages, isRunning]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: lines is intentionally included to scroll on new output
	useEffect(() => {
		if (pinToBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [lines, pinToBottom]);

	function handleCopy() {
		navigator.clipboard.writeText(lines.map((l) => l.text).join("\n"));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	const filtered = search
		? lines.filter((l) => l.text.toLowerCase().includes(search.toLowerCase()))
		: lines;

	return (
		<div className="border rounded-lg overflow-hidden bg-neutral-950">
			<div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-800">
				<span className="text-xs text-neutral-400 font-mono">
					{isRunning ? "Streaming…" : `Exit ${run.exitCode ?? "—"}`}
				</span>
				<div className="flex items-center gap-0.5">
					<Button
						size="sm"
						variant="ghost"
						className={cn(
							"h-6 w-6 p-0 text-neutral-400 hover:text-neutral-200",
							showSearch && "text-white",
						)}
						onClick={() => setShowSearch(!showSearch)}
					>
						<Search className="h-3.5 w-3.5" />
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-6 w-6 p-0 text-neutral-400 hover:text-neutral-200"
						onClick={handleCopy}
					>
						{copied ? (
							<Check className="h-3.5 w-3.5 text-emerald-400" />
						) : (
							<Clipboard className="h-3.5 w-3.5" />
						)}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className={cn(
							"h-6 w-6 p-0 text-neutral-400 hover:text-neutral-200",
							pinToBottom && "text-white",
						)}
						onClick={() => setPinToBottom(!pinToBottom)}
					>
						<ArrowDown className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			{showSearch && (
				<div className="flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/50">
					<Search className="h-3 w-3 text-neutral-500" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter output…"
						className="flex-1 bg-transparent text-xs font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="text-neutral-500 hover:text-neutral-300"
						>
							<X className="h-3 w-3" />
						</button>
					)}
				</div>
			)}

			<ScrollArea className="h-72">
				<div className="p-3 font-mono text-xs leading-5">
					{filtered.length === 0 && (
						<span className="text-neutral-600">
							{isRunning ? "Waiting for output…" : "No output"}
						</span>
					)}
					{filtered.map((line, i) => (
						<div
							key={`${i}-${line.stream}`}
							className={cn(
								"whitespace-pre-wrap break-all",
								line.stream === "stderr" ? "text-red-400" : "text-neutral-300",
							)}
						>
							{search ? highlightMatch(line.text, search) : line.text}
							{line.text === "" && "\u00A0"}
						</div>
					))}
					<div ref={bottomRef} />
				</div>
			</ScrollArea>
		</div>
	);
}

function highlightMatch(text: string, search: string): React.ReactNode {
	const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
	return parts.map((part, i) =>
		part.toLowerCase() === search.toLowerCase() ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: split parts are positional, never reorder
			<mark key={i} className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">
				{part}
			</mark>
		) : (
			part
		),
	);
}
