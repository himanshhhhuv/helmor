/**
 * Lexical plugin: strip IME segmentation spaces from abandoned composition
 * buffers.
 *
 * Why this exists: when a CJK pinyin IME is active and the user types a
 * non-pinyin string (e.g. `helmor`, `useState`, or any English word that
 * pinyin can segment), the IME shows segmented candidates like `he | lmor`
 * with an internal U+0020 separator. If the user then SWITCHES IMEs
 * (Shift / Ctrl+Space / Cmd+Space to flip to English) WITHOUT pressing
 * Enter to confirm or Esc to cancel, the OS force-commits the buffer with
 * those separator spaces preserved. Without this guard the editor ends up
 * with `he lmor` instead of the `helmor` the user actually typed.
 *
 * Lexical's `$onCompositionEndImpl` calls `$updateSelectedTextFromDOM` which
 * reads the DOM text content as the source of truth (only falling back to
 * `event.data` when the DOM still holds the composition placeholder). That
 * means modifying `event.data` alone is not enough — we have to mutate the
 * DOM text node BEFORE Lexical's bubble-phase compositionend handler runs.
 *
 * Strategy: capture-phase compositionend listener on the editor root. When
 * `event.data` is pure printable ASCII AND contains a U+0020, treat it as
 * an abandoned IME-segmented buffer and rewrite the matching DOM text node.
 * This is safe for pinyin / zhuyin / wubi / cangjie because none of those
 * IMEs emit candidates with intentional ASCII spaces — every space in a
 * pure-ASCII composition buffer is an IME-injected segmentation separator.
 * Mixed-script commits (e.g. `你好 world`) are not touched because their
 * `data` contains non-ASCII codepoints.
 *
 * Why NOT a `COMPOSITION_END_COMMAND` listener: that command is dispatched
 * from Lexical's bubble-phase handler, AFTER the model is already updated
 * from the DOM. Capture-phase on the native event is the only point where
 * we can still influence what Lexical sees.
 *
 * Caret restoration: assigning `.textContent` on a Text node collapses any
 * live DOM selection on WebKit — Lexical's bubble-phase compositionend
 * handler then reads a null anchor and can't re-attach the model selection,
 * so the caret ends up at the paragraph start (the reported "cursor
 * flashes to the front" bug). We fix that in two places: first by setting
 * a DOM selection at the end of the replacement inside the capture handler
 * (what Lexical reads from DOM), and second by registering a LOW-priority
 * `COMPOSITION_END_COMMAND` listener that runs AFTER Lexical's default
 * handler, stepping the Lexical MODEL selection to the end of the text
 * node. Without the second step, if Lexical's own model selection was
 * stale or absent at compositionend time, the reconciliation would blow
 * away the DOM selection we placed in the first step.
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$getRoot,
	$isTextNode,
	COMMAND_PRIORITY_LOW,
	COMPOSITION_END_COMMAND,
} from "lexical";
import { useEffect, useRef } from "react";

const PURE_PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

function isAbandonedImeAsciiBuffer(data: string): boolean {
	return PURE_PRINTABLE_ASCII.test(data) && data.includes(" ");
}

function stripImeSegmentationSpaces(
	root: Node,
	target: string,
	replacement: string,
): boolean {
	if (root.nodeType === Node.TEXT_NODE) {
		const text = root.textContent;
		if (text?.includes(target)) {
			const matchStart = text.indexOf(target);
			const replacedEnd = matchStart + replacement.length;
			root.textContent = text.replace(target, replacement);

			// Place a DOM selection at the end of the replacement so
			// Lexical's `$updateSelectedTextFromDOM` reads a valid anchor
			// when it runs in the bubble phase. Without this, WebKit's
			// `.textContent` assignment collapses the live selection
			// entirely and Lexical falls through to a no-selection path.
			const ownerDocument = root.ownerDocument;
			const win = ownerDocument?.defaultView;
			const sel = win?.getSelection();
			if (sel && ownerDocument) {
				const range = ownerDocument.createRange();
				range.setStart(root, replacedEnd);
				range.setEnd(root, replacedEnd);
				sel.removeAllRanges();
				sel.addRange(range);
			}
			return true;
		}
		return false;
	}
	for (const child of Array.from(root.childNodes)) {
		if (stripImeSegmentationSpaces(child, target, replacement)) return true;
	}
	return false;
}

export function CompositionGuardPlugin() {
	const [editor] = useLexicalComposerContext();
	const didStripRef = useRef(false);

	useEffect(() => {
		const handler = (event: Event) => {
			const ce = event as CompositionEvent;
			const data = ce.data;
			if (!data || !isAbandonedImeAsciiBuffer(data)) return;
			const stripped = data.replace(/\s+/g, "");
			const root = editor.getRootElement();
			if (!root) return;
			const didStrip = stripImeSegmentationSpaces(root, data, stripped);
			if (didStrip) didStripRef.current = true;
		};

		const unregisterRoot = editor.registerRootListener(
			(rootElement, prevRootElement) => {
				if (prevRootElement) {
					prevRootElement.removeEventListener("compositionend", handler, true);
				}
				if (rootElement) {
					rootElement.addEventListener("compositionend", handler, true);
				}
			},
		);

		// After Lexical's default compositionend handler runs, its model
		// selection may have been cleared (especially when no RangeSelection
		// existed at compositionstart time). If we stripped this turn, pin
		// the Lexical caret to the end of the last text node so the DOM
		// reconciliation lands the caret where the user expects: right
		// after the text they just typed.
		const unregisterCommand = editor.registerCommand(
			COMPOSITION_END_COMMAND,
			() => {
				if (!didStripRef.current) return false;
				didStripRef.current = false;
				editor.update(() => {
					const lastDescendant = $getRoot().getLastDescendant();
					if ($isTextNode(lastDescendant)) {
						const size = lastDescendant.getTextContentSize();
						lastDescendant.select(size, size);
					}
				});
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);

		return () => {
			const root = editor.getRootElement();
			if (root) {
				root.removeEventListener("compositionend", handler, true);
			}
			unregisterRoot();
			unregisterCommand();
		};
	}, [editor]);

	return null;
}
