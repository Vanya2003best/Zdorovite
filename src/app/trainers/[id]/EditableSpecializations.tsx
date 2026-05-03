"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { specializations as PRESETS, getSpecLabel, getSpecIcon } from "@/data/specializations";
import { setPageSpecializations } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import { usePreviewTransition } from "./preview-busy";

/**
 * Spec chip editor for trainer profiles. Templates configure how chips
 * look via PRIMITIVE props (className strings, booleans) — never functions,
 * because this component is rendered from server components like
 * PremiumProfile and React rejects function props across the RSC boundary.
 *
 * Editor affordances on top of the chips:
 *   - small × button on each chip (hover) to remove it
 *   - "+ Dodaj specjalizację" pill that opens a popover with the remaining
 *     preset specs to pick from
 *
 * Order matters — added chips append to the end. Drag-to-reorder is not
 * provided here; trainers can remove and re-add to change the position.
 *
 * Storage: writes the per-page override `customization.specializations`.
 * When the override matches the trainer's global list, we pass `null` to
 * clear the override (so deleting then re-adding the same chips on a page
 * doesn't bloat the customization JSON).
 */
export default function EditableSpecializations({
  current,
  globalSpecs,
  chipClassName = "",
  accentChipClassName,
  showIcon = false,
  addBtnClassName = "",
}: {
  /** The chip ids currently shown on this page. */
  current: string[];
  /** The trainer's global spec list — used to detect "no override needed". */
  globalSpecs: string[];
  /** Tailwind classes for the chip body — applied to every chip. */
  chipClassName?: string;
  /** Optional override for the FIRST chip (Studio uses this for its
   *  orange-accented primary spec). When unset, all chips use chipClassName. */
  accentChipClassName?: string;
  /** Prefix the chip text with the spec's emoji (Premium uses this). */
  showIcon?: boolean;
  /** Tailwind classes for the "+ Dodaj specjalizację" pill so it can
   *  match the template's accent colour. */
  addBtnClassName?: string;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();
  const [, startTransition] = usePreviewTransition();

  const [items, setItems] = useState<string[]>(current);
  const [pickerOpen, setPickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Re-seed when parent changes (e.g. router.refresh after save round-trip).
  const seedKey = current.join("|");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setItems(current);
  }, [seedKey, current]);

  // Outside-click closes the picker. Click on the picker itself (inside
  // popoverRef) does NOT dismiss.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const commit = (next: string[]) => {
    pinScrollFor(1500);
    const prev = items;
    setItems(next);
    // null when the override matches the global list — keeps the
    // customization JSON tidy and the page reverts to inheriting whenever
    // possible.
    const sameAsGlobal =
      next.length === globalSpecs.length &&
      next.every((id, i) => id === globalSpecs[i]);
    startTransition(async () => {
      const res = await setPageSpecializations(sameAsGlobal ? null : next, pageId);
      if ("error" in res) {
        alert(res.error);
        setItems(prev);
        return;
      }
      router.refresh();
    });
  };

  const onRemove = (id: string) => commit(items.filter((x) => x !== id));
  const onAdd = (id: string) => {
    if (items.includes(id)) return;
    setPickerOpen(false);
    commit([...items, id]);
  };

  const remaining = PRESETS.filter((p) => !items.includes(p.id));

  return (
    <>
      {items.map((id, i) => {
        const chipCls = i === 0 && accentChipClassName ? accentChipClassName : chipClassName;
        return (
          <span key={id} className="relative inline-flex group/chip">
            <span className={chipCls}>
              {showIcon && <>{getSpecIcon(id)} </>}
              {getSpecLabel(id)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(id)}
              title="Usuń"
              aria-label="Usuń specjalizację"
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[10px] leading-none opacity-0 group-hover/chip:opacity-100 transition shadow"
            >
              ×
            </button>
          </span>
        );
      })}

      {remaining.length > 0 && (
        <span className="relative inline-flex" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border-2 border-dashed transition ${addBtnClassName}`}
          >
            <span className="text-sm leading-none">+</span>
            <span>Dodaj specjalizację</span>
          </button>
          {pickerOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_8px_24px_-8px_rgba(2,6,23,0.18)] p-1.5 min-w-[200px]">
              <ul className="list-none m-0 p-0 grid gap-0.5">
                {remaining.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(p.id)}
                      className="w-full text-left text-[13px] px-2.5 py-1.5 rounded-md hover:bg-slate-100 inline-flex items-center gap-2"
                    >
                      <span>{p.icon}</span>
                      <span className="text-slate-900">{p.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </span>
      )}
    </>
  );
}
