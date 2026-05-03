"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { fetchSlots } from "./book/fetch-slots";
import type { Slot } from "@/lib/time";

const POLISH_MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

interface Props {
  /** Trainer's UUID — needed for slot fetch. Distinct from the URL slug. */
  trainerDbId: string | undefined;
  /** Trainer slug — used for /book navigation links. */
  trainerSlug: string;
  /** First service id, used to pre-select on /book. Undefined when the trainer
   *  has no services yet — slot click then falls back to plain /book. */
  defaultServiceId?: string;
  /** Day-of-week numbers (0 = Sunday … 6 = Saturday) the trainer accepts
   *  bookings on. Drives which calendar cells are highlighted as "available"
   *  before the user clicks (the actual slot list comes from fetchSlots). */
  availableDows: number[];
}

/**
 * Real working booking widget for the Signature template hero. Replaces the
 * static-mock calendar that used to live inline in SignatureProfile.
 *
 * Flow:
 *   1. Mount → render the current month, with cells highlighted on day-of-
 *      weeks the trainer works (from availability_rules).
 *   2. Click a day → fires the `fetchSlots` server action which checks both
 *      availability_rules AND existing bookings; returns real slot list.
 *   3. Click a slot → navigates to /trainers/[slug]/book?date=YYYY-MM-DD with
 *      the date pre-selected; BookingForm handles the rest.
 *
 * No useEffect for slot loading — `useTransition` keeps the previous slots
 * visible while the new ones load (no flicker).
 */
export default function SignatureBookingWidget({
  trainerDbId,
  trainerSlug,
  defaultServiceId,
  availableDows,
}: Props) {
  const today = new Date();
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pending, startTransition] = useTransition();

  // Load slots when selectedDate changes.
  useEffect(() => {
    if (!selectedDate || !trainerDbId) return;
    startTransition(async () => {
      try {
        const next = await fetchSlots(trainerDbId, selectedDate);
        setSlots(next);
      } catch {
        setSlots([]);
      }
    });
  }, [selectedDate, trainerDbId]);

  // Build the calendar grid for the current view month. Polish week starts
  // on Monday — JS getDay() returns 0 = Sunday, so shift by -1 mod 7.
  const firstOfMonth = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstDow = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const daysInPrevMonth = new Date(view.year, view.month, 0).getDate();

  type Cell = { day: number; iso: string | null; muted: boolean; isAvailable: boolean };
  const cells: Cell[] = [];
  // Leading days from previous month — muted.
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, iso: null, muted: true, isAvailable: false });
  }
  // Current month — pad each day to ISO YYYY-MM-DD for slot fetch.
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cellDate = new Date(view.year, view.month, day);
    const cellDow = cellDate.getDay();
    const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isAvailable = !isPast && availableDows.includes(cellDow);
    cells.push({ day, iso, muted: isPast, isAvailable });
  }
  // Trailing days from next month — muted, fill to 6 rows × 7 = 42 cells max.
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - daysInMonth - firstDow + 1, iso: null, muted: true, isAvailable: false });
  }

  const monthLabel = `${POLISH_MONTHS[view.month]?.toUpperCase()} ${view.year}`;
  const goPrev = () => {
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 },
    );
    setSelectedDate(null);
    setSlots([]);
  };
  const goNext = () => {
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 },
    );
    setSelectedDate(null);
    setSlots([]);
  };

  return (
    <div className="bg-white border border-[#e4dccf] rounded-sm p-5 sm:p-[22px]">
      <div className="flex justify-between items-center mb-4">
        <div className="text-[14px] font-medium tracking-[-0.005em]">Dostępne terminy</div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Poprzedni miesiąc"
            className="w-6 h-6 inline-flex items-center justify-center rounded-full text-[#7d7268] hover:text-[#1a1613] hover:bg-[#f1e3e3] transition"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.08em] min-w-[120px] text-center">{monthLabel}</div>
          <button
            type="button"
            onClick={goNext}
            aria-label="Następny miesiąc"
            className="w-6 h-6 inline-flex items-center justify-center rounded-full text-[#7d7268] hover:text-[#1a1613] hover:bg-[#f1e3e3] transition"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {["P", "W", "Ś", "C", "P", "S", "N"].map((d, i) => (
          <div key={`l${i}`} className="font-mono text-[9px] text-[#7d7268] text-center tracking-[0.05em] py-1">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          const isSelected = c.iso === selectedDate;
          const base = "aspect-square flex items-center justify-center text-[12px] rounded-full relative transition";
          if (c.muted) {
            return (
              <div key={i} className={`${base} text-[#cfc3b0]`}>
                {c.day}
              </div>
            );
          }
          if (isSelected) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setSlots([]);
                }}
                className={`${base} bg-[#7d1f1f] text-white font-medium`}
              >
                {c.day}
              </button>
            );
          }
          if (c.isAvailable) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => c.iso && setSelectedDate(c.iso)}
                className={`${base} text-[#1a1613] font-medium hover:bg-[#f1e3e3] cursor-pointer`}
              >
                {c.day}
                <span className="absolute bottom-[3px] w-[3px] h-[3px] rounded-full bg-[#7d1f1f]" />
              </button>
            );
          }
          return (
            <div key={i} className={`${base} text-[#cfc3b0]`}>
              {c.day}
            </div>
          );
        })}
      </div>

      {/* Slot list. Empty when no day picked yet, or when the picked day has
          no free slots (everything booked / not a working day). */}
      {!selectedDate && (
        <div className="font-mono text-[10px] text-[#7d7268] tracking-[0.1em] uppercase text-center py-3">
          Wybierz dzień, aby zobaczyć godziny
        </div>
      )}
      {selectedDate && pending && (
        <div className="font-mono text-[10px] text-[#7d7268] tracking-[0.1em] uppercase text-center py-3">
          Ładowanie...
        </div>
      )}
      {selectedDate && !pending && slots.length === 0 && (
        <div className="font-mono text-[10px] text-[#7d7268] tracking-[0.1em] uppercase text-center py-3">
          Brak wolnych terminów
        </div>
      )}
      {selectedDate && !pending && slots.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((s) => {
            const url =
              `/trainers/${trainerSlug}/book?date=${selectedDate}` +
              (defaultServiceId ? `&service=${defaultServiceId}` : "");
            const cls = s.available
              ? "border-[#e4dccf] text-[#3d362f] hover:border-[#7d1f1f] hover:text-[#7d1f1f] hover:bg-[#f1e3e3]"
              : "border-[#e4dccf] text-[#cfc3b0] line-through pointer-events-none";
            return s.available ? (
              <Link
                key={s.startIso}
                href={url}
                className={`py-2 text-center border rounded-sm font-mono text-[12px] tracking-[0.03em] cursor-pointer transition ${cls}`}
              >
                {s.label}
              </Link>
            ) : (
              <div
                key={s.startIso}
                className={`py-2 text-center border rounded-sm font-mono text-[12px] tracking-[0.03em] ${cls}`}
              >
                {s.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
