"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addStudioCase,
  removeStudioCase,
  reorderStudioCases,
} from "./studio-copy-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor, useRefreshKeepingScroll } from "./keep-scroll";
import EditableCaseField from "./EditableCaseField";
import StudioCasePhotoUpload from "./StudioCasePhotoUpload";
import { usePreviewTransition } from "./preview-busy";
import PerItemAIPopover from "./PerItemAIPopover";
import { generateCaseVariants, applyCaseVariant } from "./ai-actions";
import type { StudioCaseStudy } from "@/types";

/**
 * Edit-mode renderer for the Studio "Wybrane case studies" section.
 *
 * Mirrors the optimistic pattern used by the services/packages editors:
 *   - Local `cases` state seeded from the server-rendered prop
 *   - Delete: filter local state instantly; server action fires in the
 *     background, rolls back on error
 *   - Reorder: swap local state instantly; server action fires in the
 *     background, rolls back on error
 *   - Add: awaits the server action (it generates the UUID + optionally
 *     seeds 3 defaults), then router.refresh — no optimistic add since we
 *     need the real UUID before rendering edit affordances on the new card
 *
 * Cards alternate (text/photo, photo/text). Photos cycle from the trainer's
 * gallery with stock fallbacks. Each text field on the card is inline-edited
 * via EditableCaseField → updateStudioCaseField → the case object's keys.
 */

const FALLBACK_PORTRAIT =
  "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&h=1000&fit=crop&crop=faces";
const FALLBACK_GALLERY = [
  "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=700&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=500&fit=crop",
];

export default function StudioCasesEditor({
  initialCases,
  galleryPhotos,
  casesNeverSet,
}: {
  initialCases: StudioCaseStudy[];
  galleryPhotos: string[];
  /** True when `studioCopy.cases` has NEVER been written for this page (i.e.
   *  the field is `undefined`, not `[]`). Distinguishes "fresh trainer who
   *  hasn't touched the section" from "trainer who explicitly deleted all
   *  their cases". The first triggers an auto-seed of 3 example cases on
   *  mount; the second leaves the empty array alone so the trainer doesn't
   *  fight the editor. */
  casesNeverSet: boolean;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();
  const [cases, setCases] = useState<StudioCaseStudy[]>(initialCases);
  const [adding, startAddTransition] = usePreviewTransition();
  const [aiCaseId, setAiCaseId] = useState<string | null>(null);
  const aiBtnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Content-aware so AI rewrites surface even when id list is unchanged.
  const seedKey = initialCases
    .map((c) => `${c.id}:${c.tag ?? ""}:${c.title ?? ""}:${c.body ?? ""}:${c.stat1 ?? ""}:${c.stat2 ?? ""}:${c.stat3 ?? ""}`)
    .join("|");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setCases(initialCases);
  }, [seedKey, initialCases]);

  // First-visit auto-seed. When the trainer opens the editor for the first
  // time and `cases` has never been initialised, populate it with 3 example
  // case studies so the section lands non-empty (matches the original Studio
  // design). Fires exactly once per mount; further opens see the saved array
  // and skip seeding entirely. Skipped if the trainer has already explicitly
  // deleted all their cases (`cases: []` → `casesNeverSet === false`).
  const didAutoSeedRef = useRef(false);
  useEffect(() => {
    if (didAutoSeedRef.current) return;
    didAutoSeedRef.current = true;
    if (!casesNeverSet) return;
    if (initialCases.length > 0) return;
    addStudioCase(pageId).then((res) => {
      if ("error" in res) {
        console.warn("Studio cases auto-seed failed:", res.error);
        return;
      }
      router.refresh();
    });
  }, [casesNeverSet, initialCases, pageId, router]);

  const onAdd = () => {
    startAddTransition(async () => {
      const res = await addStudioCase(pageId);
      if ("error" in res) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const onDelete = (id: string, name: string) => {
    // Pin scroll BEFORE the optimistic state update — React's reconcile of
    // the cases list reorders DOM nodes, which shifts the browser's scroll
    // anchor. Pinning first locks scrollTop through the whole sequence:
    // optimistic remove → server roundtrip → router.refresh → imperative
    // section reorder useEffect in EditorClient.
    pinScrollFor(1500);
    const prev = cases;
    setCases((c) => c.filter((x) => x.id !== id)); // instant UI
    removeStudioCase(id, pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setCases(prev); // rollback
      } else {
        refreshKeepingScroll();
      }
    });
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = cases.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= cases.length) return;
    pinScrollFor(1500);
    const prev = cases;
    const next = [...cases];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setCases(next); // instant UI
    reorderStudioCases(next.map((c) => c.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setCases(prev); // rollback
      } else {
        refreshKeepingScroll();
      }
    });
  };

  return (
    <div className="grid gap-5">
      {cases.map((c, n) => {
        const reverse = n % 2 === 1;
        const fallbackPhoto =
          galleryPhotos[n + 1] ??
          galleryPhotos[n] ??
          FALLBACK_GALLERY[n % FALLBACK_GALLERY.length] ??
          FALLBACK_PORTRAIT;
        const isFirst = n === 0;
        const isLast = n === cases.length - 1;

        const body = (
          <div>
            <div
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.05em] uppercase mb-3"
              style={{ color: "#ff5722" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722]" />
              <EditableCaseField
                caseId={c.id}
                field="tag"
                initial={c.tag}
                defaultValue="Kategoria"
                placeholder="Kategoria"
                maxLength={50}
              />
            </div>
            <h3
              className="font-medium m-0 mb-3"
              style={{ fontSize: "clamp(22px, 2.6cqw, 36px)", letterSpacing: "-0.025em", lineHeight: 1.1 }}
            >
              <EditableCaseField
                caseId={c.id}
                field="title"
                initial={c.title}
                defaultValue="Tytuł case study."
                placeholder="Tytuł..."
                maxLength={200}
              />
            </h3>
            <p className="text-[15px] leading-[1.6] text-[#3d3d3a] m-0 mb-5">
              <EditableCaseField
                caseId={c.id}
                field="body"
                initial={c.body}
                defaultValue="Krótki opis — kontekst, plan, wynik."
                placeholder="Opis..."
                maxLength={500}
                multiline
                block
              />
            </p>
            <div className="flex gap-6 pt-5 border-t border-[#e8e6df] flex-wrap">
              {(
                [
                  ["stat1", "stat1Label"] as const,
                  ["stat2", "stat2Label"] as const,
                  ["stat3", "stat3Label"] as const,
                ]
              ).map(([sk, lk]) => (
                <div key={sk} className="min-w-[80px]">
                  <div
                    className="text-[24px] @[640px]:text-[28px] font-medium"
                    style={{ letterSpacing: "-0.02em", color: "#141413" }}
                  >
                    <EditableCaseField
                      caseId={c.id}
                      field={sk}
                      initial={c[sk]}
                      defaultValue="—"
                      placeholder="0"
                      maxLength={20}
                    />
                  </div>
                  <div className="text-[12px] text-[#77756f] mt-0.5">
                    <EditableCaseField
                      caseId={c.id}
                      field={lk}
                      initial={c[lk]}
                      defaultValue="Wskaźnik"
                      placeholder="Etykieta"
                      maxLength={40}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

        const photoEl = (
          <StudioCasePhotoUpload
            caseId={c.id}
            current={c.photo}
            currentFocal={c.photoFocal}
            hidden={c.photoHidden}
            fallback={fallbackPhoto}
            alt={c.title ?? c.tag ?? ""}
          />
        );

        return (
          <div
            key={c.id}
            className={`group relative bg-white border border-[#e8e6df] rounded-[28px] p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${
              reverse ? "@[1024px]:grid-cols-[1.2fr_1fr]" : "@[1024px]:grid-cols-[1fr_1.2fr]"
            } hover:border-[#141413] transition`}
          >
            {/* Hover-only control cluster — top-right. ↑/↓ reorder, 🗑 delete. */}
            <div className={`absolute top-4 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition ${reverse ? "right-4" : "left-4"}`}>
              <button
                type="button"
                onClick={() => onMove(c.id, -1)}
                disabled={isFirst}
                title="Przesuń w górę"
                className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-[#ff5722] hover:border-[#ff5722]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onMove(c.id, 1)}
                disabled={isLast}
                title="Przesuń w dół"
                className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-[#ff5722] hover:border-[#ff5722]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </button>
              <button
                ref={(el) => {
                  aiBtnRefs.current.set(c.id, el);
                }}
                type="button"
                onClick={() => setAiCaseId(c.id)}
                title="Przepisz AI"
                className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-400/60 transition text-base"
              >
                ✨
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id, c.title ?? c.tag ?? "")}
                title="Usuń case study"
                className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-red-600 hover:border-red-600/40 transition"
              >
                🗑
              </button>
            </div>
            <PerItemAIPopover
              open={aiCaseId === c.id}
              onClose={() => setAiCaseId(null)}
              itemLabel="kejs"
              currentTitle={c.title ?? c.tag ?? ""}
              onGenerate={(p) => generateCaseVariants(c.id, p)}
              onApply={(v) =>
                applyCaseVariant(c.id, {
                  tag: String(v.tag ?? ""),
                  title: String(v.title ?? ""),
                  body: String(v.body ?? ""),
                  stat1: String(v.stat1 ?? ""),
                  stat1Label: String(v.stat1Label ?? ""),
                  stat2: String(v.stat2 ?? ""),
                  stat2Label: String(v.stat2Label ?? ""),
                  stat3: String(v.stat3 ?? ""),
                  stat3Label: String(v.stat3Label ?? ""),
                })
              }
              renderVariantPreview={(v) => (
                <div className="grid gap-2">
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#ff5722]">
                    {String(v.tag ?? "")}
                  </div>
                  <div className="text-[15px] font-medium tracking-[-0.015em] text-[#141413]">
                    {String(v.title ?? "")}
                  </div>
                  <div className="text-[12.5px] text-[#3d3d3a] leading-[1.5]">
                    {String(v.body ?? "")}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      [v.stat1, v.stat1Label],
                      [v.stat2, v.stat2Label],
                      [v.stat3, v.stat3Label],
                    ].map(([val, lab], i) => (
                      <div key={i} className="text-[10.5px]">
                        <div className="text-[14px] font-semibold text-[#141413]">
                          {String(val ?? "")}
                        </div>
                        <div className="text-[#77756f]">{String(lab ?? "")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />
            {reverse ? (<>{photoEl}{body}</>) : (<>{body}{photoEl}</>)}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        className="bg-white border-2 border-dashed border-[#ff5722]/30 rounded-[28px] p-8 flex flex-col items-center justify-center gap-3 min-h-[180px] text-[#ff5722] hover:border-[#ff5722] hover:bg-[#ffeadb]/40 transition disabled:opacity-60"
      >
        <span className="text-4xl leading-none">+</span>
        <span className="text-[13px] font-semibold tracking-[0.04em] uppercase">
          {adding
            ? "Dodaję..."
            : cases.length === 0
              ? "Wypełnij 3 przykładami"
              : "Dodaj case study"}
        </span>
      </button>
    </div>
  );
}
