import type { ShortcutScope } from "./types";

// DOM contract: any container can opt in to a focus scope by setting
// `data-focus-scope="chat" | "terminal" | "editor"`. The active scope is
// resolved at dispatch time from the closest tagged ancestor of
// `document.activeElement`, with a sticky fallback for transient focus loss.
export const FOCUS_SCOPE_ATTRIBUTE = "data-focus-scope";

const KNOWN_SCOPES: ReadonlySet<ShortcutScope> = new Set([
	"app",
	"chat",
	"terminal",
	"editor",
]);

export const DEFAULT_FOCUS_SCOPE: ShortcutScope = "chat";

// Sticky memory of the last container the user explicitly engaged with.
// Closing the focused terminal tab destroys its xterm textarea, which sends
// `activeElement` back to `body` without firing a meaningful focusin — without
// this memory, the very next keystroke would route to chat (the default) and
// e.g. Mod+W would silently start closing chat sessions.
let lastEngagedScope: ShortcutScope = DEFAULT_FOCUS_SCOPE;

function readScopeFrom(element: Element | null): ShortcutScope | null {
	if (!element) return null;
	const container = element.closest(`[${FOCUS_SCOPE_ATTRIBUTE}]`);
	const value = container?.getAttribute(FOCUS_SCOPE_ATTRIBUTE);
	if (value && KNOWN_SCOPES.has(value as ShortcutScope)) {
		return value as ShortcutScope;
	}
	return null;
}

if (typeof document !== "undefined") {
	document.addEventListener(
		"focusin",
		(event) => {
			const target = event.target as Element | null;
			// Body picks up focus when the previously-focused element is
			// removed (e.g. xterm unmounted on tab close). Treat that as a
			// transient focus loss and keep the sticky memory.
			if (!target || target === document.body) return;
			lastEngagedScope = readScopeFrom(target) ?? DEFAULT_FOCUS_SCOPE;
		},
		true,
	);
}

export function getActiveScope(): ShortcutScope {
	if (typeof document === "undefined") return lastEngagedScope;
	const active = document.activeElement;
	if (active && active !== document.body) {
		const scope = readScopeFrom(active);
		if (scope) return scope;
		// Real focus owner lives outside any tagged scope (sidebar, top
		// chrome). Fall back to the default.
		return DEFAULT_FOCUS_SCOPE;
	}
	// activeElement === body — transient focus loss (e.g. focused element
	// just unmounted). Honor sticky only if its scope container still
	// exists in the DOM; otherwise the panel is gone and the sticky memory
	// is stale.
	if (lastEngagedScope === DEFAULT_FOCUS_SCOPE) return lastEngagedScope;
	const stillMounted = document.querySelector(
		`[${FOCUS_SCOPE_ATTRIBUTE}="${lastEngagedScope}"]`,
	);
	return stillMounted ? lastEngagedScope : DEFAULT_FOCUS_SCOPE;
}

/** Test-only: reset the sticky scope memory between tests. */
export function _resetActiveScopeForTesting() {
	lastEngagedScope = DEFAULT_FOCUS_SCOPE;
}
