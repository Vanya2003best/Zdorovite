"use client";

import { useEffect, useState, useTransition } from "react";
import type { Service } from "@/types";
import { formatWarsawDate, type Slot } from "@/lib/time";
import { createBooking, type BookingState } from "./book/actions";
import { fetchSlots } from "./book/fetch-slots";
import { useActionState } from "react";

type Props = {
  trainerSlug: string;
  trainerId: string;
  services: (Service & { id: string })[];
  priceFrom: number;
  initialDate: string;
  initialSlots: Slot[];
};

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingSidebar({
  trainerSlug,
  trainerId,
  services,
  priceFrom,
  initialDate,
  initialSlots,
}: Props) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [slotIso, setSlotIso] = useState<string>("");
  const [isLoadingSlots, startSlotTransition] = useTransition();

  const [state, action, isSubmitting] = useActionState<BookingState, FormData>(
    createBooking,
    null,
  );

  useEffect(() => {
    if (date === initialDate) return;
    setSlotIso("");
    startSlotTransition(async () => {
      setSlots(await fetchSlots(trainerId, date));
    });
  }, [date, trainerId, initialDate]);

  const currentService = services.find((s) => s.id === serviceId);
  const todayIso = new Date().toISOString().slice(0, 10);
  const canGoBack = date > todayIso;
  const availableCount = slots.filter((s) => s.available).length;

  if (services.length === 0) {
    return (
      <aside className="hidden @[640px]:block">
        <div className="bg-white/88 backdrop-blur-xl border border-white/70 rounded-[20px] p-6 text-center text-sm text-slate-500">
          Ten trener nie udostępnił jeszcze usług.
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden @[640px]:block">
      <form action={action} className="bg-white/88 backdrop-blur-xl backdrop-saturate-[1.4] border border-white/70 rounded-[20px] shadow-[0_24px_48px_-20px_rgba(2,6,23,0.12)] p-5">
        <input type="hidden" name="trainer_slug" value={trainerSlug} />
        <input type="hidden" name="service_id" value={serviceId} />
        <input type="hidden" name="start_iso" value={slotIso} />

        <h3 className="text-[15px] font-semibold tracking-tight mb-3">Zarezerwuj termin</h3>

        {/* Service picker */}
        <label className="block mb-3">
          <span className="sr-only">Usługa</span>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name} · {svc.price} zł
              </option>
            ))}
          </select>
          {currentService?.duration ? (
            <div className="text-[11px] text-slate-500 mt-1 px-1">
              ⏱ {currentService.duration} min
            </div>
          ) : null}
        </label>

        {/* Date nav */}
        <div className="flex items-center justify-between mb-3 p-2.5 bg-slate-50 rounded-xl">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="w-7 h-7 rounded-lg bg-white border border-slate-200 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-400 transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="text-center">
            <div className="text-[13px] font-semibold">{formatWarsawDate(date)}</div>
            <div className="text-[11px] text-slate-500">
              {isLoadingSlots ? "Ładowanie..." : `${availableCount} dostępnych terminów`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="w-7 h-7 rounded-lg bg-white border border-slate-200 inline-flex items-center justify-center hover:border-slate-400 transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        {/* Slot grid */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {slots.length === 0 && !isLoadingSlots && (
            <div className="col-span-4 py-6 text-center text-[12px] text-slate-500">
              Brak wolnych terminów
            </div>
          )}
          {slots.map((s) => {
            const active = slotIso === s.startIso;
            const disabled = !s.available;
            return (
              <button
                type="button"
                key={s.startIso}
                disabled={disabled}
                onClick={() => setSlotIso(s.startIso)}
                className={`py-1.5 text-center border rounded-[9px] text-xs transition ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : disabled
                      ? "text-slate-300 bg-slate-50 border-slate-100 line-through cursor-not-allowed"
                      : "bg-white border-slate-200 hover:border-slate-400"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {state && "error" in state && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 mb-3">
            {state.error}
          </p>
        )}

        {/* Price + submit */}
        <div className="flex justify-between items-baseline pt-3 border-t border-slate-200">
          <span className="text-[13px] text-slate-500">Do zapłaty</span>
          <span className="text-[22px] font-semibold tracking-tight">
            {currentService?.price ?? priceFrom} zł
          </span>
        </div>

        <button
          type="submit"
          disabled={!slotIso || !serviceId || isSubmitting}
          className="w-full mt-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl py-3 text-[15px] font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Rezerwuję..." : "Zarezerwuj sesję"}
        </button>

        <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-slate-500">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Bezpieczna płatność · anuluj do 24h
        </div>

      </form>
    </aside>
  );
}
