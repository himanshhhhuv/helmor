import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	_resetActiveScopeForTesting,
	DEFAULT_FOCUS_SCOPE,
	getActiveScope,
} from "./focus-scope";

beforeEach(() => {
	_resetActiveScopeForTesting();
	document.body.innerHTML = "";
});

afterEach(() => {
	document.body.innerHTML = "";
});

describe("getActiveScope", () => {
	it("returns the default when nothing is focused", () => {
		expect(getActiveScope()).toBe(DEFAULT_FOCUS_SCOPE);
	});

	it("walks up to the closest [data-focus-scope] ancestor", () => {
		document.body.innerHTML = `
			<div data-focus-scope="terminal">
				<div>
					<input id="probe" />
				</div>
			</div>
		`;
		const probe = document.getElementById("probe") as HTMLInputElement;
		probe.focus();
		expect(getActiveScope()).toBe("terminal");
	});

	it("falls back to default for unknown scope values", () => {
		document.body.innerHTML = `
			<div data-focus-scope="bogus">
				<input id="probe" />
			</div>
		`;
		(document.getElementById("probe") as HTMLInputElement).focus();
		expect(getActiveScope()).toBe(DEFAULT_FOCUS_SCOPE);
	});

	it("nested scopes use the innermost tag", () => {
		document.body.innerHTML = `
			<div data-focus-scope="chat">
				<div data-focus-scope="terminal">
					<input id="probe" />
				</div>
			</div>
		`;
		(document.getElementById("probe") as HTMLInputElement).focus();
		expect(getActiveScope()).toBe("terminal");
	});

	it("keeps sticky scope when focused element is removed but container still exists", () => {
		// Two terminal panels (e.g. two open terminals); the focused one
		// gets unmounted but the sibling panel remains.
		document.body.innerHTML = `
			<div data-focus-scope="terminal" id="t1">
				<input id="probe" />
			</div>
			<div data-focus-scope="terminal" id="t2">
				<input id="alive" />
			</div>
		`;
		const probe = document.getElementById("probe") as HTMLInputElement;
		probe.focus();
		expect(getActiveScope()).toBe("terminal");

		document.getElementById("t1")?.remove();
		expect(document.activeElement).toBe(document.body);

		// One terminal container still exists — sticky should hold so the
		// next shortcut routes to the panel the user just engaged with.
		expect(getActiveScope()).toBe("terminal");
	});

	it("drops sticky when the engaged scope is no longer in the DOM", () => {
		// Single terminal panel — close it and there's nowhere left for
		// terminal-scoped shortcuts to land. Sticky must self-heal back to
		// the default so chat shortcuts fire as expected.
		document.body.innerHTML = `
			<div data-focus-scope="terminal" id="t1">
				<input id="probe" />
			</div>
		`;
		const probe = document.getElementById("probe") as HTMLInputElement;
		probe.focus();
		expect(getActiveScope()).toBe("terminal");

		document.getElementById("t1")?.remove();
		expect(getActiveScope()).toBe(DEFAULT_FOCUS_SCOPE);
	});

	it("updates sticky when user explicitly focuses a different scope", () => {
		document.body.innerHTML = `
			<div data-focus-scope="terminal">
				<input id="t" />
			</div>
			<div data-focus-scope="chat">
				<input id="c" />
			</div>
		`;
		(document.getElementById("t") as HTMLInputElement).focus();
		expect(getActiveScope()).toBe("terminal");

		(document.getElementById("c") as HTMLInputElement).focus();
		expect(getActiveScope()).toBe("chat");
	});

	it("treats explicit focus on an unscoped surface as a return to default", () => {
		document.body.innerHTML = `
			<div data-focus-scope="terminal">
				<input id="t" />
			</div>
			<input id="sidebar" />
		`;
		(document.getElementById("t") as HTMLInputElement).focus();
		expect(getActiveScope()).toBe("terminal");

		(document.getElementById("sidebar") as HTMLInputElement).focus();
		expect(getActiveScope()).toBe(DEFAULT_FOCUS_SCOPE);
	});
});
