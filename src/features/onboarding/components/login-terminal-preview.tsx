import { useCallback, useEffect, useRef } from "react";
import {
	type TerminalHandle,
	TerminalOutput,
} from "@/components/terminal-output";
import {
	type AgentLoginProvider,
	resizeAgentLoginTerminal,
	type ScriptEvent,
	spawnAgentLoginTerminal,
	stopAgentLoginTerminal,
	writeAgentLoginTerminalStdin,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const providerLabels: Record<AgentLoginProvider, string> = {
	claude: "Claude Code",
	codex: "Codex",
};

export function LoginTerminalPreview({
	provider,
	instanceId,
	active,
	onExit,
	onError,
}: {
	provider: AgentLoginProvider | null;
	instanceId: string | null;
	active: boolean;
	onExit: (code: number | null) => void;
	onError: (message: string) => void;
}) {
	const termRef = useRef<TerminalHandle | null>(null);
	const resolvedProvider = provider ?? "codex";

	useEffect(() => {
		if (!active || !provider || !instanceId) return;

		let cancelled = false;
		const replay = () => {
			termRef.current?.clear();
			termRef.current?.refit();
		};

		if (termRef.current) replay();
		else requestAnimationFrame(replay);

		void spawnAgentLoginTerminal(provider, instanceId, (event: ScriptEvent) => {
			if (cancelled) return;
			switch (event.type) {
				case "stdout":
				case "stderr":
					termRef.current?.write(event.data);
					break;
				case "error":
					termRef.current?.write(`\r\n${event.message}\r\n`);
					onError(event.message);
					break;
				case "exited":
					onExit(event.code);
					break;
				case "started":
					break;
			}
		}).catch((error) => {
			if (cancelled) return;
			const message =
				error instanceof Error ? error.message : "Unable to start login.";
			termRef.current?.write(`\r\n${message}\r\n`);
			onError(message);
		});

		return () => {
			cancelled = true;
			void stopAgentLoginTerminal(provider, instanceId);
		};
	}, [active, provider, instanceId, onExit, onError]);

	const handleData = useCallback(
		(data: string) => {
			if (!provider || !instanceId) return;
			void writeAgentLoginTerminalStdin(provider, instanceId, data);
		},
		[provider, instanceId],
	);

	const handleResize = useCallback(
		(cols: number, rows: number) => {
			if (!provider || !instanceId) return;
			void resizeAgentLoginTerminal(provider, instanceId, cols, rows);
		},
		[provider, instanceId],
	);

	return (
		<div
			aria-hidden={!active}
			className={cn(
				"absolute top-1/2 right-0 w-[520px] -translate-y-1/2 transition-all duration-700 ease-[cubic-bezier(.22,.82,.2,1)]",
				active
					? "translate-x-0 opacity-100"
					: "pointer-events-none translate-x-[calc(100%+5rem)] opacity-0",
			)}
		>
			<div className="h-[340px] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl shadow-black/15">
				<div className="flex h-10 items-center gap-2 border-b border-border/55 bg-background px-4">
					<span className="size-2.5 rounded-full bg-muted-foreground/35" />
					<span className="size-2.5 rounded-full bg-muted-foreground/25" />
					<span className="size-2.5 rounded-full bg-muted-foreground/20" />
					<span className="ml-2 text-xs font-medium text-muted-foreground">
						{providerLabels[resolvedProvider]} login
					</span>
				</div>
				<TerminalOutput
					terminalRef={termRef}
					className="h-[300px]"
					detectLinks
					fontSize={12}
					lineHeight={1.35}
					padding="16px 0 16px 20px"
					onData={handleData}
					onResize={handleResize}
				/>
			</div>
		</div>
	);
}
