import { getAllReleases, getRepoData } from "@/lib/github";
import "./enhanced-changelog.css";
import { EnhancedChangelog } from "./enhanced-changelog";

// ISR: statically render at build time, refresh every hour
export const revalidate = 3600;

export const metadata = {
	title: "Changelog | Helmor",
	description:
		"Release notes and version history for Helmor - the local-first workbench for multi-agent software development.",
};

export default async function ChangelogPage() {
	const [releases, repoData] = await Promise.all([
		getAllReleases(),
		getRepoData(),
	]);
	return <EnhancedChangelog releases={releases} totalStars={repoData.stars} />;
}
