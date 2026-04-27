import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetActiveScopeForTesting } from "./focus-scope";
import {
	beginShortcutRecording,
	endShortcutRecording,
} from "./recording-state";
import { useAppShortcuts } from "./use-app-shortcuts";

function ShortcutHarness({ onTrigger }: { onTrigger: () => void }) {
	useAppShortcuts({
		overrides: {},
		handlers: [{ id: "theme.toggle", callback: onTrigger }],
	});
	return null;
}

function fireModT() {
	window.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "t",
			code: "KeyT",
			metaKey: true,
		}),
	);
}

describe("useAppShortcuts", () => {
	beforeEach(() => {
		_resetActiveScopeForTesting();
	});
	afterEach(() => {
		endShortcutRecording();
		document.body.innerHTML = "";
	});

	it("does not trigger app shortcuts while shortcut recording is active", () => {
		const onTrigger = vi.fn();
		render(<ShortcutHarness onTrigger={onTrigger} />);

		beginShortcutRecording();
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "t",
				code: "KeyT",
				metaKey: true,
				altKey: true,
			}),
		);

		expect(onTrigger).not.toHaveBeenCalled();
		endShortcutRecording();

		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "t",
				code: "KeyT",
				metaKey: true,
				altKey: true,
			}),
		);

		expect(onTrigger).toHaveBeenCalledTimes(1);
	});

	it("routes Mod+T to the chat handler when chat scope is active", () => {
		const sessionNew = vi.fn();
		const terminalNew = vi.fn();

		function Harness() {
			useAppShortcuts({
				overrides: {},
				handlers: [
					{ id: "session.new", callback: sessionNew },
					{ id: "terminal.new", callback: terminalNew },
				],
			});
			return (
				<div data-focus-scope="chat">
					<input data-testid="chat-input" />
				</div>
			);
		}

		const { getByTestId } = render(<Harness />);
		(getByTestId("chat-input") as HTMLInputElement).focus();

		fireModT();

		expect(sessionNew).toHaveBeenCalledTimes(1);
		expect(terminalNew).not.toHaveBeenCalled();
	});

	it("routes Mod+T to the terminal handler when terminal scope is active", () => {
		const sessionNew = vi.fn();
		const terminalNew = vi.fn();

		function Harness() {
			useAppShortcuts({
				overrides: {},
				handlers: [
					{ id: "session.new", callback: sessionNew },
					{ id: "terminal.new", callback: terminalNew },
				],
			});
			return (
				<div data-focus-scope="terminal">
					<input data-testid="terminal-input" />
				</div>
			);
		}

		const { getByTestId } = render(<Harness />);
		(getByTestId("terminal-input") as HTMLInputElement).focus();

		fireModT();

		expect(terminalNew).toHaveBeenCalledTimes(1);
		expect(sessionNew).not.toHaveBeenCalled();
	});

	it("fires app-scope shortcuts regardless of focus scope", () => {
		const themeToggle = vi.fn();

		function Harness() {
			useAppShortcuts({
				overrides: {},
				handlers: [{ id: "theme.toggle", callback: themeToggle }],
			});
			return (
				<div data-focus-scope="terminal">
					<input data-testid="terminal-input" />
				</div>
			);
		}

		const { getByTestId } = render(<Harness />);
		(getByTestId("terminal-input") as HTMLInputElement).focus();

		// Mod+Alt+T is the theme.toggle default and is in scope "app".
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "t",
				code: "KeyT",
				metaKey: true,
				altKey: true,
			}),
		);

		expect(themeToggle).toHaveBeenCalledTimes(1);
	});
});
