import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
	const stored = localStorage.getItem("cronpulse:theme");
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
	const [theme, setThemeState] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

	const toggle = useCallback(() => {
		setThemeState((prev) => {
			const next = prev === "dark" ? "light" : "dark";
			localStorage.setItem("cronpulse:theme", next);
			return next;
		});
	}, []);

	return { theme, toggle };
}
