export type ShortcutId =
	| "workspace.previous"
	| "workspace.next"
	| "workspace.new"
	| "workspace.addRepository"
	| "workspace.copyPath"
	| "workspace.openInEditor"
	| "session.previous"
	| "session.next"
	| "session.new"
	| "session.close"
	| "session.reopenClosed"
	| "script.run"
	| "settings.open"
	| "theme.toggle"
	| "sidebar.left.toggle"
	| "sidebar.right.toggle"
	| "zen.toggle"
	| "zoom.in"
	| "zoom.out"
	| "zoom.reset"
	| "action.createPr"
	| "action.commitAndPush"
	| "action.pullLatest"
	| "action.mergePr"
	| "action.fixErrors"
	| "action.openPullRequest"
	| "composer.focus"
	| "composer.togglePlanMode"
	| "composer.openModelPicker"
	| "terminal.new"
	| "terminal.close"
	| "terminal.next"
	| "terminal.previous"
	| "inspector.toggleScripts"
	| "inspector.focusTerminal";

export type ShortcutGroup =
	| "Navigation"
	| "Session"
	| "Workspace"
	| "Actions"
	| "System"
	| "Composer"
	| "Terminal";

// Scopes a shortcut can live in. "app" = always active regardless of focus.
// All others gate on the nearest [data-focus-scope] DOM ancestor of the
// active element. New scopes (e.g. "editor") get appended here as panels
// learn to own their own keymap.
export type ShortcutScope = "app" | "chat" | "terminal" | "editor";

export type ShortcutDefinition = {
	id: ShortcutId;
	title: string;
	description?: string;
	group: ShortcutGroup;
	defaultHotkey: string | null;
	scopes: readonly ShortcutScope[];
	editable: boolean;
};

export type ShortcutMap = Partial<Record<string, string | null>>;
