"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { specializations as ALL_SPECS, getSpecLabel } from "@/data/specializations";
import { setPageSpecializations } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import { usePreviewTransition } from "./preview-busy";

/**
 * Horizontal-scrolling specializations ticker for Cinematic.
 *
 * Layout: a flex row with a scrollable specs list (flex-1) and, in edit mode,
 * a pinned "+ Dodaj" button on the right that's outside the scroll container.
 * That separation matters because the picker dropdown is absolutely positioned
 * below the button — if the button were inside the scroll container, the
 * dropdown would be clipped by overflow-x-auto. Pinned-right also keeps the
 * "+ Dodaj" always reachable when many specs are added and the row scrolls.
 *
 * Read mode: just labels separated by `—`. justify-center balances a short
 * list visually instead of left-aligning into empty space; if specs overflow,
 * flexbox ignores justify-content and the row scrolls normally.
 *
 * Edit mode: each spec gets a hover-visible ✕. The "+ Dodaj" dropdown shows
 * specializations not yet used. Both actions revalidate the page.
 */
export default function CinematicTicker({
  specializations,
  globalSpecs,
  editMode = false,
}: {
  specializations: string[];
  /** Trainer's global spec list — used to detect "no override needed" so the
   *  per-page override clears when its content matches the global list. */
  globalSpecs: string[];
  editMode?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [specializations]);

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

  const scrollByAmount = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

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
  const showPicker = editMode && available.length > 0;

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <div className="border-y border-white/10 bg-[#0a0a0c]">
      <div className="flex items-center py-4 px-3 gap-2">
        {/* Left scroll arrow — always rendered when there's overflow, disabled
            when at the left edge (visual cue that we can't go further left). */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            disabled={!canScrollLeft}
            aria-label="Przewiń w lewo"
            className="shrink-0 w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white/80 inline-flex items-center justify-center hover:bg-white/20 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10 disabled:hover:text-white/80 disabled:hover:border-white/15"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}

        {/* Scrollable specs list. `safe center` lets short lists center while
            overflowing lists fall back to flex-start (predictable scrollLeft).
            px-4 inside this scroller gives the first/last spec a small breathing
            room from the arrow buttons. */}
        <div
          ref={ref}
          style={{ justifyContent: "safe center" }}
          className="flex-1 min-w-0 flex gap-12 font-mono text-[14px] text-white/70 whitespace-nowrap uppercase tracking-[0.12em] px-4 overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {specializations.map((sp, i) => (
            <span key={i} className="group/spec relative inline-flex gap-12 items-center shrink-0">
              <span className="inline-flex items-center gap-2 text-[#d4ff00]">
                {getSpecLabel(sp)}
                {editMode && (
                  <button
                    type="button"
                    onClick={() => onRemove(sp)}
                    disabled={pending}
                    title={`Usuń: ${getSpecLabel(sp)}`}
                    aria-label={`Usuń ${getSpecLabel(sp)}`}
                    className="w-5 h-5 rounded-full bg-white/10 border border-white/15 text-white/70 inline-flex items-center justify-center text-[10px] opacity-0 group-hover/spec:opacity-100 hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-60"
                  >
                    ✕
                  </button>
                )}
              </span>
              {i < specializations.length - 1 && <span className="text-white/40">—</span>}
            </span>
          ))}
          {specializations.length === 0 && (
            <span className="text-white/40 italic normal-case tracking-normal">Brak specjalizacji</span>
          )}
        </div>

        {/* Right scroll arrow — same pattern as the left one. */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            disabled={!canScrollRight}
            aria-label="Przewiń w prawo"
            className="shrink-0 w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white/80 inline-flex items-center justify-center hover:bg-white/20 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10 disabled:hover:text-white/80 disabled:hover:border-white/15"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}

        {/* Add picker (edit mode). Sits to the right of the right arrow. */}
        {showPicker && (
          <div data-spec-picker className="relative shrink-0 pl-3 border-l border-white/10">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={pending}
              className="inline-flex items-center gap-2 text-[#d4ff00]/80 hover:text-[#d4ff00] border border-dashed border-[#d4ff00]/30 hover:border-[#d4ff00] rounded-full px-3 py-1 font-mono text-[12px] uppercase tracking-[0.12em] transition disabled:opacity-60"
            >
              <span className="text-[14px] leading-none">+</span> Dodaj
            </button>
            {pickerOpen && (
              <div className="absolute top-full right-6 mt-3 z-50 min-w-[220px] rounded-xl border border-white/15 bg-[#111114] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                <ul className="max-h-[260px] overflow-y-auto">
                  {available.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onAdd(s.id)}
                        disabled={pending}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left font-mono text-[12px] tracking-[0.1em] uppercase text-white/80 hover:bg-white/5 hover:text-[#d4ff00] transition disabled:opacity-60"
                      >
                        <span className="text-[14px] normal-case font-sans">{s.icon}</span>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
