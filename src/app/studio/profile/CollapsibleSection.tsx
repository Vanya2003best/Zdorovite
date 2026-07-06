"use client";

import { useState, type ReactNode } from "react";

/**
 * Disclosure card for the left column of the two-pane profile editor.
 *
 * Two chrome modes:
 *  - default ("card"): the wrapper IS the section card — bordered,
 *    rounded, with a clickable header row. Existing forms render their
 *    own `<section class="rounded-2xl border …">` root, so the content
 *    area strips that chrome from direct `<section>` children to avoid
 *    a card-in-card look (forms stay untouched inside).
 *  - flush: for content that brings its own strong visual identity
 *    (AI-context violet box, Polityka card stack) — the wrapper renders
 *    only a card-styled header; the content shows below, unstyled.
 */
export default function CollapsibleSection({
  id,
  title,
  sub,
  badge,
  flush = false,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  badge?: string;
  flush?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-controls={`${id}-content`}
      className={
        "w-full flex items-center gap-3 text-left px-5 py-4 group " +
        (flush ? "rounded-2xl border border-slate-200 bg-white" : "")
      }
    >
      <div className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold tracking-[-0.005em] text-slate-900">
          {title}
        </span>
        {sub && (
          <span className="block text-[12px] text-slate-500 mt-0.5 leading-[1.5]">
            {sub}
          </span>
        )}
      </div>
      {badge && (
        <span className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-[5px] bg-slate-50 text-slate-600 border border-slate-200">
          {badge}
        </span>
      )}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={
          "shrink-0 text-slate-400 group-hover:text-slate-600 transition-transform " +
          (open ? "rotate-180" : "")
        }
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );

  // Content stays mounted when collapsed (hidden via CSS) so unsaved
  // form state survives an accidental toggle of the section header.
  if (flush) {
    return (
      <section id={id}>
        {header}
        <div id={`${id}-content`} className={open ? "mt-3" : "hidden"}>
          {children}
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white">
      {header}
      <div
        id={`${id}-content`}
        className={
          open
            ? "px-5 pb-5 [&>section]:border-0 [&>section]:bg-transparent [&>section]:rounded-none [&>section]:p-0"
            : "hidden"
        }
      >
        {children}
      </div>
    </section>
  );
}
