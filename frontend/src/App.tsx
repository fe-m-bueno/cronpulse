import { Button } from "@/components/ui/button";
import { Activity, Moon, Settings, Sun } from "lucide-react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import { cn } from "./lib/utils";
import { Dashboard } from "./pages/Dashboard";
import { JobDetail } from "./pages/JobDetail";
import { SettingsPage } from "./pages/Settings";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
	const location = useLocation();
	const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

	return (
		<Link
			to={to}
			className={cn(
				"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
				isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
			)}
		>
			{children}
		</Link>
	);
}

function Layout() {
	const { theme, toggle } = useTheme();

	return (
		<div
			className="min-h-screen bg-background"
			style={{
				backgroundImage:
					"linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)",
				backgroundSize: "32px 32px",
			}}
		>
			<header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
				<div className="mx-auto max-w-5xl flex items-center justify-between px-6 h-14">
					<Link to="/" className="text-sm font-semibold tracking-tight">
						CronPulse
					</Link>
					<nav className="flex items-center gap-1">
						<NavLink to="/">
							<Activity className="h-4 w-4" />
							Jobs
						</NavLink>
						<NavLink to="/settings">
							<Settings className="h-4 w-4" />
							Settings
						</NavLink>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-1" onClick={toggle}>
							{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
						</Button>
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-6 py-8">
				<Routes>
					<Route path="/" element={<Dashboard />} />
					<Route path="/jobs/:id" element={<JobDetail />} />
					<Route path="/settings" element={<SettingsPage />} />
				</Routes>
			</main>
		</div>
	);
}

export function App() {
	return (
		<BrowserRouter>
			<Layout />
		</BrowserRouter>
	);
}
