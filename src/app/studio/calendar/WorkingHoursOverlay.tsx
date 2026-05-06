"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToY(min: number, minHour: number): number {
  return ((min - minHour * 60) * SLOT_HEIGHT_PER_HOUR) / 60;
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
  /** First hour visible in the FullCalendar grid — needed because
   *  CalendarClient now sets slotMinTime dynamically based on the
   *  trainer's earliest rule. Without it, our minToY math drifts
   *  by however many hours we differ from 06:00. */
  slotMinHour?: number;
};

export default function WorkingHoursOverlay({
  rules,
  fcWrapperRef,
  viewType,
  onChange,
  readOnly = false,
  hidden = false,
  slotMinHour = 6,
}: Props) {
  const [columns, setColumns] = useState<ColInfo[]>([]);
  const [editingDow, setEditingDow] = useState<number | null>(null);
  // Local mirror of rules — updated optimistically when dialog saves so the
  // overlay reflects new shifts immediately, before router.refresh.
  const [localRules, setLocalRules] = useState<WorkingHourRule[]>(rules);
  useEffect(() => { setLocalRules(rules); }, [rules]);

  // Drag-to-edit state. The block is identified by composite key
  // `${dow}-${origStart}-${origEnd}` so we can find it in localRules
  // even after pointermoves change the local copy. dragPreview holds
  // the current pixel-snapped start/end while the pointer is down so
  // the visual follows the cursor; dragMovedRef gates click — if the
  // pointer moved more than a few px, pointerup commits the new times
  // instead of opening the dialog.
  type DragMode = "move" | "resize-top" | "resize-bot";
  type DragState = {
    key: string;
    dow: number;
    mode: DragMode;
    startY: number;
    origStartMin: number;
    origEndMin: number;
  };
  const dragRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  const [dragPreview, setDragPreview] = useState<
    | {
        key: string;
        startMin: number;
        endMin: number;
      }
    | null
  >(null);

  const ruleKey = (r: WorkingHourRule) => `${r.dow}-${r.start}-${r.end}`;
  const minToHHMM = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const onDocPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 3) dragMovedRef.current = true;
    // 30-min snap, 56px/hour → 28px/30min.
    const dminUnsnapped = (dy / SLOT_HEIGHT_PER_HOUR) * 60;
    const dmin = Math.round(dminUnsnapped / 30) * 30;
    let newStart = d.origStartMin;
    let newEnd = d.origEndMin;
    if (d.mode === "move") {
      newStart += dmin;
      newEnd += dmin;
    } else if (d.mode === "resize-top") {
      newStart += dmin;
    } else if (d.mode === "resize-bot") {
      newEnd += dmin;
    }
    // Clamp + minimum 30-min length.
    if (d.mode === "move") {
      const span = d.origEndMin - d.origStartMin;
      if (newStart < 0) {
        newStart = 0;
        newEnd = span;
      }
      if (newEnd > 24 * 60) {
        newEnd = 24 * 60;
        newStart = newEnd - span;
      }
    } else if (d.mode === "resize-top") {
      newStart = Math.max(0, Math.min(newStart, d.origEndMin - 30));
    } else if (d.mode === "resize-bot") {
      newEnd = Math.max(d.origStartMin + 30, Math.min(newEnd, 24 * 60));
    }
    setDragPreview({ key: d.key, startMin: newStart, endMin: newEnd });
  }, []);

  const onDocPointerUp = useCallback(() => {
    const d = dragRef.current;
    document.removeEventListener("pointermove", onDocPointerMove);
    document.removeEventListener("pointerup", onDocPointerUp);
    dragRef.current = null;
    if (!d) return;

    if (!dragMovedRef.current) {
      // Treat as a click — open the editor dialog. dragMovedRef has
      // to reset before the click handler fires; useEffect-style
      // microtask is enough.
      setDragPreview(null);
      setEditingDow(d.dow);
      return;
    }
    const preview = dragPreview;
    setDragPreview(null);
    if (!preview) return;
    const next = localRules.map((r) =>
      ruleKey(r) === preview.key
        ? { ...r, start: minToHHMM(preview.startMin), end: minToHHMM(preview.endMin) }
        : r,
    );
    setLocalRules(next);
    onChange(next);
  }, [dragPreview, localRules, onChange, onDocPointerMove]);

  const startDrag = (e: React.PointerEvent, rule: WorkingHourRule, mode: DragMode) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    dragMovedRef.current = false;
    dragRef.current = {
      key: ruleKey(rule),
      dow: rule.dow,
      mode,
      startY: e.clientY,
      origStartMin: timeToMin(rule.start),
      origEndMin: timeToMin(rule.end),
    };
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);
  };

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
          // Empty day — clickable "+ Godziny pracy" button at the
          // grid's earliest-band start hour so it sits at the visible
          // top, not buried in mid-grid. Hidden in read-only mode; the
          // day column simply has no emerald wash, conveying "no hours"
          // without an action chip.
          if (!readOnly) {
            elements.push(
              <button
                key={`add-${col.date}`}
                type="button"
                onClick={() => setEditingDow(col.dow)}
                className="absolute left-1 right-1 h-7 rounded-md text-[10px] font-medium text-emerald-700 bg-emerald-50/40 hover:bg-emerald-50 border border-dashed border-emerald-300/60 hover:border-emerald-500 transition pointer-events-auto z-[1] flex items-center justify-center gap-1"
                style={{ top: `${minToY(slotMinHour * 60 + 30, slotMinHour)}px` }}
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
            const top = minToY(startMin, slotMinHour);
            const height = minToY(endMin, slotMinHour) - top;
            if (readOnly) {
              // Per user request: no fill, no label — just two dashed
              // emerald lines marking the start and end of the work
              // window. The faded events read as primary content; the
              // boundaries are an unobtrusive hint about availability.
              elements.push(
                <div
                  key={`${col.date}-${idx}`}
                  className="absolute left-0 right-0 pointer-events-none z-[1]"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    borderTop: "1px dashed rgba(16,185,129,0.55)",
                    borderBottom: "1px dashed rgba(16,185,129,0.55)",
                  }}
                />,
              );
            } else {
              // Editable block. While the user is dragging this same
              // block, swap to the live preview position so the green
              // wash follows the cursor smoothly. On pointerup the
              // commit logic in onDocPointerUp turns the preview into
              // the new HH:MM and pushes it to onChange.
              const k = ruleKey(rule);
              const isDragging = dragPreview?.key === k;
              const liveStart = isDragging ? dragPreview!.startMin : startMin;
              const liveEnd = isDragging ? dragPreview!.endMin : endMin;
              const liveTop = minToY(liveStart, slotMinHour);
              const liveHeight = minToY(liveEnd, slotMinHour) - liveTop;
              const liveStartLabel = minToHHMM(liveStart);
              const liveEndLabel = minToHHMM(liveEnd);
              elements.push(
                <div
                  key={`${col.date}-${idx}`}
                  onPointerDown={(e) => startDrag(e, rule, "move")}
                  className="nz-hours-block absolute left-0.5 right-0.5 group rounded-md pointer-events-auto z-[1] hover:ring-2 hover:ring-emerald-500/60 transition select-none"
                  style={{
                    top: `${liveTop}px`,
                    height: `${liveHeight}px`,
                    backgroundColor: "rgba(16, 185, 129, 0.20)",
                    cursor: "grab",
                  }}
                  title="Przeciągnij, aby przesunąć · klik aby edytować dokładnie"
                >
                  {liveHeight > 30 && (
                    <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-emerald-900 tabular-nums opacity-90 pointer-events-none">
                      {liveStartLabel}–{liveEndLabel}
                    </span>
                  )}
                  {/* Edit pencil icon — appears on hover */}
                  <span className="absolute top-1 right-1 w-5 h-5 rounded bg-white/90 text-emerald-700 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm pointer-events-none">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </span>
                  {/* Top resize handle — small green pill, visible on hover. */}
                  <span
                    onPointerDown={(e) => startDrag(e, rule, "resize-top")}
                    className="absolute left-1/2 -translate-x-1/2 -top-1 w-7 h-1.5 rounded bg-emerald-500/80 opacity-0 group-hover:opacity-100 transition cursor-ns-resize"
                    title="Przeciągnij, aby zmienić godzinę startu"
                  />
                  {/* Bottom resize handle */}
                  <span
                    onPointerDown={(e) => startDrag(e, rule, "resize-bot")}
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-7 h-1.5 rounded bg-emerald-500/80 opacity-0 group-hover:opacity-100 transition cursor-ns-resize"
                    title="Przeciągnij, aby zmienić godzinę końca"
                  />
                </div>,
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
