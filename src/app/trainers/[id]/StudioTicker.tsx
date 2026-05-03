"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { specializations as ALL_SPECS, getSpecLabel } from "@/data/specializations";
import { setPageSpecializations } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import { usePreviewTransition } from "./preview-busy";

/**
 * Studio template's specializations strip.
 *
 * Two modes:
 *   - VIEW (public + non-edit editor): seamless infinite marquee. The CSS
 *     animation in globals.css translates the track by -50% over 36s; for the
 *     loop to LOOK seamless the track must be at least 2× viewport wide. With
 *     only 1-2 specs the original (4 verbatim copies) was too narrow on wide
 *     monitors → a visible jump when the animation reset to 0.
 *
 *     Fix: pad each "copy" by repeating the specs list inside it. We aim for
 *     ≥8 spec items per copy so even a single-spec trainer ends up with plenty
 *     of width.
 *
 *   - EDIT mode: ditches the animation entirely (jarring while editing). Shows
 *     a static row with hover-✕ on each spec + "+ Dodaj" picker pinned right.
 *     Mirrors the CinematicTicker UX but in Studio's light/burnt-orange palette.
 */
export default function StudioTicker({
  specializations,
  globalSpecs,
  editMode = false,
}: {
  specializations: string[];
  /** Trainer's global spec list — used to detect "no override needed". */
  globalSpecs: string[];
  editMode?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();

  const commit = (next: string[]) => {
    pinScrollFor(1500);
    const sameAsGlobal =
      next.length === globalSpecs.length &&
      next.every((id, i) => id === globalSpecs[i]);
    startTransition(async () => {
      const res = await setPageSpecializations(sameAsGlobal ? null : next, pageId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  // Close picker on Esc / outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-spec-picker]")) setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [pickerOpen]);

  const onRemove = (id: string) => {
    commit(specializations.filter((s) => s !== id));
  };
  const onAdd = (id: string) => {
    setPickerOpen(false);
    if (specializations.includes(id)) return;
    commit([...specializations, id]);
  };

  const used = new Set(specializations);
  const available = ALL_SPECS.filter((s) => !used.has(s.id));

  // ===== EDIT mode — static row with edit affordances =====
  if (editMode) {
    return (
      <div
        className="border-y border-[#e8e6df] bg-white py-[18px] px-6 sm:px-10"
        style={{ fontSize: "clamp(20px, 3cqw, 36px)", letterSpacing: "-0.03em", fontWeight: 500 }}
      >
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {specializations.map((sp, i) => (
            <span key={sp} className="group/spec inline-flex items-center gap-3 shrink-0">
              <span>{getSpecLabel(sp)}</span>
              <button
                type="button"
                onClick={() => onRemove(sp)}
                disabled={pending}
                title={`Usuń: ${getSpecLabel(sp)}`}
                aria-label={`Usuń ${getSpecLabel(sp)}`}
                className="w-6 h-6 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center text-[12px] opacity-0 group-hover/spec:opacity-100 focus-visible:opacity-100 hover:text-red-600 hover:border-red-300 transition disabled:opacity-60"
              >
                ✕
              </button>
              {i < specializations.length - 1 && (
                <span className="inline-block w-2 h-2 rounded-full bg-[#ff5722] ml-7" />
              )}
            </span>
          ))}
          {specializations.length === 0 && (
            <span className="text-[#77756f] italic" style={{ fontSize: "16px", fontWeight: 400 }}>
              Brak specjalizacji
            </span>
          )}

          {available.length > 0 && (
            <span data-spec-picker className="relative inline-flex shrink-0">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={pending}
                className="inline-flex items-center gap-2 text-[#ff5722] border border-dashed border-[#ff5722]/40 hover:border-[#ff5722] hover:bg-[#ffeadb]/40 rounded-full px-4 py-1.5 transition disabled:opacity-60"
                style={{ fontSize: "16px", fontWeight: 500, letterSpacing: "0" }}
              >
                <span className="text-[18px] leading-none">+</span> Dodaj
              </button>
              {pickerOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[220px] rounded-xl border border-[#e8e6df] bg-white shadow-[0_20px_40px_-12px_rgba(2,6,23,0.15)] overflow-hidden">
                  <ul className="max-h-[260px] overflow-y-auto">
                    {available.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => onAdd(s.id)}
                          disabled={pending}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[#141413] hover:bg-[#fafaf7] hover:text-[#ff5722] transition disabled:opacity-60"
                          style={{ letterSpacing: "0", fontWeight: 400 }}
                        >
                          <span>{s.icon}</span>
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ===== VIEW mode — seamless marquee =====
  // Pad each "copy" of the spec list to ≥8 items so even a single-spec
  // trainer's track is at least 2× viewport wide on a 1920px monitor.
  // Empty trainers get a fallback list (matches the old StudioProfile
  // hardcoded set so designs already in flight still look right).
  const specs = specializations.map(getSpecLabel).filter(Boolean);
  const padCount = specs.length === 0 ? 1 : Math.max(1, Math.ceil(8 / specs.length));
  const padded =
    specs.length === 0
      ? [
          "Trening personalny",
          "Rehabilitacja",
          "Prewencja kontuzji",
          "Trening siłowy",
          "Analiza wideo",
        ]
      : Array.from({ length: padCount }, () => specs).flat();
  const specRow = padded.join(" · ");

  return (
    <div
      className="overflow-hidden whitespace-nowrap border-y border-[#e8e6df] bg-white py-[18px]"
      style={{ fontSize: "clamp(24px, 4cqw, 48px)", letterSpacing: "-0.03em", fontWeight: 500 }}
    >
      <div className="nz-marquee-track">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="px-7 inline-flex items-center gap-7" aria-hidden="true">
            {specRow}
            <span className="inline-block w-2 h-2 rounded-full bg-[#ff5722]" />
          </span>
        ))}
      </div>
    </div>
  );
}
