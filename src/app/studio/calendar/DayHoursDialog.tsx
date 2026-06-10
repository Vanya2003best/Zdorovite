"use client";

import { useEffect, useState } from "react";
import type { WorkingHourRule } from "./CalendarClient";

const DAY_NAMES_NOM = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const DAY_NAMES_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

type Shift = { start: string; end: string };

/**
 * Per-day editor for working hours. Supports multiple shifts (split-shift) so
 * trainers with a midday break can express e.g. "06:00–12:00 + 16:00–22:00"
 * cleanly. Native <input type="time" step="900"> gives 15-min snap on all
 * modern browsers without a custom picker.
 *
 * On save: replaces ALL rules across ALL days with the merged set, since
 * `saveAvailabilityRules` is a full-replace action. We carry the rest of the
 * trainer's existing rules through unchanged via `allRules` prop.
 */
export default function DayHoursDialog({
  dow,
  initialShifts,
  allRules,
  date,
  hasOverride,
  onClose,
  onSave,
  onSaveOverride,
}: {
  dow: number;
  initialShifts: Shift[];
  allRules: WorkingHourRule[];
  /** YYYY-MM-DD of the column the trainer clicked. When provided alongside
   *  onSaveOverride, the dialog offers a "tylko ten dzień" scope toggle so
   *  the trainer can override hours for a single date without breaking the
   *  recurring weekly pattern. */
  date?: string;
  /** True when this exact `date` already has an entry in
   *  availability_overrides — drives the "Usuń wyjątek" affordance and
   *  lets us preselect "tylko ten dzień" so the trainer doesn't fall
   *  back into recurring-edit mode by accident. */
  hasOverride?: boolean;
  onClose: () => void;
  onSave: (allRules: WorkingHourRule[]) => void;
  /** Persists shifts into `availability_overrides` for the given date.
   *  null = "closed that date", []/non-empty = open hours, omitted = use
   *  recurring path. */
  onSaveOverride?: (date: string, shifts: Shift[] | null) => Promise<void> | void;
}) {
  const supportsOverride = !!date && !!onSaveOverride;
  // Default to one-off scope when the trainer is clicking a real date and
  // already has an override set — they're more likely to be editing the
  // exception than wanting to repromote it to a recurring rule.
  const [scope, setScope] = useState<"recurring" | "override">(
    supportsOverride && hasOverride ? "override" : "recurring",
  );
  const [closed, setClosed] = useState(initialShifts.length === 0);
  const [shifts, setShifts] = useState<Shift[]>(
    initialShifts.length > 0 ? initialShifts : [{ start: "06:00", end: "18:00" }],
  );
  const [copyTo, setCopyTo] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateShift = (i: number, field: "start" | "end", value: string) => {
    setShifts((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
    setError(null);
  };
  const removeShift = (i: number) => {
    setShifts((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addShift = () => {
    // Default new shift to fit AFTER the last one if any (16:00–20:00),
    // otherwise default 09:00–18:00.
    const last = shifts[shifts.length - 1];
    if (last) {
      const lastEnd = timeToMin(last.end);
      const newStart = Math.min(lastEnd + 60, 22 * 60);
      const newEnd = Math.min(newStart + 4 * 60, 23 * 60);
      setShifts((prev) => [...prev, { start: minToTime(newStart), end: minToTime(newEnd) }]);
    } else {
      setShifts([{ start: "06:00", end: "18:00" }]);
    }
  };

  const toggleCopyDay = (d: number) => {
    setCopyTo((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const validate = (): string | null => {
    if (closed) return null;
    if (shifts.length === 0) return "Dodaj przynajmniej jedną zmianę albo zaznacz „Wolne&rdquo;.";
    for (const s of shifts) {
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(s.start)) return "Nieprawidłowa godzina rozpoczęcia.";
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(s.end)) return "Nieprawidłowa godzina zakończenia.";
      if (s.start >= s.end) return "Godzina zakończenia musi być po rozpoczęciu.";
    }
    // Check overlaps
    const sorted = [...shifts].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) return "Zmiany nakładają się — popraw godziny.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setPending(true);

    // One-off override path: write to availability_overrides for `date` only,
    // recurring rule untouched. Skip "kopiuj na inne dni" because copying a
    // one-off doesn't make conceptual sense.
    if (scope === "override" && date && onSaveOverride) {
      await onSaveOverride(date, closed ? null : shifts);
      return;
    }

    // Recurring path: build new rule set — drop existing rules for `dow` and
    // any day in copyTo, then re-add fresh ones from current shifts.
    const targetDays = new Set([dow, ...copyTo]);
    const carry = allRules.filter((r) => !targetDays.has(r.dow));
    const fresh: WorkingHourRule[] = [];
    if (!closed) {
      for (const d of targetDays) {
        for (const s of shifts) {
          fresh.push({ dow: d, start: s.start, end: s.end });
        }
      }
    }
    onSave([...carry, ...fresh]);
  };

  /** Wipe the override for this date, restoring the recurring rule. */
  const handleClearOverride = async () => {
    if (!date || !onSaveOverride) return;
    setPending(true);
    await onSaveOverride(date, []);
  };

  // Pretty date for the override-scope label ("9 maj").
  const dateLabel = date
    ? (() => {
        const d = new Date(`${date}T00:00:00`);
        const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
        return `${d.getDate()} ${months[d.getMonth()]}`;
      })()
    : "";

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_32px_80px_-16px_rgba(2,6,23,0.4)] overflow-hidden"
      >
        <header className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Godziny pracy</div>
          <h2 className="text-[20px] font-semibold tracking-tight mt-0.5">{DAY_NAMES_NOM[dow]}</h2>
        </header>

        <div className="px-6 py-5 grid gap-4">
          {/* Scope toggle — only when the column has a real date AND the
              parent passed an override-save callback. Lets the trainer
              choose between "this date only" and "every {dow}" without
              another modal layer. */}
          {supportsOverride && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-[12.5px]">
              <button
                type="button"
                onClick={() => setScope("recurring")}
                className={`py-2 rounded-lg font-medium transition ${
                  scope === "recurring" ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-slate-600"
                }`}
              >
                Każdy {DAY_NAMES_NOM[dow].toLowerCase()}
              </button>
              <button
                type="button"
                onClick={() => setScope("override")}
                className={`py-2 rounded-lg font-medium transition inline-flex items-center justify-center gap-1.5 ${
                  scope === "override" ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-slate-600"
                }`}
              >
                Tylko {dateLabel}
                {hasOverride && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Aktywny wyjątek" />}
              </button>
            </div>
          )}

          {/* Open/Closed toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setClosed(false)}
              className={`py-2 rounded-lg text-[13px] font-medium transition ${
                !closed ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-slate-600"
              }`}
            >
              Pracuję
            </button>
            <button
              type="button"
              onClick={() => setClosed(true)}
              className={`py-2 rounded-lg text-[13px] font-medium transition ${
                closed ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-slate-600"
              }`}
            >
              Wolne
            </button>
          </div>

          {/* Shifts */}
          {!closed && (
            <div className="grid gap-2">
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Zmiany</div>
              {shifts.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    step={900}
                    value={s.start}
                    onChange={(e) => updateShift(i, "start", e.target.value)}
                    className="h-10 flex-1 px-3 rounded-lg border border-slate-200 text-[13px] font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 text-sm">—</span>
                  <input
                    type="time"
                    step={900}
                    value={s.end}
                    onChange={(e) => updateShift(i, "end", e.target.value)}
                    className="h-10 flex-1 px-3 rounded-lg border border-slate-200 text-[13px] font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                  {shifts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeShift(i)}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Usuń zmianę"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
              {/* Prominent CTA — proper dashed-outline button under the
                  last shift so trainers see the affordance at a glance.
                  Replaces the old underline-text link that visually read
                  as a footnote and was easy to miss. */}
              <button
                type="button"
                onClick={addShift}
                className="mt-1 h-10 w-full rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500 transition inline-flex items-center justify-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Dodaj kolejną zmianę
              </button>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                Możesz dodać kilka zmian w jednym dniu — np. <span className="font-mono">06:00–12:00</span> + <span className="font-mono">16:00–22:00</span> z przerwą w środku.
              </p>
            </div>
          )}

          {/* Copy to other days — recurring scope only. Copying a one-off
              override to every other dow doesn't make conceptual sense, so
              we hide the section in override mode. */}
          {scope === "recurring" && (
          <div className="grid gap-2 pt-2 border-t border-slate-100">
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Skopiuj na inne dni</div>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                if (d === dow) return null;
                const active = copyTo.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleCopyDay(d)}
                    className={`h-9 min-w-[44px] px-3 rounded-lg text-[12px] font-semibold transition ${
                      active
                        ? "bg-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.3)]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {DAY_NAMES_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Clear-override link — only when this date currently has one. */}
          {supportsOverride && hasOverride && scope === "override" && (
            <button
              type="button"
              onClick={handleClearOverride}
              disabled={pending}
              className="text-[12px] text-rose-700 hover:text-rose-800 font-medium text-left underline-offset-2 hover:underline"
            >
              Usuń wyjątek — przywróć cotygodniowy wzorzec
            </button>
          )}

          {error && (
            <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 px-4 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="h-10 px-5 bg-emerald-600 text-white rounded-lg text-[13px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {pending ? "Zapisywanie..." : "Zapisz"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
