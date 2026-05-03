"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { sanitizeRichHTML } from "./sanitize-rich";
import { pinScrollFor } from "./keep-scroll";

/**
 * Click-to-edit primitive that uses contentEditable instead of swapping to <input>.
 *
 * Why: an <input> element renders at a different intrinsic size than the surrounding
 * text and forces the layout to shift on edit. With contentEditable, the same
 * element that displays the text becomes editable in place — same font, same width,
 * same baseline, no flicker.
 *
 * Two modes:
 *  - PLAIN (default): textContent only. paste forced to plain text. Stored value
 *    is exactly what the trainer typed.
 *  - RICH: innerHTML with a sanitised allowlist (em, strong, span style="color:#hex",
 *    br). On text selection a small floating toolbar appears below the selection
 *    with three buttons — Akcent (wraps in colored span), Italic (em), Clear. The
 *    saved value is sanitised HTML; consumers render via dangerouslySetInnerHTML.
 *
 * Hard rules baked in:
 *  - maxLength enforced on textContent on every input event (HTML tags don't count).
 *  - numeric mode strips non-digits live (rich+numeric is rejected — makes no sense).
 *  - paste is forced to plain text — pasted formatting is stripped, trainer
 *    re-applies via toolbar if wanted.
 *  - Enter commits (single-line) or Ctrl/Cmd-Enter commits (multiline). Esc reverts.
 *  - No hover/focus highlight — caret blink is the only edit cue, per UX direction.
 */
type Theme = "light" | "dark";

type Props = {
  initial: string;
  maxLength: number;
  numeric?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  theme?: Theme;
  onCommit: (next: string) => void | Promise<void>;
  /** Render content as HTML (sanitised) and show a selection toolbar. */
  rich?: boolean;
  /** Color used for the Akcent toolbar button — typically the template's accent color. */
  accentColor?: string;
  /** CSS display:block on the editable for paragraph-like fields. */
  block?: boolean;
  autoFocus?: boolean;
  onAbort?: () => void;
};

export default function InlineEditable({
  initial,
  maxLength,
  numeric = false,
  multiline = false,
  placeholder,
  className = "",
  theme = "light",
  onCommit,
  rich = false,
  accentColor = "#10b981",
  block = false,
  autoFocus = false,
  onAbort,
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isDragging = useRef(false);
  const [, startTransition] = useTransition();
  const [toolbar, setToolbar] = useState<{ left: number; top: number } | null>(null);
  // SSR-safe portal target: only set after mount when document is available.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Mount: paint initial content via ref. We deliberately don't use children /
  // dangerouslySetInnerHTML on the editable: React would re-apply on every
  // render (e.g. when our toolbar state changes) and rebuild the DOM subtree,
  // which silently destroys the user's selection. With the content set via
  // ref, the DOM is owned by the user from then on.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (rich) {
      if (el.innerHTML !== initial) el.innerHTML = initial;
    } else if ((el.textContent ?? "") !== initial) {
      el.textContent = initial;
    }
    // mount-only — subsequent initial changes handled by the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync DOM when `initial` changes from the outside (e.g. router.refresh after
  // a save) — but never while the field is focused or we'd yank the caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (rich) {
      if (el.innerHTML !== initial) el.innerHTML = initial;
    } else if ((el.textContent ?? "") !== initial) {
      el.textContent = initial;
    }
  }, [initial, rich]);

  // Focus on mount when requested.
  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    moveCaretToEnd(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enforce = (el: HTMLElement) => {
    let text = el.textContent ?? "";
    let mutated = false;
    if (numeric) {
      const filtered = text.replace(/[^0-9]/g, "");
      if (filtered !== text) {
        text = filtered;
        mutated = true;
      }
    }
    if (text.length > maxLength) {
      text = text.slice(0, maxLength);
      mutated = true;
    }
    if (mutated) {
      // For rich text, replacing textContent strips formatting on the truncated
      // tail — acceptable since we're hitting an enforcement limit anyway.
      el.textContent = text;
      moveCaretToEnd(el);
    }
  };

  const onInput = (e: React.FormEvent<HTMLElement>) => {
    enforce(e.currentTarget);
  };

  const readValue = (el: HTMLElement): string => {
    if (rich) return sanitizeRichHTML(el.innerHTML.trim());
    return (el.textContent ?? "").trim();
  };

  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setToolbar(null);
    const value = readValue(el);
    if (value === initial.trim()) {
      // No change — restore exactly to avoid stray whitespace edits.
      if (rich) el.innerHTML = initial;
      else el.textContent = initial;
      onAbort?.();
      return;
    }
    // Pin scroll across the entire save round-trip. Many onCommit handlers
    // call router.refresh() directly (without our scroll-preserving hook),
    // which jumps the canvas. Doing it here covers EVERY inline edit across
    // EVERY editor wrapper for free, including Akcent applies that shift
    // text-flow when the span gets serialised.
    pinScrollFor(2000);
    startTransition(async () => {
      await onCommit(value);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      const el = e.currentTarget;
      if (rich) el.innerHTML = initial;
      else el.textContent = initial;
      el.blur();
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
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    if (ref.current) enforce(ref.current);
  };

  // ===== Selection toolbar (rich mode only) =====
  // Anchored to glyph baseline (rect.top + computed font-size × 1.05) so it
  // sits right under the letters regardless of line-height padding.
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
        glyphBottom = rect.top + fontSizePx * 1.05;
      }
    } catch {
      /* fallback to rect.bottom */
    }
    const top = Math.min(window.innerHeight - 48, glyphBottom + 6);
    const left = rect.left + rect.width / 2;
    return { top, left };
  };

  // selectionchange fires constantly during drag — only act when the trainer
  // has finished selecting (mouseup) or used the keyboard. While dragging we
  // hide the toolbar so it doesn't cover the text being selected.
  useEffect(() => {
    if (!rich) return;
    const onSelectionChange = () => {
      if (isDragging.current) {
        setToolbar(null);
        return;
      }
      const pos = computeToolbarPosition();
      setToolbar(pos);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [rich]);

  // Outside click → dismiss toolbar.
  useEffect(() => {
    if (!rich) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      const tb = document.getElementById(`rich-toolbar-${stableId.current}`);
      if (tb && tb.contains(target)) return;
      setToolbar(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [rich]);

  // Document-level mouseup catches the case where the user dragged past the
  // editable's bounds and released outside of it.
  useEffect(() => {
    if (!rich) return;
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setTimeout(() => setToolbar(computeToolbarPosition()), 0);
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [rich]);

  const stableId = useRef(`${Math.random().toString(36).slice(2, 9)}`);

  const onMouseDown = () => {
    if (!rich) return;
    isDragging.current = true;
    setToolbar(null);
  };

  // Toolbar actions —
  const applyAccent = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // execCommand("foreColor") is deprecated and in some Chromium builds
    // produces <font color="…"> tags that our sanitizer strips, so the accent
    // silently disappears on save. Manually wrap the current selection in
    // <span style="color: …"> instead — the sanitizer's allowlist permits
    // this exact shape, so it survives the round-trip.
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    if (!el.contains(range.commonAncestorContainer)) return;
    const span = document.createElement("span");
    span.style.color = accentColor;
    try {
      range.surroundContents(span);
    } catch {
      // surroundContents throws on selections that cross element boundaries
      // partially (e.g. half of an <em>). Fallback: extract contents into
      // the span, then insert the span back at the range position.
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    // Collapse selection to end of inserted span so the toolbar dismisses
    // and the caret sits naturally after the highlighted text.
    sel.removeAllRanges();
    const after = document.createRange();
    after.setStartAfter(span);
    after.collapse(true);
    sel.addRange(after);
    setToolbar(null);
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
    el.innerHTML = sanitizeRichHTML(el.innerHTML);
  };

  // Placeholder via :empty::before so plain-text fields show a ghost label
  // when blank. Skipped in rich mode — empty rich field is just empty content,
  // and the ::before pseudo would interfere with HTML structure.
  const phColor = theme === "dark" ? "before:text-white/30" : "before:text-slate-400";
  const placeholderClass = !rich && placeholder
    ? `empty:before:content-[attr(data-placeholder)] empty:before:italic ${phColor}`
    : "";

  return (
    <>
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? ""}
        onInput={onInput}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onMouseDown={onMouseDown}
        style={block ? { display: "block" } : undefined}
        className={`outline-none cursor-text ${multiline ? "whitespace-pre-wrap" : ""} ${placeholderClass} ${className}`}
        // No JSX children / dangerouslySetInnerHTML — see mount effect.
      />
      {rich && toolbar && portalTarget && createPortal(
        // Portal'd to document.body — otherwise this <div> would be a DOM
        // descendant of whatever parent the editable lives in (often <p> or
        // <h2>), which fails HTML5 validation and triggers React hydration
        // errors. Fixed positioning means we don't need to worry about
        // ancestor scroll/overflow contexts.
        <div
          id={`rich-toolbar-${stableId.current}`}
          style={{ position: "fixed", top: toolbar.top, left: toolbar.left, transform: "translateX(-50%)" }}
          className="z-[60] flex gap-1 rounded-full bg-[#0a0a0c] border border-white/15 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)] p-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={applyAccent}
            title="Akcent (kolor szablonu)"
            className="px-2.5 h-7 rounded-full text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-white/10 transition inline-flex items-center gap-1.5 text-white"
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
        </div>,
        portalTarget,
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
