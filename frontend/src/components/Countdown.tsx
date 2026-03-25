import { formatCountdown } from "@/lib/utils";
import { useEffect, useState } from "react";

export function Countdown({ targetDate }: { targetDate: string | null }) {
	const [display, setDisplay] = useState(() => (targetDate ? formatCountdown(targetDate) : "—"));

	useEffect(() => {
		if (!targetDate) return;
		const update = () => setDisplay(formatCountdown(targetDate));
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [targetDate]);

	return <span className="text-xs tabular-nums text-muted-foreground">{display}</span>;
}
