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
 * Premium-styled case studies. Same shared `studioCopy.cases` data + actions,
 * rendered as clean rounded cards on a soft slate gradient: photo on top,
 * content below with rounded stat chips. Tag becomes a small emerald pill,
 * title is sans-serif semibold, body is comfortable line-height. Cards are
 * laid out in a 2-col masonry-ish grid with the first card spanning both
 * columns to anchor the section.
 */

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=900&fit=crop";

export default function PremiumCases({
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
      <PremiumCasesEditor
        initialCases={cases}
        galleryPhotos={galleryPhotos}
        casesNeverSet={casesNeverSet}
      />
    );
  }
  return <PremiumCasesView cases={cases} galleryPhotos={galleryPhotos} />;
}

function PremiumCasesView({
  cases,
  galleryPhotos,
}: {
  cases: StudioCaseStudy[];
  galleryPhotos: string[];
}) {
  if (cases.length === 0) return null;
  return (
    <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
      {cases.map((c, n) => (
        <PremiumCaseCard
          key={c.id}
          caseData={c}
          index={n}
          fallbackPhoto={galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO}
          spanFull={n === 0 && cases.length > 1}
        />
      ))}
    </div>
  );
}

function PremiumCaseCard({
  caseData: c,
  fallbackPhoto,
  spanFull,
}: {
  caseData: StudioCaseStudy;
  index: number;
  fallbackPhoto: string;
  spanFull: boolean;
}) {
  const tagText = c.tag ?? "Studium";
  const titleHTML = c.title ?? "Bez tytułu.";

  const stats: Array<[string, string]> = [
    [c.stat1 ?? "—", c.stat1Label ?? ""],
    [c.stat2 ?? "—", c.stat2Label ?? ""],
    [c.stat3 ?? "—", c.stat3Label ?? ""],
  ].filter(([v, l]) => v.trim() !== "—" || l.trim() !== "") as Array<[string, string]>;

  const photoSrc = c.photoHidden ? null : (c.photo || fallbackPhoto);

  return (
    <article className={`bg-white/80 backdrop-blur-sm border border-white/70 rounded-3xl overflow-hidden shadow-[0_30px_60px_-30px_rgba(2,6,23,0.18)] ${spanFull ? "sm:col-span-2" : ""}`}>
      {photoSrc && (
        <div className={`bg-slate-100 ${spanFull ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc}
            alt={c.title ?? c.tag ?? ""}
            className="w-full h-full object-cover"
            style={{ objectPosition: c.photoFocal ?? "center" }}
          />
        </div>
      )}
      <div className="p-6 sm:p-8">
        <span
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-medium tracking-tight"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span dangerouslySetInnerHTML={{ __html: tagText }} />
        </span>
        <h3
          className="font-semibold tracking-tight text-slate-900 m-0 mt-3 mb-3"
          style={{ fontSize: spanFull ? "clamp(24px, 3cqw, 36px)" : "clamp(20px, 2.4cqw, 26px)", lineHeight: 1.15 }}
          dangerouslySetInnerHTML={{ __html: titleHTML }}
        />
        <p
          className="text-[14.5px] sm:text-[15.5px] leading-[1.65] text-slate-600 m-0 mb-5"
          dangerouslySetInnerHTML={{ __html: c.body ?? "" }}
        />
        {stats.length > 0 && (
          <div className="flex gap-2 flex-wrap pt-5 border-t border-slate-200/70">
            {stats.map(([v, l], i) => (
              <div key={i} className="inline-flex flex-col bg-slate-50 border border-slate-200/70 rounded-2xl px-3.5 py-2.5 min-w-[100px]">
                <span
                  className="text-emerald-700 font-semibold tracking-tight"
                  style={{ fontSize: "16.5px", lineHeight: 1.1 }}
                  dangerouslySetInnerHTML={{ __html: v }}
                />
                <span
                  className="text-[11px] text-slate-500 mt-0.5"
                  dangerouslySetInnerHTML={{ __html: l }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function PremiumCasesEditor({
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
      if ("error" in res) console.warn("Premium cases auto-seed failed:", res.error);
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
    <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
      {cases.map((c, n) => {
        const spanFull = n === 0 && cases.length > 1;
        const isFirst = n === 0;
        const isLast = n === cases.length - 1;
        const fallbackPhoto = galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO;

        return (
          <article
            key={c.id}
            className={`group relative bg-white/80 backdrop-blur-sm border border-white/70 rounded-3xl overflow-hidden shadow-[0_30px_60px_-30px_rgba(2,6,23,0.18)] ${spanFull ? "sm:col-span-2" : ""}`}
          >
            <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
              <button
                type="button"
                onClick={() => onMove(c.id, -1)}
                disabled={isFirst}
                title="Przesuń w górę"
                className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-slate-600 inline-flex items-center justify-center hover:text-emerald-700 hover:border-emerald-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-slate-600 inline-flex items-center justify-center hover:text-emerald-700 hover:border-emerald-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-slate-600 inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-300 transition text-base"
              >
                ✨
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id, c.title ?? c.tag ?? "")}
                title="Usuń studium"
                className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-slate-600 inline-flex items-center justify-center hover:text-red-600 hover:border-red-300 transition"
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
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    {String(v.tag ?? "")}
                  </div>
                  <div className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
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
                        <div className="text-[14px] font-semibold text-emerald-700">
                          {String(val ?? "")}
                        </div>
                        <div className="text-slate-500">{String(lab ?? "")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />

            <div className={`bg-slate-100 ${spanFull ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
              <StudioCasePhotoUpload
                caseId={c.id}
                current={c.photo}
                currentFocal={c.photoFocal}
                hidden={c.photoHidden}
                fallback={fallbackPhoto}
                alt={c.title ?? c.tag ?? ""}
              />
            </div>
            <div className="p-6 sm:p-8">
              <span
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-medium tracking-tight"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <EditableCaseField
                  caseId={c.id}
                  field="tag"
                  initial={c.tag}
                  defaultValue="Kategoria"
                  placeholder="Kategoria..."
                  maxLength={50}
                  accentColor="#10b981"
                />
              </span>
              <h3
                className="font-semibold tracking-tight text-slate-900 m-0 mt-3 mb-3"
                style={{ fontSize: spanFull ? "clamp(24px, 3cqw, 36px)" : "clamp(20px, 2.4cqw, 26px)", lineHeight: 1.15 }}
              >
                <EditableCaseField
                  caseId={c.id}
                  field="title"
                  initial={c.title}
                  defaultValue="Tytuł studium."
                  placeholder="Tytuł..."
                  maxLength={200}
                  accentColor="#10b981"
                />
              </h3>
              <p className="text-[14.5px] sm:text-[15.5px] leading-[1.65] text-slate-600 m-0 mb-5">
                <EditableCaseField
                  caseId={c.id}
                  field="body"
                  initial={c.body}
                  defaultValue="Krótki opis: kontekst, plan, wynik."
                  placeholder="Opis..."
                  maxLength={500}
                  multiline
                  block
                  accentColor="#10b981"
                />
              </p>
              <div className="flex gap-2 flex-wrap pt-5 border-t border-slate-200/70">
                {([
                  ["stat1", "stat1Label"] as const,
                  ["stat2", "stat2Label"] as const,
                  ["stat3", "stat3Label"] as const,
                ]).map(([sk, lk]) => (
                  <div key={sk} className="inline-flex flex-col bg-slate-50 border border-slate-200/70 rounded-2xl px-3.5 py-2.5 min-w-[100px]">
                    <span
                      className="text-emerald-700 font-semibold tracking-tight"
                      style={{ fontSize: "16.5px", lineHeight: 1.1 }}
                    >
                      <EditableCaseField
                        caseId={c.id}
                        field={sk}
                        initial={c[sk]}
                        defaultValue="—"
                        placeholder="0"
                        maxLength={20}
                        accentColor="#10b981"
                      />
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      <EditableCaseField
                        caseId={c.id}
                        field={lk}
                        initial={c[lk]}
                        defaultValue="Wskaźnik"
                        placeholder="Etykieta"
                        maxLength={40}
                        accentColor="#10b981"
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        className={`bg-white/60 border-2 border-dashed border-emerald-300 rounded-3xl p-10 flex flex-col items-center justify-center gap-2.5 min-h-[180px] text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50/40 transition disabled:opacity-60 ${cases.length === 0 ? "sm:col-span-2" : ""}`}
      >
        <span className="text-3xl leading-none">+</span>
        <span className="text-[12.5px] font-semibold tracking-tight">
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
