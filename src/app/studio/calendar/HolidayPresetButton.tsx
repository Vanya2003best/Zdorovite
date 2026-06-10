"use client";

import { useEffect, useRef, useState } from "react";

type Preset = {
  id: "vacation-week" | "weekend" | "conference-2";
  label: string;
  sub: string;
  /** Given a YYYY-MM-DD start date, returns the set of dates to mark closed. */
  expand: (start: string) => string[];
};

function addDays(yyyymmdd: string, days: number): string {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESETS: Preset[] = [
  {
    id: "vacation-week",
    label: "Urlop (7 dni)",
    sub: "Cały tydzień wolny od wybranej daty",
    expand: (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
  },
  {
    id: "weekend",
    label: "Weekend wolny",
    sub: "Sobota + niedziela tego tygodnia",
    expand: (start) => {
      // Find Saturday of the week containing `start`. JS getDay(): 0=Sun..6=Sat.
      const d = new Date(`${start}T00:00:00`);
      const dow = d.getDay();
      const daysToSat = (6 - dow + 7) % 7;
      const sat = addDays(start, daysToSat);
      const sun = addDays(sat, 1);
      return [sat, sun];
    },
  },
  {
    id: "conference-2",
    label: "Konferencja (2 dni)",
    sub: "Wybrany dzień + następny",
    expand: (start) => [start, addDays(start, 1)],
  },
];

/**
 * Floating button that writes a batch of "closed-day" overrides — the trainer's
 * common cases (urlop, weekend off, short conference) folded into 1-click
 * presets so they don't have to open the per-day dialog 7 times.
 *
 * Lives in the calendar toolbar in pattern (Dostępność) mode only. The Big
 * Idea: turn "I'm not available 11-17 May" into a single intent + start date,
 * not a 7-step manual loop.
 */
export default function HolidayPresetButton({
  onApply,
  overrides,
  onRemove,
}: {
  /** Receives the list of dates to mark closed. The parent batches them
   *  through saveAvailabilityOverride(date, null). */
  onApply: (dates: string[]) => Promise<void> | void;
  /** Current exceptions keyed by YYYY-MM-DD — used to render an "active"
   *  list at the top of the popover so the trainer can undo any single
   *  day without diving into the per-day dialog. */
  overrides?: Record<string, { isClosed: boolean }>;
  /** Clears the override for a single date (back to recurring rule). */
  onRemove?: (date: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState<string>(todayIso);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const apply = async (preset: Preset) => {
    if (busy) return;
    setBusy(true);
    const dates = preset.expand(startDate);
    await onApply(dates);
    setBusy(false);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[8px] text-[11.5px] font-medium border bg-white text-slate-700 border-slate-200 hover:border-slate-300 transition"
        title="Dodaj wyjątek (urlop, weekend, konferencja)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Dodaj wyjątek
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[320px] bg-white border border-slate-200 rounded-[12px] shadow-[0_20px_40px_-12px_rgba(2,6,23,0.16)] overflow-hidden z-[60]">
          {/* Active exceptions — visible only when at least one date has a
              closed-day override. One-click ✕ removes that date, restoring
              the recurring rule. Avoids forcing the trainer into the
              per-day dialog for cleanup after a preset they regret. */}
          {(() => {
            const activeDates = Object.entries(overrides ?? {})
              .filter(([, o]) => o.isClosed)
              .map(([d]) => d)
              .sort();
            if (activeDates.length === 0) return null;
            return (
              <div className="px-3 py-2.5 border-b border-slate-100 bg-amber-50/40 max-h-[160px] overflow-y-auto">
                <div className="text-[11px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1.5">
                  Aktywne wyjątki ({activeDates.length})
                </div>
                <ul className="grid gap-1">
                  {activeDates.map((d) => {
                    const dt = new Date(`${d}T00:00:00`);
                    const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
                    const label = `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
                    return (
                      <li key={d} className="flex items-center gap-2 text-[12.5px] text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="flex-1 tabular-nums">{label}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!onRemove || busy) return;
                            setBusy(true);
                            await onRemove(d);
                            setBusy(false);
                          }}
                          disabled={!onRemove || busy}
                          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                          title="Usuń wyjątek"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="text-[11px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1.5">
              Od kiedy
            </div>
            <input
              type="date"
              value={startDate}
              min={todayIso}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-2.5 text-[13px] rounded-[8px] border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 tabular-nums"
            />
          </div>
          <div className="py-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => apply(p)}
                disabled={busy || !startDate}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <span className="shrink-0 w-7 h-7 rounded-[8px] bg-amber-50 text-amber-700 inline-flex items-center justify-center text-base">
                  {p.id === "vacation-week" ? "🏖️" : p.id === "weekend" ? "📅" : "🎤"}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-slate-900">{p.label}</span>
                  <span className="block text-[11px] text-slate-500 leading-tight mt-0.5">{p.sub}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 leading-relaxed">
            Wybrane dni zostaną oznaczone jako wolne. Cotygodniowy wzorzec
            pozostaje bez zmian.
          </div>
        </div>
      )}
    </div>
  );
}
