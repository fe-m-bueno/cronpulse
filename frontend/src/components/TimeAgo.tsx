import { timeAgo } from "@/lib/utils";
import { useEffect, useState } from "react";

export function TimeAgo({ date }: { date: string }) {
	const [display, setDisplay] = useState(() => timeAgo(date));

	useEffect(() => {
		const update = () => setDisplay(timeAgo(date));
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [date]);

	return (
		<span className="tabular-nums" title={new Date(date).toLocaleString()}>
			{display}
		</span>
	);
}
