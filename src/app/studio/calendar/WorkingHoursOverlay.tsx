"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkingHourRule } from "./CalendarClient";
import DayHoursDialog from "./DayHoursDialog";

/**
 * Working-hours overlay. Renders an emerald block in each day column for
 * every matching rule (one block per shift — supports split-shifts natively).
 * Click any block (or "+ Godziny pracy" on empty days) to open a per-day
 * dialog where the trainer picks shifts via time pickers and confirms.
 *
 * Editing happens in the dialog — the calendar overlay is just visual + entry
 * point. This way:
 *   • Split-shifts (06–12 + 16–22) are first-class and easy to express
 *   • Touch / mobile work without finicky drag handles
 *   • Trainer can copy a day's hours to other weekdays in one click
 */

const SLOT_HEIGHT_PER_HOUR = 56; // .fc-timegrid-slot height (28px) × 2
const SLOT_MIN_HOUR = 6;

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToY(min: number): number {
  return ((min - SLOT_MIN_HOUR * 60) * SLOT_HEIGHT_PER_HOUR) / 60;
}

type ColInfo = { dow: number; date: string; frameEl: HTMLElement };

type Props = {
  rules: WorkingHourRule[];
  fcWrapperRef: React.RefObject<HTMLDivElement | null>;
  viewType: string;
  onChange: (rules: WorkingHourRule[]) => void;
  /** When true, render the emerald blocks but disable click + the
   *  "+ Godziny pracy" button + the per-day editor dialog. Used
   *  by the Calendar's 'availability' mode where the trainer is
   *  reading their pattern, not editing it. */
  readOnly?: boolean;
  /** When true, render nothing at all — used in 'bookings' mode
   *  where the trainer wants only the sessions in view, no
   *  green availability wash competing with them. */
  hidden?: boolean;
};

export default function WorkingHoursOverlay({
  rules,
  fcWrapperRef,
  viewType,
  onChange,
  readOnly = false,
  hidden = false,
}: Props) {
  const [columns, setColumns] = useState<ColInfo[]>([]);
  const [editingDow, setEditingDow] = useState<number | null>(null);
  // Local mirror of rules — updated optimistically when dialog saves so the
  // overlay reflects new shifts immediately, before router.refresh.
  const [localRules, setLocalRules] = useState<WorkingHourRule[]>(rules);
  useEffect(() => { setLocalRules(rules); }, [rules]);

  // Discover day columns. FullCalendar renders its grid asynchronously, so we
  // need to react to its DOM mutations rather than measuring once on mount.
  useEffect(() => {
    const wrapper = fcWrapperRef.current;
    if (!wrapper) return;

    let lastSig = "";
    const refresh = () => {
      const cols = Array.from(wrapper.querySelectorAll<HTMLElement>(".fc-timegrid-col[data-date]"));
      const result: ColInfo[] = cols.map((el) => {
        const date = el.getAttribute("data-date") || "";
        const dow = new Date(date).getDay();
        const frame = el.querySelector<HTMLElement>(".fc-timegrid-col-frame") || el;
        return { dow, date, frameEl: frame };
      });
      const sig = result.map((c) => c.date).join(",");
      if (sig === lastSig) return;
      lastSig = sig;
      setColumns(result);
    };
    refresh();

    const mo = new MutationObserver(refresh);
    mo.observe(wrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-date"] });
    const ro = new ResizeObserver(refresh);
    ro.observe(wrapper);
    window.addEventListener("resize", refresh);

    return () => {
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", refresh);
    };
  }, [fcWrapperRef, viewType]);

  if (viewType !== "timeGridWeek" && viewType !== "timeGridDay") return null;
  if (hidden) return null;

  return (
    <>
      {columns.map((col) => {
        const dayRules = localRules.filter((r) => r.dow === col.dow);
        const elements: React.ReactNode[] = [];

        if (dayRules.length === 0) {
          // Empty day — clickable "+ Godziny pracy" button at default 09:00.
          // Hidden in read-only mode; the day column simply has no
          // emerald wash, conveying "no hours" without an action chip.
          if (!readOnly) {
            elements.push(
              <button
                key={`add-${col.date}`}
                type="button"
                onClick={() => setEditingDow(col.dow)}
                className="absolute left-1 right-1 h-7 rounded-md text-[10px] font-medium text-emerald-700 bg-emerald-50/40 hover:bg-emerald-50 border border-dashed border-emerald-300/60 hover:border-emerald-500 transition pointer-events-auto z-[1] flex items-center justify-center gap-1"
                style={{ top: `${minToY(9 * 60)}px` }}
                title="Ustaw godziny pracy"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Godziny pracy
              </button>,
            );
          }
        } else {
          // Render one emerald block per shift on this day. Each block is
          // clickable → opens the dialog for that day.
          dayRules.forEach((rule, idx) => {
            const startMin = timeToMin(rule.start);
            const endMin = timeToMin(rule.end);
            const top = minToY(startMin);
            const height = minToY(endMin) - top;
            if (readOnly) {
              elements.push(
                <div
                  key={`${col.date}-${idx}`}
                  className="absolute left-0.5 right-0.5 rounded-sm pointer-events-none z-[1]"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: "rgba(16, 185, 129, 0.18)",
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(16,185,129,0.0) 0, rgba(16,185,129,0.0) 6px, rgba(16,185,129,0.08) 6px, rgba(16,185,129,0.08) 12px)",
                    border: "1px dashed rgba(16,185,129,0.5)",
                  }}
                >
                  {height > 30 && (
                    <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-emerald-900 tabular-nums opacity-80">
                      {rule.start}–{rule.end} · wzorzec
                    </span>
                  )}
                </div>,
              );
            } else {
              elements.push(
                <button
                  key={`${col.date}-${idx}`}
                  type="button"
                  onClick={() => setEditingDow(col.dow)}
                  className="nz-hours-block absolute left-0.5 right-0.5 group rounded-sm pointer-events-auto z-[1] hover:ring-2 hover:ring-emerald-500/50 transition cursor-pointer"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: "rgba(16, 185, 129, 0.20)",
                  }}
                  title="Kliknij aby edytować godziny pracy"
                >
                  {height > 30 && (
                    <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-emerald-900 tabular-nums opacity-80 group-hover:opacity-100 transition pointer-events-none">
                      {rule.start}–{rule.end}
                    </span>
                  )}
                  {/* Edit pencil icon — appears on hover */}
                  <span className="absolute top-1 right-1 w-5 h-5 rounded bg-white/90 text-emerald-700 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </span>
                </button>,
              );
            }
          });
        }

        return <PortalChildren key={col.date} target={col.frameEl}>{elements}</PortalChildren>;
      })}

      {editingDow !== null && (
        <DayHoursDialog
          dow={editingDow}
          initialShifts={localRules
            .filter((r) => r.dow === editingDow)
            .map((r) => ({ start: r.start, end: r.end }))
            .sort((a, b) => a.start.localeCompare(b.start))}
          allRules={localRules}
          onClose={() => setEditingDow(null)}
          onSave={(newRules) => {
            setLocalRules(newRules);
            setEditingDow(null);
            onChange(newRules);
          }}
        />
      )}
    </>
  );
}

function PortalChildren({ target, children }: { target: HTMLElement; children: React.ReactNode }) {
  return createPortal(<>{children}</>, target);
}
