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
 * Luxury-styled case studies. Same shared `studioCopy.cases` data and the
 * same studio-copy-actions, rendered in Luxury chrome: ivory bg, gold
 * `#8a7346` accent, serif italic accents, Roman-numeral chapter eyebrows,
 * bordered photo frames with a 1px gold ring. Each case gets a "Studium I."
 * etc eyebrow + serif italic title + body + 3 stats laid out in a row with
 * subtle dividers. Photos alternate sides for the editorial spread feel.
 */

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=900&fit=crop";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export default function LuxuryCases({
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
      <LuxuryCasesEditor
        initialCases={cases}
        galleryPhotos={galleryPhotos}
        casesNeverSet={casesNeverSet}
      />
    );
  }
  return <LuxuryCasesView cases={cases} galleryPhotos={galleryPhotos} />;
}

function LuxuryCasesView({
  cases,
  galleryPhotos,
}: {
  cases: StudioCaseStudy[];
  galleryPhotos: string[];
}) {
  if (cases.length === 0) return null;
  return (
    <div className="grid gap-20 sm:gap-28">
      {cases.map((c, n) => (
        <LuxuryCaseCard
          key={c.id}
          caseData={c}
          index={n}
          fallbackPhoto={galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO}
        />
      ))}
    </div>
  );
}

function LuxuryCaseCard({
  caseData: c,
  index,
  fallbackPhoto,
}: {
  caseData: StudioCaseStudy;
  index: number;
  fallbackPhoto: string;
}) {
  const reverse = index % 2 === 1;
  const numeral = ROMAN[index] ?? `${index + 1}`;
  const tagText = c.tag ?? "Studium";
  const titleHTML = c.title ?? "Bez tytułu.";

  const stats: Array<[string, string]> = [
    [c.stat1 ?? "—", c.stat1Label ?? ""],
    [c.stat2 ?? "—", c.stat2Label ?? ""],
    [c.stat3 ?? "—", c.stat3Label ?? ""],
  ].filter(([v, l]) => v.trim() !== "—" || l.trim() !== "") as Array<[string, string]>;

  const photoSrc = c.photoHidden ? null : (c.photo || fallbackPhoto);

  return (
    <div className={`bg-[#fbf8f1] border border-[#d9cfb8] p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${reverse ? "@[1024px]:grid-cols-[1fr_1.2fr]" : "@[1024px]:grid-cols-[1.2fr_1fr]"}`}>
      <div className={reverse ? "@[1024px]:order-2" : ""}>
        <div className="text-[11px] sm:text-[12px] tracking-[0.22em] uppercase text-[#7a7365] mb-5 flex items-center gap-3 flex-wrap">
          <span className="font-serif italic text-[18px] sm:text-[20px] tracking-normal text-[#8a7346] normal-case leading-none">
            {`Studium ${numeral}.`}
          </span>
          <span className="w-8 h-px bg-[#8a7346]/50" />
          <span dangerouslySetInnerHTML={{ __html: tagText }} />
        </div>
        <h3
          className="font-serif font-normal m-0 mb-5 text-[#1c1a15]"
          style={{ fontSize: "clamp(24px, 3cqw, 40px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
          dangerouslySetInnerHTML={{ __html: titleHTML }}
        />
        <p
          className="text-[15px] leading-[1.65] text-[#3a3730] m-0 mb-6"
          dangerouslySetInnerHTML={{ __html: c.body ?? "" }}
        />
        {stats.length > 0 && (
          <div className="flex gap-8 flex-wrap pt-5 border-t border-[#d9cfb8]">
            {stats.map(([v, l], i) => (
              <div key={i} className="min-w-[90px]">
                <div
                  className="font-serif italic font-light text-[#1c1a15]"
                  style={{ fontSize: "clamp(22px, 2.4cqw, 30px)", letterSpacing: "-0.015em", lineHeight: 1 }}
                  dangerouslySetInnerHTML={{ __html: v }}
                />
                <div
                  className="text-[10.5px] sm:text-[11px] tracking-[0.2em] uppercase text-[#7a7365] mt-2"
                  dangerouslySetInnerHTML={{ __html: l }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {photoSrc && (
        <div className={reverse ? "@[1024px]:order-1" : ""}>
          <div className="relative aspect-[4/3] overflow-hidden bg-[#efe7d7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={c.title ?? c.tag ?? ""}
              className="w-full h-full object-cover"
              style={{ objectPosition: c.photoFocal ?? "center", filter: "saturate(0.88) contrast(1.02)" }}
            />
            <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_#c8bc9f]" />
          </div>
        </div>
      )}
    </div>
  );
}

function LuxuryCasesEditor({
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
  // Which case (if any) is currently in AI rewrite mode. Single-active so we
  // never have two popovers open at once.
  const [aiCaseId, setAiCaseId] = useState<string | null>(null);
  const aiBtnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Content-aware seed key — picks up AI rewrites that touch tag/title/body/
  // stats without changing the id list. Without including content fields, the
  // re-seed effect below stays inert and the case keeps showing pre-AI copy.
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
      if ("error" in res) console.warn("Luxury cases auto-seed failed:", res.error);
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
    <div className="grid gap-6">
      {cases.map((c, n) => {
        const reverse = n % 2 === 1;
        const isFirst = n === 0;
        const isLast = n === cases.length - 1;
        const numeral = ROMAN[n] ?? `${n + 1}`;
        const fallbackPhoto = galleryPhotos[n + 1] ?? galleryPhotos[n] ?? FALLBACK_PHOTO;

        const body = (
          <div>
            <div className="text-[11px] sm:text-[12px] tracking-[0.22em] uppercase text-[#7a7365] mb-5 flex items-center gap-3 flex-wrap">
              <span className="font-serif italic text-[18px] sm:text-[20px] tracking-normal text-[#8a7346] normal-case leading-none">
                {`Studium ${numeral}.`}
              </span>
              <span className="w-8 h-px bg-[#8a7346]/50" />
              <EditableCaseField
                caseId={c.id}
                field="tag"
                initial={c.tag}
                defaultValue="Kategoria"
                placeholder="Kategoria..."
                maxLength={50}
                accentColor="#8a7346"
              />
            </div>
            <h3
              className="font-serif font-normal m-0 mb-5 text-[#1c1a15]"
              style={{ fontSize: "clamp(24px, 3cqw, 40px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
            >
              <EditableCaseField
                caseId={c.id}
                field="title"
                initial={c.title}
                defaultValue="Tytuł studium."
                placeholder="Tytuł..."
                maxLength={200}
                accentColor="#8a7346"
              />
            </h3>
            <p className="text-[15px] leading-[1.65] text-[#3a3730] m-0 mb-6">
              <EditableCaseField
                caseId={c.id}
                field="body"
                initial={c.body}
                defaultValue="Krótki opis: kontekst, plan, wynik."
                placeholder="Opis..."
                maxLength={500}
                multiline
                block
                accentColor="#8a7346"
              />
            </p>
            <div className="flex gap-8 flex-wrap pt-5 border-t border-[#d9cfb8]">
              {([
                ["stat1", "stat1Label"] as const,
                ["stat2", "stat2Label"] as const,
                ["stat3", "stat3Label"] as const,
              ]).map(([sk, lk]) => (
                <div key={sk} className="min-w-[90px]">
                  <div
                    className="font-serif italic font-light text-[#1c1a15]"
                    style={{ fontSize: "clamp(22px, 2.4cqw, 30px)", letterSpacing: "-0.015em", lineHeight: 1 }}
                  >
                    <EditableCaseField
                      caseId={c.id}
                      field={sk}
                      initial={c[sk]}
                      defaultValue="—"
                      placeholder="0"
                      maxLength={20}
                      accentColor="#8a7346"
                    />
                  </div>
                  <div className="text-[10.5px] sm:text-[11px] tracking-[0.2em] uppercase text-[#7a7365] mt-2">
                    <EditableCaseField
                      caseId={c.id}
                      field={lk}
                      initial={c[lk]}
                      defaultValue="Wskaźnik"
                      placeholder="Etykieta"
                      maxLength={40}
                      accentColor="#8a7346"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

        const photoEl = (
          <div className="relative aspect-[4/3] overflow-hidden bg-[#efe7d7]">
            <StudioCasePhotoUpload
              caseId={c.id}
              current={c.photo}
              currentFocal={c.photoFocal}
              hidden={c.photoHidden}
              fallback={fallbackPhoto}
              alt={c.title ?? c.tag ?? ""}
            />
            <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_#c8bc9f]" />
          </div>
        );

        return (
          <div
            key={c.id}
            className={`group relative bg-[#fbf8f1] border border-[#d9cfb8] p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${reverse ? "@[1024px]:grid-cols-[1fr_1.2fr]" : "@[1024px]:grid-cols-[1.2fr_1fr]"} hover:border-[#8a7346] transition`}
          >
            <div className={`absolute top-0 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition ${reverse ? "right-0" : "left-0"}`}>
              <button
                type="button"
                onClick={() => onMove(c.id, -1)}
                disabled={isFirst}
                title="Przesuń w górę"
                className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-[#8a7346] hover:border-[#8a7346]/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-[#8a7346] hover:border-[#8a7346]/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-400/60 transition text-base"
              >
                ✨
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id, c.title ?? c.tag ?? "")}
                title="Usuń studium"
                className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-red-700 hover:border-red-700/40 transition"
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
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#8a7346]">
                    {String(v.tag ?? "")}
                  </div>
                  <div className="font-serif text-[16px] tracking-[-0.01em] text-[#1c1a15]">
                    {String(v.title ?? "")}
                  </div>
                  <div className="text-[12.5px] text-[#5a5447] leading-[1.5]">
                    {String(v.body ?? "")}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      [v.stat1, v.stat1Label],
                      [v.stat2, v.stat2Label],
                      [v.stat3, v.stat3Label],
                    ].map(([val, lab], i) => (
                      <div key={i} className="text-[10.5px]">
                        <div className="font-serif italic text-[14px] text-[#1c1a15]">
                          {String(val ?? "")}
                        </div>
                        <div className="tracking-[0.15em] uppercase text-[#7a7365]">
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
        className="border border-dashed border-[#8a7346]/40 p-12 flex flex-col items-center justify-center gap-3 min-h-[180px] text-[#8a7346] hover:border-[#8a7346] hover:bg-[#efe7d7]/40 transition disabled:opacity-60"
      >
        <span className="font-serif italic text-3xl leading-none">+</span>
        <span className="text-[11px] sm:text-[12px] tracking-[0.22em] uppercase">
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
