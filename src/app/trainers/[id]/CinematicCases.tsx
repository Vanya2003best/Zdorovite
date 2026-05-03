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
 * Cinematic-styled case studies. Same data + same server actions as the
 * Studio version (one shared `studioCopy.cases` array under the hood) but
 * rendered in Cinematic chrome: dark `#0a0a0c` bg, lime `#d4ff00` accents,
 * mono labels, Geist Sans 500-weight headlines with italic accents on the
 * last word, photos full-bleed on alternating sides.
 *
 * Editor mode mirrors StudioCasesEditor: optimistic local state for
 * add/remove/reorder, hover ↑/↓/🗑 cluster, "+ Dodaj" tile at the end.
 * Auto-seeds 3 example cases on first mount when `casesNeverSet` so the
 * section lands populated.
 */

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=900&fit=crop";

export default function CinematicCases({
  cases,
  galleryPhotos,
  casesNeverSet,
  editMode,
}: {
  cases: StudioCaseStudy[];
  galleryPhotos: string[];
  casesNeverSet: boolean;
  editMode: boolean;
}) {
  if (editMode) {
    return (
      <CinematicCasesEditor
        initialCases={cases}
        galleryPhotos={galleryPhotos}
        casesNeverSet={casesNeverSet}
      />
    );
  }
  return <CinematicCasesView cases={cases} galleryPhotos={galleryPhotos} />;
}

function CinematicCasesView({
  cases,
  galleryPhotos,
}: {
  cases: StudioCaseStudy[];
  galleryPhotos: string[];
}) {
  if (cases.length === 0) return null;
  return (
    <div className="px-6 sm:px-12 grid gap-5">
      {cases.map((c, n) => (
        <CinematicCaseCard
          key={c.id}
          caseData={c}
          index={n}
          fallbackPhoto={galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO}
        />
      ))}
    </div>
  );
}

function CinematicCaseCard({
  caseData: c,
  index,
  fallbackPhoto,
}: {
  caseData: StudioCaseStudy;
  index: number;
  fallbackPhoto: string;
}) {
  const reverse = index % 2 === 1;
  const tagText = c.tag ?? "Studium";
  const titleHTML = c.title ?? "Bez tytułu.";

  const stats: Array<[string, string]> = [
    [c.stat1 ?? "—", c.stat1Label ?? ""],
    [c.stat2 ?? "—", c.stat2Label ?? ""],
    [c.stat3 ?? "—", c.stat3Label ?? ""],
  ].filter(([v, l]) => v.trim() !== "—" || l.trim() !== "") as Array<[string, string]>;

  const photoSrc = c.photoHidden ? null : (c.photo || fallbackPhoto);

  return (
    <div className={`bg-white/[0.04] border border-white/10 rounded-sm p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${reverse ? "@[1024px]:grid-cols-[1fr_1.2fr]" : "@[1024px]:grid-cols-[1.2fr_1fr]"}`}>
      <div className={reverse ? "@[1024px]:order-2" : ""}>
        {/* Eyebrow — chapter index + tag, mono */}
        <div className="font-mono text-[11px] text-[#d4ff00] tracking-[0.22em] uppercase mb-4 inline-flex items-center gap-3 flex-wrap">
          <span className="text-white/40">{`Studium ${String(index + 1).padStart(2, "0")}`}</span>
          <span className="w-6 h-px bg-[#d4ff00]/50" />
          <span dangerouslySetInnerHTML={{ __html: tagText }} />
        </div>
        <h3
          className="font-medium text-white m-0 mb-4"
          style={{ fontSize: "clamp(22px, 3cqw, 38px)", lineHeight: 1.1, letterSpacing: "-0.025em" }}
          dangerouslySetInnerHTML={{ __html: titleHTML }}
        />
        <p
          className="text-[15px] leading-[1.6] text-white/70 m-0 mb-6 tracking-[-0.005em]"
          dangerouslySetInnerHTML={{ __html: c.body ?? "" }}
        />
        {stats.length > 0 && (
          <div className="flex gap-6 flex-wrap pt-5 border-t border-white/10">
            {stats.map(([v, l], i) => (
              <div key={i} className="min-w-[80px]">
                <div
                  className="font-medium text-[#d4ff00]"
                  style={{ fontSize: "clamp(22px, 2.4cqw, 28px)", letterSpacing: "-0.02em", lineHeight: 1 }}
                  dangerouslySetInnerHTML={{ __html: v }}
                />
                <div
                  className="font-mono text-[10.5px] text-white/50 tracking-[0.14em] uppercase mt-2"
                  dangerouslySetInnerHTML={{ __html: l }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {photoSrc && (
        <div className={reverse ? "@[1024px]:order-1" : ""}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={c.title ?? c.tag ?? ""}
              className="w-full h-full object-cover"
              style={{ objectPosition: c.photoFocal ?? "center", filter: "saturate(0.92) contrast(1.04)" }}
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
          </div>
        </div>
      )}
    </div>
  );
}

function CinematicCasesEditor({
  initialCases,
  galleryPhotos,
  casesNeverSet,
}: {
  initialCases: StudioCaseStudy[];
  galleryPhotos: string[];
  casesNeverSet: boolean;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();
  const [cases, setCases] = useState<StudioCaseStudy[]>(initialCases);
  const [adding, startAddTransition] = usePreviewTransition();
  const [aiCaseId, setAiCaseId] = useState<string | null>(null);
  const aiBtnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const seedKey = initialCases
    .map((c) => `${c.id}:${c.tag ?? ""}:${c.title ?? ""}:${c.body ?? ""}:${c.stat1 ?? ""}:${c.stat2 ?? ""}:${c.stat3 ?? ""}`)
    .join("|");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setCases(initialCases);
  }, [seedKey, initialCases]);

  const didAutoSeedRef = useRef(false);
  useEffect(() => {
    if (didAutoSeedRef.current) return;
    didAutoSeedRef.current = true;
    if (!casesNeverSet) return;
    if (initialCases.length > 0) return;
    addStudioCase(pageId).then((res) => {
      if ("error" in res) console.warn("Cinematic cases auto-seed failed:", res.error);
      else router.refresh();
    });
  }, [casesNeverSet, initialCases, pageId, router]);

  const onAdd = () => {
    startAddTransition(async () => {
      const res = await addStudioCase(pageId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  };

  const onDelete = (id: string, name: string) => {
    pinScrollFor(1500);
    const prev = cases;
    setCases((c) => c.filter((x) => x.id !== id));
    removeStudioCase(id, pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setCases(prev);
      } else refreshKeepingScroll();
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
    setCases(next);
    reorderStudioCases(next.map((c) => c.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setCases(prev);
      } else refreshKeepingScroll();
    });
  };

  return (
    <div className="px-6 sm:px-12 grid gap-5">
      {cases.map((c, n) => {
        const reverse = n % 2 === 1;
        const isFirst = n === 0;
        const isLast = n === cases.length - 1;
        const fallbackPhoto = galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO;

        const body = (
          <div>
            <div className="font-mono text-[11px] text-[#d4ff00] tracking-[0.22em] uppercase mb-4 inline-flex items-center gap-3">
              <span className="text-white/40">{`Studium ${String(n + 1).padStart(2, "0")}`}</span>
              <span className="w-6 h-px bg-[#d4ff00]/50" />
              <EditableCaseField
                caseId={c.id}
                field="tag"
                initial={c.tag}
                defaultValue="Kategoria"
                placeholder="Kategoria..."
                maxLength={50}
                theme="dark"
                accentColor="#d4ff00"
              />
            </div>
            <h3
              className="font-medium text-white m-0 mb-5"
              style={{ fontSize: "clamp(26px, 3.6cqw, 48px)", lineHeight: 1.05, letterSpacing: "-0.025em" }}
            >
              <EditableCaseField
                caseId={c.id}
                field="title"
                initial={c.title}
                defaultValue="Tytuł studium."
                placeholder="Tytuł..."
                maxLength={200}
                theme="dark"
                accentColor="#d4ff00"
              />
            </h3>
            <p className="text-[15px] sm:text-[17px] leading-[1.6] text-white/70 m-0 mb-7 tracking-[-0.005em]">
              <EditableCaseField
                caseId={c.id}
                field="body"
                initial={c.body}
                defaultValue="Krótki opis: kontekst, plan, wynik."
                placeholder="Opis..."
                maxLength={500}
                multiline
                block
                theme="dark"
                accentColor="#d4ff00"
              />
            </p>
            <div className="flex gap-8 flex-wrap pt-6 border-t border-white/10">
              {([
                ["stat1", "stat1Label"] as const,
                ["stat2", "stat2Label"] as const,
                ["stat3", "stat3Label"] as const,
              ]).map(([sk, lk]) => (
                <div key={sk} className="min-w-[100px]">
                  <div
                    className="font-medium text-[#d4ff00]"
                    style={{ fontSize: "clamp(24px, 2.6cqw, 32px)", letterSpacing: "-0.02em", lineHeight: 1 }}
                  >
                    <EditableCaseField
                      caseId={c.id}
                      field={sk}
                      initial={c[sk]}
                      defaultValue="—"
                      placeholder="0"
                      maxLength={20}
                      theme="dark"
                      accentColor="#d4ff00"
                    />
                  </div>
                  <div className="font-mono text-[10.5px] text-white/50 tracking-[0.14em] uppercase mt-2">
                    <EditableCaseField
                      caseId={c.id}
                      field={lk}
                      initial={c[lk]}
                      defaultValue="Wskaźnik"
                      placeholder="Etykieta"
                      maxLength={40}
                      theme="dark"
                      accentColor="#d4ff00"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

        const photoEl = (
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-white/[0.03]">
            <StudioCasePhotoUpload
              caseId={c.id}
              current={c.photo}
              currentFocal={c.photoFocal}
              hidden={c.photoHidden}
              fallback={fallbackPhoto}
              alt={c.title ?? c.tag ?? ""}
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
          </div>
        );

        return (
          <div
            key={c.id}
            className={`group relative bg-white/[0.04] border border-white/10 rounded-sm p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${reverse ? "@[1024px]:grid-cols-[1fr_1.2fr]" : "@[1024px]:grid-cols-[1.2fr_1fr]"} hover:border-[#d4ff00]/30 transition`}
          >
            {/* Hover-only ↑/↓/🗑 cluster — top-right of the case block. Always
                on the side opposite the photo so it doesn't fight the photo
                upload chips. */}
            <div className={`absolute top-0 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition ${reverse ? "right-0" : "left-0"}`}>
              <button
                type="button"
                onClick={() => onMove(c.id, -1)}
                disabled={isFirst}
                title="Przesuń w górę"
                className="w-8 h-8 rounded-full bg-[#0a0a0c]/85 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-full bg-[#0a0a0c]/85 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-full bg-[#0a0a0c]/85 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-violet-300 hover:border-violet-300/60 transition text-base"
              >
                ✨
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id, c.title ?? c.tag ?? "")}
                title="Usuń studium"
                className="w-8 h-8 rounded-full bg-[#0a0a0c]/85 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-red-400 hover:border-red-400/40 transition"
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
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#d4ff00]">
                    {String(v.tag ?? "")}
                  </div>
                  <div className="text-[16px] tracking-[-0.02em] font-medium text-slate-900">
                    {String(v.title ?? "")}
                  </div>
                  <div className="text-[12.5px] text-slate-700 leading-[1.5]">
                    {String(v.body ?? "")}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      [v.stat1, v.stat1Label],
                      [v.stat2, v.stat2Label],
                      [v.stat3, v.stat3Label],
                    ].map(([val, lab], i) => (
                      <div key={i} className="text-[10.5px]">
                        <div className="text-[14px] font-medium text-slate-900">
                          {String(val ?? "")}
                        </div>
                        <div className="font-mono uppercase tracking-[0.1em] text-slate-500">
                          {String(lab ?? "")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />
            {/* DOM order body → photo so mobile shows text first; desktop
                alternates via @[1024px]:order on the wrappers. */}
            <div className={reverse ? "@[1024px]:order-2" : ""}>{body}</div>
            <div className={reverse ? "@[1024px]:order-1" : ""}>{photoEl}</div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        className="border-2 border-dashed border-[#d4ff00]/25 rounded-sm p-10 flex flex-col items-center justify-center gap-3 min-h-[180px] text-[#d4ff00]/80 hover:border-[#d4ff00] hover:bg-[#d4ff00]/[0.04] hover:text-[#d4ff00] transition disabled:opacity-60"
      >
        <span className="text-4xl leading-none">+</span>
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase">
          {adding
            ? "Dodaję..."
            : cases.length === 0
              ? "Wypełnij 3 przykładami"
              : "Dodaj studium"}
        </span>
      </button>
    </div>
  );
}
