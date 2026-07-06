"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import CollapsibleSection from "./CollapsibleSection";
import PreviewPane from "./PreviewPane";
import PublishToggle from "./PublishToggle";

export type EditorSection = {
  id: string;
  title: string;
  sub?: string;
  badge?: string;
  flush?: boolean;
  defaultOpen?: boolean;
  content: ReactNode;
};

/**
 * Two-pane OLX-style profile editor shell (slice 1.1 of the unified
 * /studio/profile editor):
 *
 *  - header: publish status (Opublikowany/Szkic toggle), "Podgląd
 *    publiczny" (new tab), "Zaawansowany edytor wyglądu" → /studio/design
 *  - left column (~560px): collapsible sections in public-profile order,
 *    server-composed content passed in as slots
 *  - right pane: live scaled preview of /trainers/[slug]?embed=1 that
 *    reloads when previewStamp changes (i.e. after any successful save)
 *  - <1024px: segmented Edycja/Podgląd switch, single column
 */
export default function ProfileEditorShell({
  slug,
  published,
  previewStamp,
  completionPct,
  completionItems,
  sections,
}: {
  slug: string;
  published: boolean;
  previewStamp: string;
  completionPct: number;
  completionItems: { label: string; done: boolean }[];
  sections: EditorSection[];
}) {
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const missing = completionItems.filter((i) => !i.done);

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-8 pt-4 pb-8">
      {/* ---- Header: status + actions -------------------------------- */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-[20px] font-semibold tracking-[-0.015em] text-slate-900 m-0">
          Profil publiczny
        </h1>
        <PublishToggle published={published} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a
            href={`/trainers/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium text-slate-700 border border-slate-200 bg-white hover:border-slate-400 transition"
          >
            Podgląd publiczny
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <path d="M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
          <Link
            href="/studio/design"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium text-white bg-slate-900 hover:bg-black transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            </svg>
            Zaawansowany edytor wyglądu
          </Link>
        </div>
      </div>

      {/* ---- Mobile: Edycja / Podgląd switch -------------------------- */}
      <div className="lg:hidden grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 mb-4">
        {(
          [
            { id: "edit", label: "Edycja" },
            { id: "preview", label: "Podgląd" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileView(t.id)}
            className={
              "h-9 rounded-lg text-[13px] font-semibold transition " +
              (mobileView === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Two panes ------------------------------------------------ */}
      <div className="lg:grid lg:grid-cols-[480px_minmax(0,1fr)] xl:grid-cols-[560px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {/* Left: sections column */}
        <div
          className={
            "min-w-0 space-y-3 " + (mobileView === "edit" ? "block" : "hidden") + " lg:block"
          }
        >
          {/* Completion summary (compact heir of the old side rail) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-slate-900">Profil ukończony</span>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-emerald-700">
                {completionPct}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            {missing.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {missing.map((m) => (
                  <span
                    key={m.label}
                    className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {sections.map((s) => (
            <CollapsibleSection
              key={s.id}
              id={s.id}
              title={s.title}
              sub={s.sub}
              badge={s.badge}
              flush={s.flush}
              defaultOpen={s.defaultOpen}
            >
              {s.content}
            </CollapsibleSection>
          ))}
        </div>

        {/* Right: live preview — sticky under the studio chrome
            (topbar h-16 + tabs row ≈ 112px when visible). */}
        <div
          className={
            "min-w-0 mt-4 lg:mt-0 lg:sticky lg:top-[124px] h-[calc(100dvh-230px)] lg:h-[calc(100vh-140px)] " +
            (mobileView === "preview" ? "block" : "hidden") +
            " lg:block"
          }
        >
          <PreviewPane src={`/trainers/${slug}?embed=1`} stamp={previewStamp} />
        </div>
      </div>
    </div>
  );
}
