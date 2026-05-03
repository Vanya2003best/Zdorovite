"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCinematicCopyField } from "./cinematic-copy-actions";
import { sanitizeRichHTML } from "./sanitize-rich";
import { useEditingPageId } from "./EditingPageContext";

/**
 * In-place rich-text editor for trainer copy fields where inline formatting
 * matters (accent color, italics) — e.g. fullbleed quote, decorated H2s.
 *
 * Read-mode rendering elsewhere in the page reads the same HTML string and
 * uses dangerouslySetInnerHTML — keeping the visual identical between editor
 * and public.
 *
 * Edit affordances:
 *  - contenteditable holds HTML (sanitized allowlist; see sanitize-rich.ts)
 *  - Selecting text inside it surfaces a small floating toolbar with three
 *    buttons: Akcent (wraps selection in <span style="color: accent">),
 *    Kursywa (<em>), Wyczyść (strip color/em from selection).
 *  - Buttons use document.execCommand which is deprecated but still the
 *    most reliable cross-browser way to wrap a Range without re-implementing
 *    text node splitting by hand.
 *  - Commit on blur, Esc reverts. Plain Enter inserts <br> in multiline mode.
 *
 * Storage: HTML string under customization.cinematicCopy.<field>. Server
 * re-sanitizes via sanitizeRichHTML; client also sanitizes before save so the
 * user can't slip something past defence-in-depth.
 */
export default function EditableRichCopy({
  field,
  initial,
  defaultHTML,
  accentColor,
  className = "",
  block = false,
  multiline = false,
  maxLength = 400,
}: {
  field: string;
  /** Saved override HTML, or undefined if trainer is using the default. */
  initial: string | undefined;
  /** Default HTML rendered when no override (must already be sanitized — pass
   *  literal markup from the source code). */
  defaultHTML: string;
  /** Hex color used by the Akcent button. Tied to template's customization.accentColor. */
  accentColor: string;
  className?: string;
  /** Render as block-level inline span (display:block) for paragraph-like fields. */
  block?: boolean;
  /** Allow newline insertion on Enter (Ctrl+Enter or blur commits). */
  multiline?: boolean;
  /** Approximate cap on textContent length — prevents users from pasting essays. */
  maxLength?: number;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();
  const ref = useRef<HTMLSpanElement | null>(null);
  const isDragging = useRef(false);
  const [, startTransition] = useTransition();
  const [toolbar, setToolbar] = useState<{ left: number; top: number } | null>(null);

  const valueHTML = initial && initial.trim() !== "" ? initial : defaultHTML;

  // Initial mount: paint the HTML once via ref. We deliberately do NOT use
  // dangerouslySetInnerHTML on the contenteditable — React would re-apply it on
  // every render (e.g. when our toolbar state changes), which rebuilds the DOM
  // subtree and silently destroys the user's selection. With innerHTML set via
  // ref, the DOM is owned by the user from then on; React only diffs attrs.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== valueHTML) {
      el.innerHTML = valueHTML;
    }
    // Mount-only — subsequent valueHTML changes are handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync DOM with initial / defaultHTML when it changes externally (e.g. after
  // router.refresh post-save). Skip while focused so we don't yank the caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== valueHTML) {
      el.innerHTML = valueHTML;
    }
  }, [valueHTML]);

  // Compute toolbar position from current selection. Returns null if there's
  // nothing useful to show (collapsed, outside our editable, no selection).
  // Coordinates are viewport-relative for `position: fixed`.
  //
  // We don't simply use `rect.bottom + N`: getBoundingClientRect for a Range
  // returns the LINE BOX bottom, which on text with line-height > 1 sits well
  // below the actual glyph descenders (the leading is split between asc/desc).
  // For a 40px font with line-height 1.15 the leading-bottom can be ~10-30px
  // below the visible characters — that puts the toolbar way too far down.
  //
  // Instead we anchor to `rect.top + computed font-size`, which approximates
  // the glyph baseline. Adding a small constant gap then sits the toolbar just
  // under the letters, regardless of the line-height value.
  const computeToolbarPosition = () => {
    const el = ref.current;
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;
    if (!el.contains(range.commonAncestorContainer)) return null;
    const rect = range.getBoundingClientRect();

    let glyphBottom = rect.bottom;
    try {
      const fontSizePx = parseFloat(window.getComputedStyle(el).fontSize);
      if (!Number.isNaN(fontSizePx) && fontSizePx > 0) {
        // Approximate glyph descender baseline ≈ rect.top + 1.05 × font-size
        // (font-size is the EM box; descender lives ~0.05em below baseline).
        glyphBottom = rect.top + fontSizePx * 1.05;
      }
    } catch {
      // Fallback to plain rect.bottom if getComputedStyle fails for any reason.
    }

    const top = Math.min(window.innerHeight - 48, glyphBottom + 6);
    const left = rect.left + rect.width / 2;
    return { top, left };
  };

  // Show toolbar only on mouseup (drag finished) or after keyboard selection
  // settles. Showing it on every selectionchange while the user is still
  // dragging would put the popup right on top of the text being selected and
  // steal the next mousemove — defeating the whole purpose.
  useEffect(() => {
    const onSelectionChange = () => {
      // Mid-drag selection updates → don't surface the toolbar yet.
      if (isDragging.current) {
        setToolbar(null);
        return;
      }
      const pos = computeToolbarPosition();
      setToolbar(pos);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // Click outside the editable + toolbar → dismiss toolbar so it doesn't linger
  // when the trainer moves on to something else.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // Allow clicks on the toolbar itself.
      const tb = document.getElementById(`rich-toolbar-${field}`);
      if (tb && tb.contains(target)) return;
      setToolbar(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [field]);

  // Track drag state so selectionchange knows whether to show or wait.
  const onMouseDown = () => {
    isDragging.current = true;
    setToolbar(null);
  };

  // mouseup may fire OUTSIDE the editable if the trainer drags past its bounds
  // — listen on document while a drag is in progress so we always catch it.
  useEffect(() => {
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      // Defer one tick so the selection range is finalised by the browser.
      setTimeout(() => setToolbar(computeToolbarPosition()), 0);
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, []);

  const enforceLength = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";
    if (text.length <= maxLength) return;
    // Trim from end — simple approach. User typing past the cap just stops
    // accepting new input (the truncation runs on next input event).
    el.textContent = text.slice(0, maxLength);
    moveCaretToEnd(el);
  };

  const onInput = () => {
    enforceLength();
  };

  const onBlur = () => {
    const el = ref.current;
    if (!el) return;
    // Browser keeps selection alive across the blur event briefly; bury the
    // toolbar so it doesn't linger after focus moves elsewhere.
    setToolbar(null);

    const rawHTML = el.innerHTML.trim();
    const sanitized = sanitizeRichHTML(rawHTML);
    // Commit only on actual change vs. either current saved value or default.
    if (sanitized === (initial ?? "").trim()) return;

    // If trainer typed back to the default, treat as "remove override".
    const valueToSend = sanitized === defaultHTML.trim() ? "" : sanitized;

    startTransition(async () => {
      await updateCinematicCopyField(field, valueToSend, pageId);
      router.refresh();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      const el = ref.current;
      if (el) el.innerHTML = valueHTML;
      el?.blur();
      return;
    }
    if (e.key === "Enter") {
      if (!multiline) {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.currentTarget.blur();
      }
      // Plain Enter in multiline mode → browser inserts <br>
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLSpanElement>) => {
    // Strip pasted formatting — we only want plain text into the editor.
    // Trainer can re-apply formatting via the toolbar.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    enforceLength();
  };

  // Toolbar actions ---
  // execCommand is deprecated but still the simplest path for wrapping a
  // selection. We don't need any of the legacy state tracking, just the
  // wrap/unwrap.
  const applyAccent = () => {
    const el = ref.current;
    if (!el) return;
    el.focus(); // ensure execCommand has a target
    document.execCommand("foreColor", false, accentColor);
  };
  const applyItalic = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    document.execCommand("italic", false);
  };
  const clearFormat = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    document.execCommand("removeFormat", false);
    // Remove orphan empty spans/font tags that removeFormat sometimes leaves
    el.innerHTML = sanitizeRichHTML(el.innerHTML);
  };

  return (
    <>
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onMouseDown={onMouseDown}
        style={block ? { display: "block" } : undefined}
        className={`outline-none cursor-text ${multiline ? "whitespace-pre-wrap" : ""} ${className}`}
        // Intentionally NO dangerouslySetInnerHTML / children here — innerHTML
        // is set once via ref in the mount effect, then DOM is user-owned.
      />
      {toolbar && (
        <div
          id={`rich-toolbar-${field}`}
          // Fixed positioning keeps the toolbar pinned to the selection's
          // viewport coordinates regardless of any ancestor scroll containers.
          style={{ position: "fixed", top: toolbar.top, left: toolbar.left, transform: "translateX(-50%)" }}
          className="z-[60] flex gap-1 rounded-full bg-[#0a0a0c] border border-white/15 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)] p-1"
          // mousedown instead of click — click fires after blur, by which time
          // the selection is gone.
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={applyAccent}
            title="Akcent (kolor szablonu)"
            className="px-2.5 h-7 rounded-full text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-white/10 transition inline-flex items-center gap-1.5"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: accentColor }} />
            Akcent
          </button>
          <button
            type="button"
            onClick={applyItalic}
            title="Kursywa"
            className="px-2.5 h-7 rounded-full text-[11px] italic text-white/80 hover:bg-white/10 transition"
          >
            I
          </button>
          <button
            type="button"
            onClick={clearFormat}
            title="Wyczyść formatowanie"
            className="px-2.5 h-7 rounded-full text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

function moveCaretToEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}
