"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchSlotsForTrainer } from "@/lib/actions/slots";
import { requestReschedule } from "@/lib/actions/reschedule";
import type { Slot } from "@/lib/time";

const PL_DAY_LONG = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const PL_MONTH_LONG = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${PL_DAY_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${PL_MONTH_LONG[d.getUTCMonth()]}`;
}

function bucketSlots(slots: Slot[]) {
  const morning: Slot[] = [], afternoon: Slot[] = [], evening: Slot[] = [];
  for (const s of slots) {
    const h = parseInt(s.label.slice(0, 2), 10);
    if (Number.isNaN(h)) afternoon.push(s);
    else if (h < 12) morning.push(s);
    else if (h < 18) afternoon.push(s);
    else evening.push(s);
  }
  return { morning, afternoon, evening };
}

type Props = {
  bookingId: string;
  trainerId: string;
  /** ISO start of the booking we're proposing to move — shown as "było 15:00". */
  currentStartIso: string;
  /** Default duration in minutes. Slots from getAvailableSlots are 60-min by default; we use the gap between picked startIso and the slot's implicit end. */
  durationMin?: number;
  /** Trigger button label + classes. */
  triggerLabel?: string;
  triggerClassName?: string;
};

export default function RescheduleDialog({
  bookingId,
  trainerId,
  currentStartIso,
  durationMin = 60,
  triggerLabel = "Przenieś",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayIso);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reason, setReason] = useState("");
  const [loadingSlots, startSlotTransition] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset state on close.
  useEffect(() => {
    if (open) return;
    setDate(todayIso);
    setSlots([]);
    setSelectedSlot("");
    setReason("");
    setError(null);
  }, [open, todayIso]);

  // Fetch slots whenever date or open changes.
  useEffect(() => {
    if (!open) return;
    setSelectedSlot("");
    startSlotTransition(async () => {
      try {
        const next = await fetchSlotsForTrainer(trainerId, date);
        setSlots(next);
      } catch {
        setSlots([]);
      }
    });
  }, [open, date, trainerId]);

  const buckets = useMemo(() => bucketSlots(slots), [slots]);
  const canGoBack = date > todayIso;
  const currentTimeLabel = useMemo(() => {
    const d = new Date(currentStartIso);
    return d.toLocaleString("pl-PL", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  }, [currentStartIso]);

  const onSubmit = () => {
    if (!selectedSlot) return;
    setError(null);
    const proposedEnd = new Date(new Date(selectedSlot).getTime() + durationMin * 60_000).toISOString();
    startSubmit(async () => {
      const res = await requestReschedule({
        bookingId,
        proposedStart: selectedSlot,
        proposedEnd,
        reason: reason.trim() || undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "px-2.5 py-1 rounded-[7px] text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-400 transition"
        }
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zaproponuj nowy termin"
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setOpen(false);
          }}
        >
          <div className="bg-white w-full sm:max-w-[480px] sm:rounded-[20px] rounded-t-[20px] shadow-2xl flex flex-col max-h-[90dvh]">
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">Zaproponuj nowy termin</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">było {currentTimeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                aria-label="Zamknij"
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Date selector */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => canGoBack && setDate(shiftDate(date, -1))}
                  disabled={!canGoBack || loadingSlots}
                  className="w-9 h-9 rounded-[10px] border border-slate-200 inline-flex items-center justify-center text-slate-700 hover:border-slate-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div className="text-[14px] font-semibold text-center flex-1">{fmtLongDate(date)}</div>
                <button
                  type="button"
                  onClick={() => setDate(shiftDate(date, 1))}
                  disabled={loadingSlots}
                  className="w-9 h-9 rounded-[10px] border border-slate-200 inline-flex items-center justify-center text-slate-700 hover:border-slate-400 transition disabled:opacity-30"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>

              {loadingSlots ? (
                <div className="text-center py-12 text-[13px] text-slate-500">Ładowanie dostępnych godzin…</div>
              ) : slots.length === 0 ? (
                <div className="text-center py-12 text-[13px] text-slate-500">
                  Brak wolnych godzin tego dnia. Spróbuj kolejnego.
                </div>
              ) : (
                <div className="grid gap-3">
                  <SlotGroup label="Rano" slots={buckets.morning} selected={selectedSlot} onSelect={setSelectedSlot} />
                  <SlotGroup label="Po południu" slots={buckets.afternoon} selected={selectedSlot} onSelect={setSelectedSlot} />
                  <SlotGroup label="Wieczorem" slots={buckets.evening} selected={selectedSlot} onSelect={setSelectedSlot} />
                </div>
              )}

              <label className="block mt-4">
                <span className="block text-[12px] font-medium text-slate-700 mb-1.5">
                  Powód zmiany <span className="text-slate-400">(opcjonalne)</span>
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={400}
                  placeholder="np. spotkanie służbowe — czy możemy o godzinę wcześniej?"
                  className="w-full px-3 py-2 rounded-[10px] border border-slate-200 text-[13px] focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 resize-none"
                />
              </label>

              {error && (
                <p className="mt-3 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <footer className="px-5 py-3.5 border-t border-slate-100 flex justify-between gap-3 pb-safe">
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-[10px] text-[13.5px] font-medium text-slate-700 border border-slate-200 bg-white hover:border-slate-400 transition disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!selectedSlot || submitting}
                className="px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold bg-slate-900 text-white hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Wysyłanie…" : "Wyślij propozycję"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function SlotGroup({
  label,
  slots,
  selected,
  onSelect,
}: {
  label: string;
  slots: Slot[];
  selected: string;
  onSelect: (iso: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{label}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {slots.map((s) => {
          const active = selected === s.startIso;
          return (
            <button
              key={s.startIso}
              type="button"
              onClick={() => s.available && onSelect(s.startIso)}
              disabled={!s.available}
              className={`h-10 rounded-[10px] text-[13px] font-medium border transition ${
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : s.available
                    ? "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
                    : "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed line-through"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
