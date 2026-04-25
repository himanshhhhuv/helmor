import { MarkGithubIcon } from "@primer/octicons-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
	ArrowRight,
	Cloud,
	FolderOpen,
	GitPullRequestArrow,
	Layers,
	Network,
	PackageCheck,
	Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import helmorLogoSrc from "@/assets/helmor-logo.png";
import helmorScreenshotSrc from "@/assets/helmor-screenshot-dark.png";
import { TrafficLightSpacer } from "@/components/chrome/traffic-light-spacer";
import { ConductorOnboarding } from "@/components/conductor-onboarding";
import { ClaudeIcon, OpenAIIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CloneFromUrlDialog } from "@/features/navigation/clone-from-url-dialog";
import {
	type AgentLoginProvider,
	addRepositoryFromLocalPath,
	cloneRepositoryFromUrl,
	enterOnboardingWindowMode,
	exitOnboardingWindowMode,
	loadAddRepositoryDefaults,
	openAgentLoginTerminal,
} from "@/lib/api";
import { describeUnknownError } from "@/lib/workspace-helpers";

type AppOnboardingProps = {
	onComplete: () => void;
};

type AgentLoginStatus = "ready" | "needsSetup";

type AgentLoginItem = {
	icon: typeof ClaudeIcon;
	provider: AgentLoginProvider;
	label: string;
	description: string;
	status: AgentLoginStatus;
};

type OnboardingStep =
	| "intro"
	| "agents"
	| "corner"
	| "skills"
	| "conductorTransition"
	| "conductor"
	| "repoImport"
	| "completeTransition";

type ImportedRepository = {
	id: string;
	name: string;
	source: "local" | "github";
	detail: string;
};

// Future real detection should check provider login state, not installation:
// - Claude Code is ready only when its local account/session can be confirmed.
// - Codex is ready only when its local account/session can be confirmed.
// Missing binaries are a separate setup problem; this step is about auth.
const agentLoginItems: AgentLoginItem[] = [
	{
		icon: ClaudeIcon,
		provider: "claude",
		label: "Claude Code",
		description: "Signed in and ready to run in local workspaces.",
		status: "ready",
	},
	{
		icon: OpenAIIcon,
		provider: "codex",
		label: "Codex",
		description: "Sign in to Codex to use OpenAI models in Helmor.",
		status: "needsSetup",
	},
];

function checkAgentLoginItems(): AgentLoginItem[] {
	// Placeholder for the real auth check. This must keep checking login state,
	// not binary installation. When the user returns focus to Helmor after
	// terminal login, this function is called again and should reclassify each
	// provider from its authenticated session/account state.
	return agentLoginItems;
}

function AgentStatusAction({
	provider,
	status,
}: {
	provider: AgentLoginProvider;
	status: AgentLoginStatus;
}) {
	if (status === "ready") {
		return (
			<div className="flex shrink-0 items-center gap-2 text-xs font-medium text-emerald-500">
				<span className="relative flex size-2">
					<span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-25" />
					<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
				</span>
				Ready
			</div>
		);
	}

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="h-7 shrink-0 border-amber-500/45 px-2 text-xs text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
			onClick={() => {
				void openAgentLoginTerminal(provider);
			}}
		>
			Log in
		</Button>
	);
}

function SetupItem({
	icon,
	label,
	description,
	actionLabel = "Set up",
}: {
	icon: ReactNode;
	label: string;
	description: string;
	actionLabel?: string;
}) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border/55 bg-card/70 px-4 py-3">
			<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-foreground">
				{icon}
			</div>
			<div className="min-w-0 flex-1">
				<div className="text-sm font-medium text-foreground">{label}</div>
				<p className="mt-0.5 text-xs leading-5 text-muted-foreground">
					{description}
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 shrink-0 px-2 text-xs"
			>
				{actionLabel}
			</Button>
		</div>
	);
}

function basename(path: string): string {
	const normalized = path.replace(/\/+$/, "");
	const value = normalized.split(/[\\/]/).pop();
	return value && value.length > 0 ? value : "Local project";
}

function repositoryNameFromUrl(url: string): string {
	const withoutTrailingSlash = url.trim().replace(/\/+$/, "");
	const name = withoutTrailingSlash
		.split("/")
		.pop()
		?.replace(/\.git$/, "");
	return name && name.length > 0 ? name : "GitHub repository";
}

export function AppOnboarding({ onComplete }: AppOnboardingProps) {
	const [step, setStep] = useState<OnboardingStep>("intro");
	const [loginItems, setLoginItems] = useState(() => checkAgentLoginItems());
	const [isRoutingImport, setIsRoutingImport] = useState(false);
	const [importedRepositories, setImportedRepositories] = useState<
		ImportedRepository[]
	>([]);
	const [githubImportProgress, setGithubImportProgress] = useState<
		number | null
	>(null);
	const [isAddingLocalRepository, setIsAddingLocalRepository] = useState(false);
	const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
	const [cloneDefaultDirectory, setCloneDefaultDirectory] = useState<
		string | null
	>(null);
	const [repoImportError, setRepoImportError] = useState<string | null>(null);

	const refreshLoginItems = useCallback(() => {
		setLoginItems(checkAgentLoginItems());
	}, []);

	useEffect(() => {
		window.addEventListener("focus", refreshLoginItems);
		return () => {
			window.removeEventListener("focus", refreshLoginItems);
		};
	}, [refreshLoginItems]);

	useEffect(() => {
		void enterOnboardingWindowMode();
		return () => {
			void exitOnboardingWindowMode();
		};
	}, []);

	const handleSkillsNext = useCallback(() => {
		if (isRoutingImport) {
			return;
		}
		setIsRoutingImport(true);
		// Temporary hardcoded route for tuning the default repository import screen.
		setStep("repoImport");
		setIsRoutingImport(false);
	}, [isRoutingImport]);

	const rememberImportedRepository = useCallback(
		({
			name,
			source,
			detail,
		}: {
			name: string;
			source: ImportedRepository["source"];
			detail: string;
		}) => {
			setImportedRepositories((current) => [
				{
					id: `${source}-${Date.now()}-${current.length}`,
					name,
					source,
					detail,
				},
				...current,
			]);
		},
		[],
	);

	const addLocalRepository = useCallback(async () => {
		if (isAddingLocalRepository) {
			return;
		}
		setIsAddingLocalRepository(true);
		setRepoImportError(null);
		try {
			const defaults = await loadAddRepositoryDefaults();
			const selection = await open({
				directory: true,
				multiple: false,
				defaultPath: defaults.lastCloneDirectory ?? undefined,
			});
			const selectedPath = Array.isArray(selection) ? selection[0] : selection;
			if (!selectedPath) {
				return;
			}
			await addRepositoryFromLocalPath(selectedPath);
			rememberImportedRepository({
				name: basename(selectedPath),
				source: "local",
				detail: selectedPath,
			});
		} catch (error) {
			setRepoImportError(
				describeUnknownError(error, "Unable to add repository."),
			);
		} finally {
			setIsAddingLocalRepository(false);
		}
	}, [isAddingLocalRepository, rememberImportedRepository]);

	const openCloneDialog = useCallback(() => {
		setCloneDialogOpen(true);
		setRepoImportError(null);
		void loadAddRepositoryDefaults()
			.then((defaults) => {
				setCloneDefaultDirectory(defaults.lastCloneDirectory ?? null);
			})
			.catch(() => {
				setCloneDefaultDirectory(null);
			});
	}, []);

	const handleCloneFromUrl = useCallback(
		async (args: { gitUrl: string; cloneDirectory: string }) => {
			setGithubImportProgress(0);
			let progress = 0;
			const interval = window.setInterval(() => {
				progress = Math.min(progress + 12, 92);
				setGithubImportProgress(progress);
			}, 180);
			try {
				await cloneRepositoryFromUrl(args);
				window.clearInterval(interval);
				setGithubImportProgress(100);
				window.setTimeout(() => setGithubImportProgress(null), 280);
				setCloneDefaultDirectory(args.cloneDirectory);
				rememberImportedRepository({
					name: repositoryNameFromUrl(args.gitUrl),
					source: "github",
					detail: args.gitUrl,
				});
			} catch (error) {
				window.clearInterval(interval);
				setGithubImportProgress(null);
				throw error;
			}
		},
		[rememberImportedRepository],
	);

	const completeOnboarding = useCallback(() => {
		setStep("completeTransition");
		window.setTimeout(onComplete, 1100);
	}, [onComplete]);

	if (step === "conductor") {
		return <ConductorOnboarding onComplete={onComplete} />;
	}

	return (
		<main
			aria-label="Helmor onboarding"
			className="relative h-screen overflow-hidden bg-background font-sans text-foreground antialiased"
		>
			<div
				aria-label="Helmor onboarding drag region"
				className="absolute inset-x-0 top-0 z-20 flex h-11 items-center"
			>
				<TrafficLightSpacer side="left" width={94} />
				<div data-tauri-drag-region className="h-full flex-1" />
				<TrafficLightSpacer side="right" width={140} />
			</div>

			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.08]"
				style={{
					backgroundImage:
						"linear-gradient(to right, var(--color-foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--color-foreground) 1px, transparent 1px)",
					backgroundSize: "64px 64px",
					maskImage:
						"radial-gradient(ellipse 82% 68% at 50% 42%, black 15%, transparent 78%)",
				}}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background via-background/80 to-transparent"
			/>

			<div
				aria-hidden={step !== "intro"}
				className={`relative z-10 grid h-full grid-cols-[minmax(360px,0.84fr)_minmax(460px,1.16fr)] items-center gap-12 px-14 pt-10 pb-12 max-lg:grid-cols-1 max-lg:content-center max-lg:gap-8 max-lg:px-8 ${step !== "intro" ? "pointer-events-none" : ""}`}
			>
				<section
					className={`flex min-w-0 flex-col items-start transition-transform duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] ${step !== "intro" ? "-translate-x-[58vw]" : "translate-x-0"}`}
				>
					<img
						src={helmorLogoSrc}
						alt="Helmor"
						draggable={false}
						className="size-12 rounded-[9px] opacity-95"
					/>
					<h1 className="mt-8 max-w-[13ch] text-5xl font-semibold leading-[0.98] tracking-normal text-foreground max-lg:text-4xl">
						Welcome to Helmor
					</h1>
					<p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
						A local-first workspace for running agents, reviewing work, and
						keeping project context close.
					</p>

					<Button
						type="button"
						size="lg"
						onClick={() => {
							setStep("agents");
						}}
						className="mt-8 h-11 gap-2 px-4 text-[0.95rem]"
					>
						Next
						<ArrowRight data-icon="inline-end" className="size-4" />
					</Button>
				</section>

				<section
					aria-label="Helmor preview"
					className={`relative flex min-h-[420px] min-w-0 items-center justify-center transition-transform duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] max-lg:hidden ${
						step === "skills" || step === "repoImport"
							? "translate-x-[32vw] translate-y-[2vh]"
							: step === "completeTransition"
								? "translate-x-[52vw] -translate-y-[18vh] opacity-0"
								: step === "conductorTransition"
									? "translate-x-[44vw] -translate-y-[12vh] opacity-0"
									: step === "corner"
										? "-translate-x-[86vw] translate-y-[57vh]"
										: step === "agents"
											? "-translate-x-[22vw] -translate-y-[51vh]"
											: "translate-x-0 translate-y-0"
					}`}
				>
					<div
						aria-hidden
						className="absolute left-6 top-7 h-28 w-64 border-l border-t border-border/70"
					/>
					<div
						aria-hidden
						className="absolute bottom-9 right-2 h-32 w-72 border-r border-b border-border/70"
					/>
					<div
						className={`relative w-full max-w-[760px] overflow-hidden rounded-lg border border-border/70 bg-card shadow-2xl shadow-black/35 transition-transform duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] ${
							step === "skills" || step === "repoImport"
								? "scale-[1.72]"
								: step === "completeTransition"
									? "scale-[1.95]"
									: step === "conductorTransition"
										? "scale-[1.95]"
										: step === "corner"
											? "scale-[2.24]"
											: step === "agents"
												? "scale-[1.5]"
												: "scale-100"
						}`}
					>
						<img
							src={helmorScreenshotSrc}
							alt="Helmor workspace preview"
							draggable={false}
							className="w-full object-cover"
						/>
					</div>
				</section>
			</div>

			<section
				aria-label="Agent login"
				aria-hidden={step !== "agents"}
				className={`absolute inset-x-0 bottom-8 z-20 flex h-[54vh] flex-col items-center px-8 pb-12 pt-8 transition-all duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] ${
					step === "corner"
						? "pointer-events-none -translate-x-[50vw] translate-y-[126vh] opacity-100"
						: step === "agents"
							? "translate-y-0 opacity-100"
							: "translate-y-10 opacity-0 pointer-events-none"
				}`}
			>
				<div className="w-full max-w-[720px]">
					<h2 className="text-3xl font-semibold tracking-normal text-foreground">
						Log in to your agents
					</h2>
					<p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
						Helmor uses your local Claude Code and Codex login sessions. You can
						log in now, or continue and log in later.
					</p>

					<div className="mt-7 flex w-full flex-col gap-3">
						{loginItems.map(
							({ icon: Icon, provider, label, description, status }) => (
								<div
									key={label}
									className="flex min-h-20 items-center gap-3 rounded-lg border border-border/55 bg-card/70 px-4 py-3"
								>
									<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-foreground">
										<Icon className="size-5" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium text-foreground">
											{label}
										</div>
										<p className="mt-0.5 text-xs leading-5 text-muted-foreground">
											{description}
										</p>
									</div>
									<AgentStatusAction provider={provider} status={status} />
								</div>
							),
						)}
					</div>

					<Button
						type="button"
						size="lg"
						onClick={() => {
							setStep("corner");
						}}
						className="mt-7 h-11 gap-2 px-4 text-[0.95rem]"
					>
						Next
						<ArrowRight data-icon="inline-end" className="size-4" />
					</Button>
				</div>
			</section>

			<section
				aria-label="Repository CLI setup"
				aria-hidden={step !== "corner"}
				className={`absolute right-14 top-24 z-30 w-full max-w-[980px] transition-all duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] ${
					step === "skills"
						? "pointer-events-none translate-x-[118vw] -translate-y-[55vh] opacity-100"
						: step === "corner"
							? "translate-x-0 translate-y-0 opacity-100"
							: "pointer-events-none translate-x-[64vw] -translate-y-[108vh] opacity-100"
				}`}
			>
				<div className="flex items-start gap-8">
					<div className="w-[360px] shrink-0">
						<h2 className="max-w-[11ch] text-4xl font-semibold leading-[1.02] tracking-normal text-foreground">
							Set up repository CLIs
						</h2>
						<p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
							Install and authenticate your GitHub or GitLab CLI so Helmor can
							open pull requests and keep repository actions local.
						</p>

						<Button
							type="button"
							size="lg"
							onClick={() => {
								setStep("skills");
							}}
							className="mt-7 h-11 gap-2 px-4 text-[0.95rem]"
						>
							Next
							<ArrowRight data-icon="inline-end" className="size-4" />
						</Button>
					</div>

					<div className="grid min-w-0 flex-1 gap-3">
						<SetupItem
							icon={<MarkGithubIcon size={20} />}
							label="GitHub CLI"
							description="Run gh auth login to connect GitHub locally."
						/>
						<SetupItem
							icon={<GitPullRequestArrow className="size-5" />}
							label="GitLab CLI"
							description="Run glab auth login to connect GitLab locally."
						/>
					</div>
				</div>
			</section>

			<section
				aria-label="MCP and skills setup"
				aria-hidden={step !== "skills"}
				className={`absolute left-[calc(30vw-260px)] top-20 z-30 w-[520px] transition-all duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] ${
					step === "skills"
						? "translate-x-0 translate-y-0 opacity-100"
						: step === "repoImport"
							? "pointer-events-none translate-x-0 translate-y-0 opacity-0"
							: step === "conductorTransition" || step === "completeTransition"
								? "pointer-events-none scale-[1.08] opacity-0 blur-sm"
								: "pointer-events-none -translate-x-[118vw] translate-y-[55vh] opacity-100"
				}`}
			>
				<div className="flex flex-col items-center">
					<div className="relative h-[270px] w-[420px]">
						<div className="absolute left-10 top-0 h-32 w-[340px] rotate-[-5deg] rounded-lg border border-border/55 bg-card/55 p-4 shadow-2xl shadow-black/20">
							<div className="flex items-center gap-2">
								<Sparkles className="size-4 text-muted-foreground" />
								<div className="h-3 w-24 rounded-full bg-foreground/16" />
							</div>
							<div className="mt-5 grid gap-2">
								<div className="h-2 rounded-full bg-foreground/10" />
								<div className="h-2 w-4/5 rounded-full bg-foreground/10" />
								<div className="h-2 w-2/3 rounded-full bg-foreground/10" />
							</div>
						</div>
						<div className="absolute left-[30px] top-14 h-32 w-[360px] rotate-[3deg] rounded-lg border border-border/60 bg-card/75 p-4 shadow-2xl shadow-black/25">
							<div className="flex items-center gap-2">
								<Layers className="size-4 text-muted-foreground" />
								<div className="h-3 w-28 rounded-full bg-foreground/18" />
							</div>
							<div className="mt-5 grid grid-cols-3 gap-2">
								<div className="h-14 rounded-md bg-foreground/8" />
								<div className="h-14 rounded-md bg-foreground/12" />
								<div className="h-14 rounded-md bg-foreground/8" />
							</div>
						</div>
						<div className="absolute left-5 top-28 h-32 w-[380px] rotate-[-1deg] rounded-lg border border-border/65 bg-card p-4 shadow-2xl shadow-black/30">
							<div className="flex items-center justify-between">
								<div className="h-3 w-32 rounded-full bg-foreground/20" />
								<div className="size-3 rounded-full bg-emerald-500/70" />
							</div>
							<div className="mt-5 grid gap-2">
								<div className="h-2 rounded-full bg-foreground/12" />
								<div className="h-2 w-5/6 rounded-full bg-foreground/12" />
								<div className="h-2 w-3/5 rounded-full bg-foreground/12" />
							</div>
						</div>
					</div>

					<div className="w-full text-center">
						<h2 className="text-3xl font-semibold tracking-normal text-foreground">
							Prepare the local field
						</h2>
						<p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
							Give Helmor the local tools it needs to discover context, call
							servers, and carry useful skills into every workspace.
						</p>
					</div>

					<div className="mt-7 grid w-full gap-3">
						<SetupItem
							icon={<Network className="size-5" />}
							label="MCP servers"
							description="Configure local MCP access so Helmor can reach the tools and context your work depends on."
						/>
						<SetupItem
							icon={<PackageCheck className="size-5" />}
							label="Skills"
							description="Install bundled skills so repeat workflows are ready before your first project."
						/>
					</div>

					<Button
						type="button"
						size="lg"
						onClick={() => {
							void handleSkillsNext();
						}}
						disabled={isRoutingImport}
						className="mt-7 h-11 gap-2 px-4 text-[0.95rem]"
					>
						Next
						<ArrowRight data-icon="inline-end" className="size-4" />
					</Button>
				</div>
			</section>

			<section
				aria-label="Repository import"
				aria-hidden={step !== "repoImport"}
				className={`absolute left-[calc(30vw-260px)] top-20 z-30 w-[520px] transition-all duration-1000 ease-[cubic-bezier(.22,.82,.2,1)] ${
					step === "repoImport"
						? "translate-x-0 translate-y-0 opacity-100"
						: step === "completeTransition"
							? "pointer-events-none -translate-x-[18vw] translate-y-[16vh] scale-[1.08] opacity-0 blur-sm"
							: "pointer-events-none translate-x-0 translate-y-0 opacity-0"
				}`}
			>
				<div className="flex h-[660px] flex-col">
					<div className="text-center">
						<h2 className="text-3xl font-semibold tracking-normal text-foreground">
							Bring in your first repositories
						</h2>
						<p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
							Start with a local project, or pull a remote repository from
							GitHub. You can add more than one before entering Helmor.
						</p>
					</div>

					<div className="mt-7 grid grid-cols-2 gap-3">
						<button
							type="button"
							onClick={addLocalRepository}
							disabled={isAddingLocalRepository}
							className="flex cursor-pointer flex-col items-start rounded-lg border border-border/55 bg-card/70 p-4 text-left transition-colors hover:bg-card disabled:cursor-default disabled:opacity-70"
						>
							<div className="flex size-10 items-center justify-center rounded-lg border border-border/50 bg-background text-foreground">
								<FolderOpen className="size-5" />
							</div>
							<div className="mt-4 text-sm font-medium text-foreground">
								Choose local project
							</div>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								Add a folder already on this machine.
							</p>
						</button>
						<button
							type="button"
							onClick={openCloneDialog}
							disabled={githubImportProgress !== null}
							className="flex cursor-pointer flex-col items-start rounded-lg border border-border/55 bg-card/70 p-4 text-left transition-colors hover:bg-card disabled:cursor-default disabled:opacity-70"
						>
							<div className="flex size-10 items-center justify-center rounded-lg border border-border/50 bg-background text-foreground">
								<Cloud className="size-5" />
							</div>
							<div className="mt-4 text-sm font-medium text-foreground">
								Import from GitHub
							</div>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								Clone a remote project into Helmor.
							</p>
							{githubImportProgress !== null ? (
								<div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-foreground transition-[width] duration-200"
										style={{ width: `${githubImportProgress}%` }}
									/>
								</div>
							) : null}
						</button>
					</div>

					{repoImportError ? (
						<p
							role="alert"
							className="mt-3 text-center text-xs text-destructive"
						>
							{repoImportError}
						</p>
					) : null}

					<div className="mt-7 min-h-0 flex-1">
						<div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
							<span>Imported repositories</span>
							<span>{importedRepositories.length}</span>
						</div>
						<div className="h-full max-h-[230px] overflow-y-auto rounded-lg border border-border/55 bg-card/35 p-2">
							{importedRepositories.length > 0 ? (
								<div className="grid gap-1.5">
									{importedRepositories.map((repo) => (
										<div
											key={repo.id}
											className="flex h-10 items-center gap-2 rounded-md border border-border/45 bg-background/75 px-3"
										>
											{repo.source === "local" ? (
												<FolderOpen className="size-3.5 text-muted-foreground" />
											) : (
												<Cloud className="size-3.5 text-muted-foreground" />
											)}
											<div className="min-w-0 flex-1">
												<div className="truncate text-xs font-medium text-foreground">
													{repo.name}
												</div>
												<div className="truncate text-[11px] text-muted-foreground">
													{repo.detail}
												</div>
											</div>
											<span className="size-1.5 rounded-full bg-emerald-500" />
										</div>
									))}
								</div>
							) : (
								<div className="flex h-full min-h-32 items-center justify-center text-center text-xs leading-5 text-muted-foreground">
									Choose a local folder or import from GitHub to build your
									first queue.
								</div>
							)}
						</div>
					</div>

					<div className="mt-7 flex justify-center">
						<Button
							type="button"
							size="lg"
							onClick={completeOnboarding}
							className="h-11 gap-2 px-4 text-[0.95rem]"
						>
							Let&apos;s ship
							<ArrowRight data-icon="inline-end" className="size-4" />
						</Button>
					</div>
				</div>
			</section>
			<CloneFromUrlDialog
				open={cloneDialogOpen}
				onOpenChange={setCloneDialogOpen}
				defaultCloneDirectory={cloneDefaultDirectory}
				onSubmit={handleCloneFromUrl}
			/>
		</main>
	);
}
