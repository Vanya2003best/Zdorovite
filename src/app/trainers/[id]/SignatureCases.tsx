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
 * Signature-styled case studies. Same shared `studioCopy.cases` data, rendered
 * in Signature chrome: cream `#f6f1ea` bg, burgundy `#7d1f1f` accent, mono
 * `§` labels, manifesto-leaning typographic rhythm. Each case is a "Studium
 * klienta" stack: mono uppercase TAG, large headline, mono "case file" stat
 * row, and a small photo card on the right (or left, alternating). Body sits
 * narrow under the headline like a signed letter.
 */

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=900&fit=crop";

export default function SignatureCases({
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
      <SignatureCasesEditor
        initialCases={cases}
        galleryPhotos={galleryPhotos}
        casesNeverSet={casesNeverSet}
      />
    );
  }
  return <SignatureCasesView cases={cases} galleryPhotos={galleryPhotos} />;
}

function SignatureCasesView({
  cases,
  galleryPhotos,
}: {
  cases: StudioCaseStudy[];
  galleryPhotos: string[];
}) {
  if (cases.length === 0) return null;
  return (
    <div className="grid gap-5">
      {cases.map((c, n) => (
        <SignatureCaseCard
          key={c.id}
          caseData={c}
          index={n}
          fallbackPhoto={galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO}
        />
      ))}
    </div>
  );
}

function SignatureCaseCard({
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
  const fileNumber = `№ ${String(index + 1).padStart(2, "0")}`;

  return (
    <article className={`bg-white border border-[#cfc3b0] rounded-sm p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${reverse ? "@[1024px]:grid-cols-[1fr_1.2fr]" : "@[1024px]:grid-cols-[1.2fr_1fr]"} shadow-[0_2px_0_rgba(26,22,19,0.02)]`}>
      <div className={reverse ? "@[1024px]:order-2" : ""}>
        <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.22em] uppercase mb-3.5 flex items-center gap-3 flex-wrap">
          <span className="text-[#7d1f1f]">{`§ ${String(index + 1).padStart(2, "0")} · Studium klienta`}</span>
          <span className="hidden @[640px]:block w-6 h-px bg-[#cfc3b0]" />
          <span className="hidden @[640px]:inline" dangerouslySetInnerHTML={{ __html: tagText }} />
        </div>
        <h3
          className="font-normal m-0 mb-4 text-[#1a1613]"
          style={{ fontSize: "clamp(24px, 3.4cqw, 42px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
          dangerouslySetInnerHTML={{ __html: titleHTML }}
        />
        <p
          className="text-[15px] leading-[1.6] text-[#3d362f] m-0 mb-5 tracking-[-0.005em]"
          dangerouslySetInnerHTML={{ __html: c.body ?? "" }}
        />
        {stats.length > 0 && (
          <div className="border-y border-[#cfc3b0] py-4 grid grid-cols-3 gap-3">
            {stats.map(([v, l], i) => (
              <div key={i}>
                <div className="font-mono text-[10px] text-[#7d1f1f] tracking-[0.2em] uppercase mb-1">
                  {`Akta ${i + 1}`}
                </div>
                <div
                  className="font-medium text-[#1a1613]"
                  style={{ fontSize: "clamp(18px, 2.2cqw, 24px)", letterSpacing: "-0.015em", lineHeight: 1.05 }}
                  dangerouslySetInnerHTML={{ __html: v }}
                />
                <div
                  className="text-[11.5px] text-[#7d7268] mt-1"
                  dangerouslySetInnerHTML={{ __html: l }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {photoSrc && (
        <div className={reverse ? "@[1024px]:order-1" : ""}>
          <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-[#ede4d6] shadow-[0_20px_40px_-20px_rgba(26,22,19,0.3)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={c.title ?? c.tag ?? ""}
              className="w-full h-full object-cover"
              style={{ objectPosition: c.photoFocal ?? "center" }}
            />
            <div className="absolute top-3 left-3 bg-[#1a1613]/85 backdrop-blur-md text-[#ede4d6] px-2.5 py-1.5 rounded-sm pointer-events-none">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#a68b5b] mb-0.5">
                Studium · {fileNumber}
              </div>
              <div className="text-[11.5px] font-medium tracking-[-0.005em]" dangerouslySetInnerHTML={{ __html: tagText }} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function SignatureCasesEditor({
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
      if ("error" in res) console.warn("Signature cases auto-seed failed:", res.error);
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
    <div className="grid gap-5">
      {cases.map((c, n) => {
        const reverse = n % 2 === 1;
        const isFirst = n === 0;
        const isLast = n === cases.length - 1;
        const fallbackPhoto = galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO;
        const fileNumber = `№ ${String(n + 1).padStart(2, "0")}`;

        const body = (
          <div>
            <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.22em] uppercase mb-3.5 flex items-center gap-3 flex-wrap">
              <span className="text-[#7d1f1f]">{`§ ${String(n + 1).padStart(2, "0")} · Studium klienta`}</span>
              <span className="hidden @[640px]:block w-6 h-px bg-[#cfc3b0]" />
              <span className="hidden @[640px]:inline">
                <EditableCaseField
                  caseId={c.id}
                  field="tag"
                  initial={c.tag}
                  defaultValue="Kategoria"
                  placeholder="Kategoria..."
                  maxLength={50}
                  accentColor="#7d1f1f"
                />
              </span>
            </div>
            <h3
              className="font-normal m-0 mb-4 text-[#1a1613]"
              style={{ fontSize: "clamp(24px, 3.4cqw, 42px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
            >
              <EditableCaseField
                caseId={c.id}
                field="title"
                initial={c.title}
                defaultValue="Tytuł studium."
                placeholder="Tytuł..."
                maxLength={200}
                accentColor="#7d1f1f"
              />
            </h3>
            <p className="text-[15px] leading-[1.6] text-[#3d362f] m-0 mb-5 tracking-[-0.005em]">
              <EditableCaseField
                caseId={c.id}
                field="body"
                initial={c.body}
                defaultValue="Krótki opis: kontekst, plan, wynik."
                placeholder="Opis..."
                maxLength={500}
                multiline
                block
                accentColor="#7d1f1f"
              />
            </p>
            <div className="border-y border-[#cfc3b0] py-4 grid grid-cols-3 gap-3">
              {([
                ["stat1", "stat1Label"] as const,
                ["stat2", "stat2Label"] as const,
                ["stat3", "stat3Label"] as const,
              ]).map(([sk, lk], i) => (
                <div key={sk}>
                  <div className="font-mono text-[10px] text-[#7d1f1f] tracking-[0.2em] uppercase mb-1">
                    {`Akta ${i + 1}`}
                  </div>
                  <div
                    className="font-medium text-[#1a1613]"
                    style={{ fontSize: "clamp(18px, 2.2cqw, 24px)", letterSpacing: "-0.015em", lineHeight: 1.05 }}
                  >
                    <EditableCaseField
                      caseId={c.id}
                      field={sk}
                      initial={c[sk]}
                      defaultValue="—"
                      placeholder="0"
                      maxLength={20}
                      accentColor="#7d1f1f"
                    />
                  </div>
                  <div className="text-[11.5px] text-[#7d7268] mt-1">
                    <EditableCaseField
                      caseId={c.id}
                      field={lk}
                      initial={c[lk]}
                      defaultValue="Wskaźnik"
                      placeholder="Etykieta"
                      maxLength={40}
                      accentColor="#7d1f1f"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

        const photoEl = (
          <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-[#ede4d6] shadow-[0_20px_40px_-20px_rgba(26,22,19,0.3)]">
            <StudioCasePhotoUpload
              caseId={c.id}
              current={c.photo}
              currentFocal={c.photoFocal}
              hidden={c.photoHidden}
              fallback={fallbackPhoto}
              alt={c.title ?? c.tag ?? ""}
            />
            <div className="absolute top-3 left-3 bg-[#1a1613]/85 backdrop-blur-md text-[#ede4d6] px-2.5 py-1.5 rounded-sm pointer-events-none">
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#a68b5b] mb-0.5">
                Studium · {fileNumber}
              </div>
              <div className="text-[11.5px] font-medium tracking-[-0.005em]" dangerouslySetInnerHTML={{ __html: c.tag ?? "Studium" }} />
            </div>
          </div>
        );

        return (
          <article
            key={c.id}
            className={`group relative bg-white border border-[#cfc3b0] rounded-sm p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${reverse ? "@[1024px]:grid-cols-[1fr_1.2fr]" : "@[1024px]:grid-cols-[1.2fr_1fr]"} shadow-[0_2px_0_rgba(26,22,19,0.02)] hover:border-[#7d1f1f]/40 transition`}
          >
            <div className={`absolute top-0 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition ${reverse ? "right-0" : "left-0"}`}>
              <button
                type="button"
                onClick={() => onMove(c.id, -1)}
                disabled={isFirst}
                title="Przesuń w górę"
                className="w-8 h-8 rounded-sm bg-white border border-[#cfc3b0] text-[#7d7268] inline-flex items-center justify-center hover:text-[#7d1f1f] hover:border-[#7d1f1f]/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-sm bg-white border border-[#cfc3b0] text-[#7d7268] inline-flex items-center justify-center hover:text-[#7d1f1f] hover:border-[#7d1f1f]/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-sm bg-white border border-[#cfc3b0] text-[#7d7268] inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-400/60 transition text-base"
              >
                ✨
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id, c.title ?? c.tag ?? "")}
                title="Usuń studium"
                className="w-8 h-8 rounded-sm bg-white border border-[#cfc3b0] text-[#7d7268] inline-flex items-center justify-center hover:text-red-700 hover:border-red-700/40 transition"
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
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#7d1f1f]">
                    {String(v.tag ?? "")}
                  </div>
                  <div className="text-[16px] tracking-[-0.02em] font-normal text-slate-900">
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
                        <div className="text-[14px] font-normal text-slate-900">
                          {String(val ?? "")}
                        </div>
                        <div className="font-mono uppercase tracking-[0.1em] text-[#7d7268]">
                          {String(lab ?? "")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />
            {/* DOM order is always body → photo so mobile (single column) shows
                text first, image second. Desktop two-column layout swaps via
                @[1024px]:order on alternating cases. */}
            <div className={reverse ? "@[1024px]:order-2" : ""}>{body}</div>
            <div className={reverse ? "@[1024px]:order-1" : ""}>{photoEl}</div>
          </article>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        className="border border-dashed border-[#7d1f1f]/30 rounded-sm p-12 flex flex-col items-center justify-center gap-3 min-h-[180px] text-[#7d1f1f] hover:border-[#7d1f1f] hover:bg-white/60 transition disabled:opacity-60"
      >
        <span className="text-3xl leading-none font-light">+</span>
        <span className="font-mono text-[11px] tracking-[0.22em] uppercase">
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
