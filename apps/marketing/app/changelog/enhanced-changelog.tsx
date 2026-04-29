"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/header";
import type { Release } from "@/lib/github";

const RELEASES_PER_PAGE = 10;

type ChangelogProps = {
	releases: Release[];
	totalStars: number;
};

export function EnhancedChangelog({ releases, totalStars }: ChangelogProps) {
	const [currentPage, setCurrentPage] = useState(1);
	const [expandedRelease, setExpandedRelease] = useState<string | null>(
		releases[0]?.tag_name || null,
	);
	const [activeRelease, setActiveRelease] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<Record<string, string>>({});

	const totalPages = Math.ceil(releases.length / RELEASES_PER_PAGE);
	const startIndex = (currentPage - 1) * RELEASES_PER_PAGE;
	const endIndex = startIndex + RELEASES_PER_PAGE;
	const currentReleases = releases.slice(startIndex, endIndex);

	const latestRelease = releases[0];

	// Track which release is currently in viewport
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveRelease(entry.target.id);
					}
				});
			},
			{
				rootMargin: "-100px 0px -66% 0px",
				threshold: 0,
			},
		);

		// Observe all release cards
		const releaseCards = document.querySelectorAll(".release-card");
		releaseCards.forEach((card) => {
			observer.observe(card);
		});

		return () => observer.disconnect();
	}, [currentPage]); // Re-run when page changes

	return (
		<div className="enhanced-changelog">
			<Header
				currentVersion={latestRelease?.tag_name || "0.0.0"}
				showVersion={true}
			/>

			{/* Main layout */}
			<div className="changelog-layout">
				{/* Main content */}
				<main className="changelog-main">
					<div className="releases-grid">
						{currentReleases.map((release, index) => {
							const isLatest = startIndex + index === 0;
							const isExpanded = expandedRelease === release.tag_name;
							const highlights = parseHighlights(release.body || "");
							const currentTab = activeTab[release.tag_name] || "highlights";

							return (
								<article
									key={release.tag_name}
									id={release.tag_name}
									className="release-card"
								>
									<div className="release-card-header">
										<div className="release-title-row">
											<h2 className="release-version">
												{release.tag_name}
												{isLatest && (
													<span className="latest-badge">Latest</span>
												)}
											</h2>
											<div className="release-actions">
												<span className="commit-hash">
													{release.tag_name.slice(0, 7)}
												</span>
												<button
													type="button"
													className="download-btn"
													onClick={() =>
														window.open(release.html_url, "_blank")
													}
												>
													<DownloadIcon />
													Download
												</button>
											</div>
										</div>
										<time className="release-date">
											{formatDate(release.published_at)}
										</time>
									</div>

									{/* Tabs */}
									<div className="release-tabs">
										<button
											type="button"
											className={`tab ${currentTab === "highlights" ? "active" : ""}`}
											aria-selected={currentTab === "highlights"}
											onClick={() =>
												setActiveTab((prev) => ({
													...prev,
													[release.tag_name]: "highlights",
												}))
											}
										>
											Highlights
										</button>
										<button
											type="button"
											className={`tab ${currentTab === "changes" ? "active" : ""}`}
											aria-selected={currentTab === "changes"}
											onClick={() =>
												setActiveTab((prev) => ({
													...prev,
													[release.tag_name]: "changes",
												}))
											}
										>
											Changes
										</button>
										<button
											type="button"
											className={`tab ${currentTab === "contributors" ? "active" : ""}`}
											aria-selected={currentTab === "contributors"}
											onClick={() =>
												setActiveTab((prev) => ({
													...prev,
													[release.tag_name]: "contributors",
												}))
											}
										>
											Contributors
										</button>
									</div>

									{/* Tab Content */}
									{currentTab === "highlights" && (
										<>
											{highlights.length > 0 && (
												<div className="release-highlights">
													{highlights.slice(0, 5).map((item, i) => (
														<div key={i} className="highlight-item">
															<span className="highlight-icon">
																{item.icon}
															</span>
															<span className="highlight-text">
																{item.text}
															</span>
														</div>
													))}
													{highlights.length > 5 && (
														<button
															type="button"
															className="more-changes"
															onClick={() =>
																setExpandedRelease(
																	isExpanded ? null : release.tag_name,
																)
															}
														>
															... and {highlights.length - 5} more changes
														</button>
													)}
												</div>
											)}

											{!highlights.length && release.body && (
												<div className="release-body-preview">
													{release.body.slice(0, 200)}...
												</div>
											)}
										</>
									)}

									{currentTab === "changes" && (
										<div className="release-changes">
											{release.body ? (
												<pre className="release-body-full">{release.body}</pre>
											) : (
												<p className="no-content">
													No changes documented for this release.
												</p>
											)}
										</div>
									)}

									{currentTab === "contributors" && (
										<div className="release-contributors">
											<p className="contributors-info">
												View all contributors for this release on{" "}
												<a
													href={`${release.html_url}#contributors`}
													target="_blank"
													rel="noopener noreferrer"
													className="github-link-inline"
												>
													GitHub
												</a>
											</p>
										</div>
									)}
								</article>
							);
						})}
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="pagination">
							<button
								type="button"
								className="page-btn"
								disabled={currentPage === 1}
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								aria-label="Previous page"
							>
								‹
							</button>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map(
								(page) => {
									if (
										page === 1 ||
										page === totalPages ||
										Math.abs(page - currentPage) <= 1
									) {
										return (
											<button
												key={page}
												type="button"
												className={`page-btn ${page === currentPage ? "active" : ""}`}
												onClick={() => setCurrentPage(page)}
											>
												{page}
											</button>
										);
									}
									if (page === currentPage - 2 || page === currentPage + 2) {
										return (
											<span key={page} className="page-ellipsis">
												...
											</span>
										);
									}
									return null;
								},
							)}
							<button
								type="button"
								className="page-btn"
								disabled={currentPage === totalPages}
								onClick={() =>
									setCurrentPage((p) => Math.min(totalPages, p + 1))
								}
								aria-label="Next page"
							>
								›
							</button>
						</div>
					)}
				</main>

				{/* Right sidebar */}
				<aside className="changelog-toc">
					<div className="toc-section">
						<a
							href="https://github.com/dohooo/helmor"
							target="_blank"
							rel="noopener noreferrer"
							className="github-stats"
						>
							<StarIcon />
							<span className="stat-label">Star</span>
							<span className="stat-value">{formatNumber(totalStars)}</span>
						</a>
						<a
							href="https://github.com/dohooo/helmor"
							target="_blank"
							rel="noopener noreferrer"
							className="github-link"
						>
							<GithubIcon />
							GitHub
							<ExternalIcon />
						</a>
					</div>

					<div className="toc-section">
						<h3 className="toc-title">On this page</h3>
						<nav className="toc-nav">
							{currentReleases.map((release) => (
								<a
									key={release.tag_name}
									href={`#${release.tag_name}`}
									className={`toc-link ${activeRelease === release.tag_name ? "active" : ""}`}
								>
									{release.tag_name}
								</a>
							))}
						</nav>
					</div>

					<div className="toc-section">
						<h3 className="toc-title">Subscribe to updates</h3>
						<p className="toc-description">Get notified about new releases</p>
						<a
							href="https://github.com/dohooo/helmor"
							target="_blank"
							rel="noopener noreferrer"
							className="watch-btn"
						>
							<BellIcon />
							Watch on GitHub
						</a>
					</div>
				</aside>
			</div>
		</div>
	);
}

function parseHighlights(body: string): Array<{ icon: string; text: string }> {
	const icons = ["🚀", "⚡", "🎯", "🔧", "🛡️", "📦", "✨", "🐛", "📝", "🎨"];
	const lines = body.split("\n");
	const highlights: Array<{ icon: string; text: string }> = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
			const text = trimmed.slice(1).trim();
			if (text && highlights.length < 10) {
				highlights.push({
					icon: icons[highlights.length % icons.length],
					text: text.slice(0, 100),
				});
			}
		}
	}

	return highlights;
}

function formatDate(isoDate: string): string {
	const date = new Date(isoDate);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function formatNumber(num: number): string {
	if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
	return num.toString();
}

// Icons
function GithubIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.93c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.17a11 11 0 0 1 5.78 0c2.21-1.48 3.17-1.17 3.17-1.17.63 1.59.23 2.77.12 3.06.74.8 1.18 1.82 1.18 3.08 0 4.41-2.7 5.39-5.27 5.67.42.36.78 1.05.78 2.13v3.15c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
		</svg>
	);
}

function DownloadIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
		</svg>
	);
}

function StarIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
		</svg>
	);
}

function BellIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
		</svg>
	);
}

function ExternalIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
		</svg>
	);
}
