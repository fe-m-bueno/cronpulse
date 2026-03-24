import { createHash } from "node:crypto";
import { CronExpressionParser } from "cron-parser";

export function getNextRunTime(expression: string): Date | null {
	try {
		const interval = CronExpressionParser.parse(expression);
		return interval.next().toDate();
	} catch {
		return null;
	}
}

const SPECIAL_SCHEDULES: Record<string, string> = {
	"@reboot": "At reboot",
	"@yearly": "Once a year",
	"@annually": "Once a year",
	"@monthly": "Once a month",
	"@weekly": "Once a week",
	"@daily": "Once a day",
	"@midnight": "At midnight",
	"@hourly": "Every hour",
};

export function toHumanReadable(expression: string): string {
	const lower = expression.trim().toLowerCase();
	if (SPECIAL_SCHEDULES[lower]) return SPECIAL_SCHEDULES[lower];

	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) return expression;

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

	if (expression === "* * * * *") return "Every minute";

	if (minute.startsWith("*/")) return `Every ${minute.slice(2)} minutes`;
	if (hour.startsWith("*/")) return `Every ${hour.slice(2)} hours`;

	if (minute !== "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
		return `Every hour at minute ${minute}`;
	}

	const hourDesc = formatHourField(hour);

	if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
		if (hour.includes("-") || hour.includes(",")) {
			return `At :${minute.padStart(2, "0")} ${hourDesc}`;
		}
		return `Every day at ${formatTime(hour, minute)}`;
	}
	if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
		const days = parseDayOfWeek(dayOfWeek);
		return `${days} at ${formatTime(hour, minute)}`;
	}
	if (minute !== "*" && hour !== "*" && dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
		return `Day ${dayOfMonth} of every month at ${formatTime(hour, minute)}`;
	}

	return expression;
}

function formatHourField(hour: string): string {
	if (hour.includes("-")) {
		const [start, end] = hour.split("-");
		return `every hour from ${start}:00 to ${end}:00`;
	}
	if (hour.includes(",")) {
		return `at hours ${hour}`;
	}
	return `at hour ${hour}`;
}

function formatTime(hour: string, minute: string): string {
	const h = Number.parseInt(hour, 10);
	const m = Number.parseInt(minute, 10);
	const period = h >= 12 ? "PM" : "AM";
	const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

function parseDayOfWeek(dow: string): string {
	const dayNames: Record<string, string> = {
		"0": "Sunday",
		"1": "Monday",
		"2": "Tuesday",
		"3": "Wednesday",
		"4": "Thursday",
		"5": "Friday",
		"6": "Saturday",
		"7": "Sunday",
	};

	if (dow.includes(",")) {
		const days = dow.split(",").map((d) => dayNames[d] || d);
		return days.join(", ");
	}
	if (dow.includes("-")) {
		const [start, end] = dow.split("-");
		return `${dayNames[start] || start} to ${dayNames[end] || end}`;
	}
	return dayNames[dow] || dow;
}

export function generateJobId(schedule: string, command: string): string {
	return createHash("sha256")
		.update(schedule + command)
		.digest("hex")
		.slice(0, 16);
}
