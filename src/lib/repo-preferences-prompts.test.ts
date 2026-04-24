import { describe, expect, it } from "vitest";
import {
	prependGeneralPreferencePrompt,
	resolveRepoPreferencePreview,
	resolveRepoPreferencePrompt,
} from "./repo-preferences-prompts";

describe("repo preference prompts", () => {
	const targetRefPlaceholder = "$" + "{TARGET_REF}";
	const dirtyWorktreePlaceholder = "$" + "{DIRTY_WORKTREE}";

	it("leaves the general preview empty when no override exists", () => {
		expect(resolveRepoPreferencePreview("general", {})).toBe("");
	});

	it("appends the override after the target-specific create-pr prompt", () => {
		expect(
			resolveRepoPreferencePrompt({
				key: "createPr",
				repoPreferences: { createPr: "Ship it exactly this way." },
				targetBranch: "develop",
			}),
		).toContain("### User Preferences\n\nShip it exactly this way.");
	});

	it("uses the workspace target branch in the create-pr prompt", () => {
		expect(
			resolveRepoPreferencePrompt({
				key: "createPr",
				repoPreferences: {},
				targetBranch: "develop",
			}),
		).toContain(
			"Open a pull request against `develop` using `gh pr create --base develop`.",
		);
	});

	it("throws instead of falling back when create-pr has no target branch", () => {
		expect(() =>
			resolveRepoPreferencePrompt({
				key: "createPr",
				repoPreferences: {},
			}),
		).toThrow("Missing workspace target branch for createPr prompt.");
	});

	it("renders the dynamic resolve-conflicts fallback", () => {
		expect(
			resolveRepoPreferencePrompt({
				key: "resolveConflicts",
				repoPreferences: {},
				targetRef: "origin/main",
				dirtyWorktree: true,
			}),
		).toBe(
			"Commit uncommitted changes, then merge origin/main into this branch. Then push.",
		);
	});

	it("uses the workspace target branch in the resolve-conflicts prompt", () => {
		expect(
			resolveRepoPreferencePrompt({
				key: "resolveConflicts",
				repoPreferences: {},
				targetBranch: "develop",
			}),
		).toContain(
			"This branch has merge conflicts with `develop`, this workspace's target branch.",
		);
	});

	it("throws instead of falling back when resolve-conflicts has no target branch", () => {
		expect(() =>
			resolveRepoPreferencePrompt({
				key: "resolveConflicts",
				repoPreferences: {},
			}),
		).toThrow("Missing workspace target branch for resolveConflicts prompt.");
	});

	it("prepends the general prompt to the first user message", () => {
		expect(
			prependGeneralPreferencePrompt("Fix the failing tests.", {
				general: "Always explain the root cause first.",
			}),
		).toBe(
			"IMPORTANT: The following are the user's custom preferences. These preferences take precedence over any default guidelines or instructions provided above. When there is a conflict, always follow the user's preferences.\n\n### User Preferences\n\nAlways explain the root cause first.\n\nUser request:\nFix the failing tests.",
		);
	});

	it("appends resolve-conflicts overrides after the dynamic fallback", () => {
		expect(
			resolveRepoPreferencePrompt({
				key: "resolveConflicts",
				repoPreferences: {
					resolveConflicts: `Prefer rebase when possible. Target: ${targetRefPlaceholder}. Dirty: ${dirtyWorktreePlaceholder}.`,
				},
				targetRef: "origin/main",
				dirtyWorktree: true,
			}),
		).toBe(
			"Commit uncommitted changes, then merge origin/main into this branch. Then push.\n\nIMPORTANT: The following are the user's custom preferences. These preferences take precedence over any default guidelines or instructions provided above. When there is a conflict, always follow the user's preferences.\n\n### User Preferences\n\nPrefer rebase when possible. Target: origin/main. Dirty: true.",
		);
	});

	it("leaves the first user message unchanged when general is empty", () => {
		expect(prependGeneralPreferencePrompt("Fix the failing tests.", {})).toBe(
			"Fix the failing tests.",
		);
	});
});
