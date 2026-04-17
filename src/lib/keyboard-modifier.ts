/**
 * Keyboard modifier helpers. Helmor ships macOS-only, so "primary modifier"
 * is always Cmd (`event.metaKey`) and "secondary" is always Ctrl
 * (`event.ctrlKey`). Kept as small helpers so callers read intent instead
 * of hardcoding `event.metaKey` everywhere.
 */

/** Returns true if the event carries Cmd (the primary modifier on macOS). */
export function isPrimaryModifier(
	event: KeyboardEvent | { metaKey: boolean; ctrlKey: boolean },
): boolean {
	return event.metaKey;
}

/** Returns true if the event carries Ctrl (the secondary modifier on macOS).
 *  Used in strict shortcut checks where `event.ctrlKey` is an explicit
 *  reject signal on combos like Cmd+W / Cmd+Option+Arrow. */
export function hasSecondaryModifier(
	event: KeyboardEvent | { metaKey: boolean; ctrlKey: boolean },
): boolean {
	return event.ctrlKey;
}

/**
 * Returns true when the event is a bare Cmd + the given key, with NO extra
 * modifiers (shift/alt). Use this for single-modifier shortcuts like Cmd+K
 * where shift/alt would normally pick a different command.
 */
export function isExactPrimaryShortcut(
	event: KeyboardEvent,
	key: string,
): boolean {
	return (
		isPrimaryModifier(event) &&
		!event.shiftKey &&
		!event.altKey &&
		event.key === key
	);
}
