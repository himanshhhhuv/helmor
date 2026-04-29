"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "./header.css";

type Theme = "light" | "dark";
const STORAGE_KEY = "helmor-marketing-theme";

type HeaderProps = {
	currentVersion?: string;
	showVersion?: boolean;
};

export function Header({ currentVersion, showVersion = false }: HeaderProps) {
	const [theme, setTheme] = useState<Theme>("dark");
	const [mounted, setMounted] = useState(false);

	// Initialize theme after mount to avoid hydration mismatch
	useEffect(() => {
		setMounted(true);

		// First check if HTML already has theme classes
		const root = document.documentElement;
		if (root.classList.contains("light")) {
			setTheme("light");
			return;
		}
		if (root.classList.contains("dark")) {
			setTheme("dark");
			return;
		}

		// Then check localStorage
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed === "light" || parsed === "dark") {
					setTheme(parsed);
					return;
				}
			}
		} catch {
			/* noop */
		}

		// Finally check system preference
		const preferredTheme = window.matchMedia("(prefers-color-scheme: light)")
			.matches
			? "light"
			: "dark";
		setTheme(preferredTheme);
	}, []);

	// Apply theme changes to DOM and localStorage
	useEffect(() => {
		if (!mounted) return;

		const root = document.documentElement;
		root.classList.remove("dark", "light");
		root.classList.add(theme);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
		} catch {
			/* noop */
		}
	}, [theme, mounted]);

	const toggleTheme = useCallback((mode: Theme) => setTheme(mode), []);

	return (
		<header className="site-header">
			<div className="header-rail">
				<Link className="brand" href="/">
					<img
						className="brand-mark-dark"
						src="/helmor-logo-dark.svg"
						alt=""
						aria-hidden="true"
					/>
					<img
						className="brand-mark-light"
						src="/helmor-logo-light.svg"
						alt=""
						aria-hidden="true"
					/>
					Helmor
				</Link>

				{showVersion && currentVersion && (
					<span className="version">{currentVersion}</span>
				)}

				<div className="spacer" />

				<nav className="nav-links">
					<a href="https://github.com/dohooo/helmor#readme">Docs</a>
					<Link href="/changelog">Changelog</Link>
					<a href="https://github.com/dohooo/helmor/discussions">Discussions</a>
				</nav>

				<div className="theme-toggle" role="tablist" aria-label="Theme">
					<button
						type="button"
						aria-label="Light"
						aria-pressed={theme === "light"}
						className={theme === "light" ? "active" : undefined}
						onClick={() => toggleTheme("light")}
					>
						<SunIcon />
					</button>
					<button
						type="button"
						aria-label="Dark"
						aria-pressed={theme === "dark"}
						className={theme === "dark" ? "active" : undefined}
						onClick={() => toggleTheme("dark")}
					>
						<MoonIcon />
					</button>
				</div>
			</div>
		</header>
	);
}

function SunIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	);
}
