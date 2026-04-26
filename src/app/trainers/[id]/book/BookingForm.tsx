"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type { Service } from "@/types";
import { createBooking, type BookingState } from "./actions";
import { fetchSlots } from "./fetch-slots";
import { formatWarsawDate, type Slot } from "@/lib/time";

type Props = {
  trainerSlug: string;
  trainerId: string;
  trainerName: string;
  trainerAvatar: string;
  trainerLocation: string;
  services: (Service & { id: string })[];
  initialDate: string;
  initialSlots: Slot[];
};

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

export default function BookingForm({
  trainerSlug,
  trainerId,
  trainerName,
  trainerAvatar,
  trainerLocation,
  services,
  initialDate,
  initialSlots,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedService, setSelectedService] = useState<string>(services[0]?.id ?? "");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [note, setNote] = useState("");
  const [isPendingSlots, startSlotTransition] = useTransition();

  const [state, action, isSubmitting] = useActionState<BookingState, FormData>(createBooking, null);

  useEffect(() => {
    if (date === initialDate) return;
    setSelectedSlot("");
    startSlotTransition(async () => {
      const next = await fetchSlots(trainerId, date);
      setSlots(next);
    });
  }, [date, trainerId, initialDate]);

  const currentService = services.find((s) => s.id === selectedService);
  const todayIso = new Date().toISOString().slice(0, 10);
  const canGoBack = date > todayIso;
  const buckets = useMemo(() => bucketSlots(slots), [slots]);
  const selectedSlotLabel = useMemo(
    () => slots.find((s) => s.startIso === selectedSlot)?.label ?? "",
    [slots, selectedSlot]
  );

  const canAdvance =
    (step === 1 && !!selectedService) ||
    (step === 2 && !!selectedSlot) ||
    step === 3;

  return (
    <form action={action}>
      <input type="hidden" name="trainer_slug" value={trainerSlug} />
      <input type="hidden" name="service_id" value={selectedService} />
      <input type="hidden" name="start_iso" value={selectedSlot} />
      <input type="hidden" name="note" value={note} />

      {/* Top: trainer mini + stepper */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight">Zarezerwuj sesję</h1>
          <p className="text-[13px] sm:text-[14px] text-slate-600 mt-1">Trzy proste kroki. Zajmie około 2 minut.</p>
        </div>
        <div className="inline-flex items-center gap-3 px-3.5 py-2 bg-white border border-slate-200 rounded-xl">
          <img src={trainerAvatar} alt="" className="w-10 h-10 rounded-[10px] object-cover" />
          <div>
            <div className="text-[13px] font-semibold">{trainerName}</div>
            <div className="text-[12px] text-slate-500">{trainerLocation}</div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <Stepper step={step} />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Active step content */}
        <div className="rounded-[18px] bg-white border border-slate-200 p-5 sm:p-7 shadow-[0_1px_3px_rgba(2,6,23,.04)]">
          {step === 1 && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight mb-1">Wybierz usługę</h2>
              <p className="text-[14px] text-slate-600 mb-5">Pojedyncze sesje. Wsparcie pakietów wkrótce.</p>
              <div className="grid gap-2.5">
                {services.map((svc) => {
                  const active = selectedService === svc.id;
                  return (
                    <label
                      key={svc.id}
                      className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center p-4 rounded-[14px] border-[1.5px] cursor-pointer transition ${
                        active
                          ? "border-emerald-500 bg-gradient-to-b from-white to-emerald-50 ring-[3px] ring-emerald-500/10"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="_svc_picker"
                        value={svc.id}
                        checked={active}
                        onChange={() => setSelectedService(svc.id)}
                        className="sr-only"
                      />
                      <span className={`relative w-5 h-5 rounded-full border-2 ${active ? "border-emerald-500" : "border-slate-300 bg-white"}`}>
                        {active && <span className="absolute inset-[3px] rounded-full bg-emerald-500" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold">{svc.name}</div>
                        {svc.description && (
                          <div className="text-[13px] text-slate-600 mt-0.5 leading-snug">{svc.description}</div>
                        )}
                        {svc.duration > 0 && (
                          <div className="text-[11px] text-slate-500 mt-1.5">⏱ {svc.duration} min</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[18px] font-semibold tracking-tight">{svc.price} zł</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight mb-1">Wybierz datę i godzinę</h2>
              <p className="text-[14px] text-slate-600 mb-5">{formatWarsawDate(date)}</p>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 bg-white mb-4">
                <button
                  type="button"
                  disabled={!canGoBack}
                  onClick={() => setDate((d) => shiftDate(d, -1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-400 transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div className="text-center">
                  <div className="text-[14px] font-semibold">{formatWarsawDate(date)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {isPendingSlots ? "Ładowanie…" : `${slots.filter((s) => s.available).length} wolnych terminów`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDate((d) => shiftDate(d, 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 inline-flex items-center justify-center hover:border-slate-400 transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>

              {slots.length === 0 && !isPendingSlots ? (
                <p className="py-8 text-center text-sm text-slate-500">Brak terminów w tym dniu. Spróbuj inny.</p>
              ) : (
                <div className="grid gap-3.5">
                  <SlotGroup label="Rano" slots={buckets.morning} selected={selectedSlot} onSelect={setSelectedSlot} />
                  <SlotGroup label="Po południu" slots={buckets.afternoon} selected={selectedSlot} onSelect={setSelectedSlot} />
                  <SlotGroup label="Wieczorem" slots={buckets.evening} selected={selectedSlot} onSelect={setSelectedSlot} />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight mb-1">Notatka dla trenera</h2>
              <p className="text-[14px] text-slate-600 mb-5">Opcjonalnie. Cele, kontuzje, wszystko co warto wiedzieć przed sesją.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                maxLength={500}
                placeholder="Po zerwaniu ACL prawego kolana 9 miesięcy temu. Mam dokumentację medyczną."
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-100 text-[14px] resize-y"
              />
              {state && "error" in state && (
                <p className="mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {state.error}
                </p>
              )}
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 ? 1 : s === 2 ? 1 : 2))}
              disabled={step === 1}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-800 hover:border-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              Wstecz
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-slate-500 hidden sm:inline">Krok {step} z 3</span>
              {step < 3 ? (
                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={() => setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3))}
                  className="inline-flex items-center gap-2 h-12 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[14px] font-semibold shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step === 1 ? "Dalej: termin" : "Dalej: potwierdzenie"}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!selectedService || !selectedSlot || isSubmitting}
                  className="inline-flex items-center gap-2 h-12 px-5 bg-slate-900 text-white rounded-xl text-[14px] font-semibold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Rezerwuję…" : "Zarezerwuj sesję"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary sidebar */}
        <Summary
          trainerName={trainerName}
          serviceName={currentService?.name ?? ""}
          serviceDuration={currentService?.duration ?? 0}
          dateLabel={formatWarsawDate(date)}
          timeLabel={selectedSlotLabel}
          location={trainerLocation}
          price={currentService?.price ?? 0}
        />
      </div>
    </form>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: "Usługa" },
    { n: 2, label: "Data i godzina" },
    { n: 3, label: "Potwierdzenie" },
  ];
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center bg-white border border-slate-200 rounded-2xl px-4 sm:px-5 py-3 mb-6 shadow-[0_1px_3px_rgba(2,6,23,.04)]">
      {items.map((it, i) => {
        const done = step > it.n;
        const active = step === it.n;
        return (
          <span key={it.n} className="contents">
            <span className="flex items-center gap-3">
              <span
                className={`w-8 h-8 rounded-full inline-flex items-center justify-center text-[13px] font-semibold border-[1.5px] shrink-0 ${
                  done
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : active
                      ? "bg-slate-900 text-white border-slate-900 shadow-[0_0_0_4px_rgba(15,23,42,.08)]"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : it.n}
              </span>
              <span className="hidden sm:block">
                <div className="text-[10px] uppercase tracking-[0.06em] text-slate-500 font-semibold">Krok {it.n}</div>
                <div className={`text-[14px] ${active ? "font-semibold text-slate-900" : "text-slate-500 font-medium"}`}>{it.label}</div>
              </span>
            </span>
            {i < items.length - 1 && (
              <span className={`h-[1.5px] mx-2 ${step > it.n ? "bg-emerald-500" : "bg-slate-200"}`} style={{ minWidth: 24 }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function SlotGroup({ label, slots, selected, onSelect }: { label: string; slots: Slot[]; selected: string; onSelect: (iso: string) => void }) {
  if (slots.length === 0) return null;
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-1.5">{label}</h4>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {slots.map((s) => {
          const active = selected === s.startIso;
          return (
            <button
              key={s.startIso}
              type="button"
              disabled={!s.available}
              onClick={() => onSelect(s.startIso)}
              className={`py-2 text-center rounded-[9px] border text-[13px] tabular-nums transition ${
                active
                  ? "bg-slate-900 text-white border-slate-900 font-semibold"
                  : !s.available
                    ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed"
                    : "bg-white border-slate-200 hover:border-slate-400"
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

function Summary({
  trainerName, serviceName, serviceDuration, dateLabel, timeLabel, location, price,
}: {
  trainerName: string; serviceName: string; serviceDuration: number;
  dateLabel: string; timeLabel: string; location: string; price: number;
}) {
  const empty = (label: string) => (
    <span className="text-slate-400 italic font-normal">{label}</span>
  );
  return (
    <aside className="rounded-[18px] bg-white border border-slate-200 overflow-hidden lg:sticky lg:top-6 self-start">
      <h3 className="text-[14px] font-semibold p-4 border-b border-slate-200">Podsumowanie</h3>
      <div className="p-4 grid gap-3">
        <SumRow icon={<Star />} label="Trener" value={trainerName} />
        <SumRow
          icon={<Cal />}
          label="Usługa"
          value={serviceName || (empty("Wybierz usługę") as unknown as string)}
          sub={serviceName && serviceDuration > 0 ? `${serviceDuration} min` : undefined}
        />
        <SumRow
          icon={<Clock />}
          label="Termin"
          value={timeLabel ? `${dateLabel} · ${timeLabel}` : (empty("Wybierz termin") as unknown as string)}
        />
        <SumRow icon={<Pin />} label="Miejsce" value={location} />
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[13px] text-slate-600">Do zapłaty</div>
            <div className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1.5">
              <Lock />
              Płatność zabezpieczona
            </div>
          </div>
          <div className="text-[22px] font-semibold tracking-tight tabular-nums">{price} zł</div>
        </div>
      </div>
    </aside>
  );
}

function SumRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="w-8 h-8 rounded-[9px] bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.06em] text-slate-500 font-semibold">{label}</div>
        <div className="text-[14px] text-slate-900 font-medium mt-0.5 break-words">{value}</div>
        {sub && <div className="text-[12px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const Star = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
const Cal  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
const Clock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
const Pin  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const Lock = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
