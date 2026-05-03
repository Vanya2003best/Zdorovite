"use client";

import { useEffect, useRef, useState } from "react";
import { saveAvailabilityRules, type AvailabilityRule } from "./actions";
import type { DayRule } from "./page";

/**
 * Weekly availability timeline editor — visual replacement for the per-day
 * time-pickers list. Each weekday is a horizontal track from TIMELINE_START
 * to TIMELINE_END; the trainer's working hours render as a draggable bar.
 *
 * Interactions:
 *   - click empty track → enables day with default 09:00–18:00
 *   - drag bar's left/right edge → resize start/end (15-min snap)
 *   - drag bar's middle → translate the whole shift
 *   - X button → mark day as Wolne
 *   - "Skopiuj poniedziałek" → copies Mon's range to all weekdays
 *
 * Auto-saves debounced 500 ms after last edit. No explicit Zapisz button.
 */

const DAYS = [
  { dow: 1, short: "Pn", full: "Poniedziałek" },
  { dow: 2, short: "Wt", full: "Wtorek" },
  { dow: 3, short: "Śr", full: "Środa" },
  { dow: 4, short: "Cz", full: "Czwartek" },
  { dow: 5, short: "Pt", full: "Piątek" },
  { dow: 6, short: "So", full: "Sobota" },
  { dow: 0, short: "Nd", full: "Niedziela" },
];

const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 22;
const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 16
const TIMELINE_TOTAL_MIN = TIMELINE_HOURS * 60;
const SNAP_MIN = 15;

type DayState = { enabled: boolean; start: string; end: string };

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function snap(min: number) {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

/** Convert relative pixel x within the track to absolute minutes-since-midnight. */
function pxToTrackMin(px: number, trackWidth: number): number {
  const rel = clamp(px / trackWidth, 0, 1);
  const minFromTrackStart = snap(rel * TIMELINE_TOTAL_MIN);
  return TIMELINE_START_HOUR * 60 + minFromTrackStart;
}

/** % of track for a given absolute minutes-since-midnight. */
function minToPct(absoluteMin: number): number {
  return ((absoluteMin - TIMELINE_START_HOUR * 60) / TIMELINE_TOTAL_MIN) * 100;
}

type DragMode = "left" | "right" | "move";
type DragState = {
  dow: number;
  mode: DragMode;
  pointerId: number;
  trackWidth: number;
  trackLeft: number;
  /** Initial values captured at pointerdown so we apply deltas, not absolutes. */
  initStartMin: number;
  initEndMin: number;
  initPxX: number;
};

export default function AvailabilityTimeline({
  initialByDow,
}: {
  initialByDow: Record<number, DayRule | null>;
}) {
  const [days, setDays] = useState<Record<number, DayState>>(() => {
    const m: Record<number, DayState> = {};
    DAYS.forEach((d) => {
      const r = initialByDow[d.dow];
      m[d.dow] = {
        enabled: r !== null,
        start: r?.start ?? "09:00",
        end: r?.end ?? "18:00",
      };
    });
    return m;
  });
  const [savedAgo, setSavedAgo] = useState<"saved" | "saving" | "idle">("idle");
  const trackRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const dragRef = useRef<DragState | null>(null);

  // Auto-save: debounce 500 ms after any change.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setSavedAgo("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const rules: AvailabilityRule[] = DAYS.filter((d) => days[d.dow].enabled).map((d) => ({
        dow: d.dow,
        start: days[d.dow].start,
        end: days[d.dow].end,
      }));
      await saveAvailabilityRules(rules);
      setSavedAgo("saved");
      setTimeout(() => setSavedAgo((cur) => (cur === "saved" ? "idle" : cur)), 1500);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [days]);

  const enableDay = (dow: number) => {
    setDays((prev) => ({ ...prev, [dow]: { enabled: true, start: "09:00", end: "18:00" } }));
  };
  const disableDay = (dow: number) => {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], enabled: false } }));
  };
  const copyMondayToAll = () => {
    const tpl = days[1];
    if (!tpl?.enabled) return;
    setDays((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => {
        if (d.dow !== 1) next[d.dow] = { ...tpl };
      });
      return next;
    });
  };

  const onPointerDown = (
    dow: number,
    mode: DragMode,
  ) => (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRefs.current.get(dow);
    if (!track) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const rect = track.getBoundingClientRect();
    dragRef.current = {
      dow,
      mode,
      pointerId: e.pointerId,
      trackWidth: rect.width,
      trackLeft: rect.left,
      initStartMin: timeToMin(days[dow].start),
      initEndMin: timeToMin(days[dow].end),
      initPxX: e.clientX,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const deltaPx = e.clientX - drag.initPxX;
    const deltaMin = snap((deltaPx / drag.trackWidth) * TIMELINE_TOTAL_MIN);

    setDays((prev) => {
      const cur = prev[drag.dow];
      let newStart = drag.initStartMin;
      let newEnd = drag.initEndMin;
      const lo = TIMELINE_START_HOUR * 60;
      const hi = TIMELINE_END_HOUR * 60;
      if (drag.mode === "left") {
        newStart = clamp(drag.initStartMin + deltaMin, lo, drag.initEndMin - SNAP_MIN);
      } else if (drag.mode === "right") {
        newEnd = clamp(drag.initEndMin + deltaMin, drag.initStartMin + SNAP_MIN, hi);
      } else {
        // move: shift both by deltaMin, but clamp to track bounds
        const span = drag.initEndMin - drag.initStartMin;
        let s = drag.initStartMin + deltaMin;
        if (s < lo) s = lo;
        if (s + span > hi) s = hi - span;
        newStart = s;
        newEnd = s + span;
      }
      if (newStart === timeToMin(cur.start) && newEnd === timeToMin(cur.end)) return prev;
      return {
        ...prev,
        [drag.dow]: { ...cur, start: minToTime(newStart), end: minToTime(newEnd) },
      };
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const onTrackClick = (dow: number) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (days[dow].enabled) return; // already has bar — clicks on bar handled separately
    if (dragRef.current) return;
    enableDay(dow);
    e.stopPropagation();
  };

  return (
    <div className="grid gap-2 select-none">
      {/* Hour ruler */}
      <div className="grid grid-cols-[28px_1fr_24px] gap-1.5 items-end px-px">
        <span />
        <div className="relative h-3 text-[9px] text-slate-400 font-medium">
          {Array.from({ length: TIMELINE_HOURS / 2 + 1 }, (_, i) => {
            const h = TIMELINE_START_HOUR + i * 2;
            const pct = (i * 2 * 60 / TIMELINE_TOTAL_MIN) * 100;
            return (
              <span
                key={h}
                className="absolute -translate-x-1/2 tabular-nums"
                style={{ left: `${pct}%` }}
              >
                {h}
              </span>
            );
          })}
        </div>
        <span />
      </div>

      {DAYS.map((d) => {
        const state = days[d.dow];
        const startMin = timeToMin(state.start);
        const endMin = timeToMin(state.end);
        const leftPct = minToPct(startMin);
        const widthPct = minToPct(endMin) - leftPct;

        return (
          <div key={d.dow} className="grid grid-cols-[28px_1fr_24px] gap-1.5 items-center">
            <span
              className={`text-[11px] uppercase tracking-[0.04em] font-semibold ${
                state.enabled ? "text-slate-700" : "text-slate-400"
              }`}
              title={d.full}
            >
              {d.short}
            </span>

            <div
              ref={(el) => { trackRefs.current.set(d.dow, el); }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={onTrackClick(d.dow)}
              className={`relative h-8 rounded-md bg-slate-100 ${
                state.enabled ? "" : "cursor-pointer hover:bg-emerald-50 transition"
              }`}
            >
              {state.enabled ? (
                <div
                  className="absolute inset-y-0 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-md shadow-[0_2px_6px_rgba(16,185,129,0.25)] flex items-center px-1.5 cursor-grab active:cursor-grabbing"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  onPointerDown={onPointerDown(d.dow, "move")}
                >
                  {/* Left edge handle */}
                  <div
                    className="absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center group"
                    onPointerDown={onPointerDown(d.dow, "left")}
                  >
                    <span className="w-0.5 h-3 bg-white/80 rounded-full group-hover:h-4 transition" />
                  </div>
                  {/* Right edge handle */}
                  <div
                    className="absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center group"
                    onPointerDown={onPointerDown(d.dow, "right")}
                  >
                    <span className="w-0.5 h-3 bg-white/80 rounded-full group-hover:h-4 transition" />
                  </div>
                  {/* Time label — only if bar is wide enough (>=14% ≈ 2h 15m) */}
                  {widthPct >= 14 && (
                    <span className="text-[10px] font-semibold text-white tabular-nums whitespace-nowrap mx-auto pointer-events-none">
                      {state.start}–{state.end}
                    </span>
                  )}
                </div>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400 italic pointer-events-none">
                  Wolne
                </span>
              )}
            </div>

            {state.enabled ? (
              <button
                type="button"
                onClick={() => disableDay(d.dow)}
                title="Oznacz jako wolne"
                className="w-5 h-5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition inline-flex items-center justify-center"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => enableDay(d.dow)}
                title="Dodaj godziny pracy"
                className="w-5 h-5 rounded-full text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition inline-flex items-center justify-center"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-2 mt-1">
        <button
          type="button"
          onClick={copyMondayToAll}
          disabled={!days[1]?.enabled}
          className="text-[11px] text-slate-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed transition underline-offset-2 hover:underline"
        >
          Skopiuj Pn na wszystkie dni
        </button>
        <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
          {savedAgo === "saving" && <>Zapisywanie…</>}
          {savedAgo === "saved" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Zapisano
            </>
          )}
        </span>
      </div>
    </div>
  );
}
