"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createPackageBooking, type PackageBookingState } from "./actions";
import { fetchSlots } from "../../book/fetch-slots";
import { formatWarsawDate, type Slot } from "@/lib/time";

type Props = {
  trainerSlug: string;
  trainerId: string;
  trainerName: string;
  trainerAvatar: string;
  trainerAvatarFocal?: string | null;
  trainerLocation: string;
  pkg: {
    id: string;
    name: string;
    description: string;
    items: string[];
    price: number;
    period: string | null;
  };
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

export default function PackageBookingForm({
  trainerSlug,
  trainerId,
  trainerName,
  trainerAvatar,
  trainerAvatarFocal,
  trainerLocation,
  pkg,
  initialDate,
  initialSlots,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [note, setNote] = useState("");
  const [isPendingSlots, startSlotTransition] = useTransition();

  const [state, action, isSubmitting] = useActionState<PackageBookingState, FormData>(
    createPackageBooking,
    null,
  );

  useEffect(() => {
    if (date === initialDate) return;
    setSelectedSlot("");
    startSlotTransition(async () => {
      const next = await fetchSlots(trainerId, date);
      setSlots(next);
    });
  }, [date, trainerId, initialDate]);

  const { morning, afternoon, evening } = bucketSlots(slots);
  const dateLabel = formatWarsawDate(date);
  const slotLabel = slots.find((s) => s.startIso === selectedSlot)?.label ?? "";

  const canConfirm = !!selectedSlot;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
      {/* LEFT — flow */}
      <div className="space-y-6">
        <header>
          <h1 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.02em] m-0 mb-2">
            Zarezerwuj pakiet
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Wybierz termin <strong>pierwszej</strong> sesji z pakietu „{pkg.name}".
            Pozostałe sesje zaplanujesz z trenerem na czacie po opłaceniu pakietu.
          </p>
        </header>

        {/* Package summary banner — visible always so client doesn't lose context. */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 inline-flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-slate-900">{pkg.name}</div>
            <div className="text-[12.5px] text-slate-700 leading-relaxed mt-0.5">
              Pierwsza sesja zostanie zaplanowana teraz. Płatność u trenera (BLIK / przelew / gotówka)
              przy pierwszym spotkaniu.
            </div>
          </div>
        </div>

        {/* Stepper */}
        <ol className="grid grid-cols-2 gap-2">
          <Step n={1} label="Termin" active={step === 1} done={step > 1} />
          <Step n={2} label="Potwierdzenie" active={step === 2} done={false} />
        </ol>

        {step === 1 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold tracking-[-0.005em] m-0 mb-1">Wybierz termin</h2>
            <p className="text-[12.5px] text-slate-500 mb-4">
              Wszystkie pokazane sloty są zgodne z dostępnością trenera.
            </p>

            {/* Date picker — prev/next + current label */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, -1))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                ← Poprzedni dzień
              </button>
              <div className="text-[14px] font-semibold tracking-tight tabular-nums">
                {dateLabel}
              </div>
              <button
                type="button"
                onClick={() => setDate(shiftDate(date, 1))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Następny dzień →
              </button>
            </div>

            {isPendingSlots ? (
              <div className="text-center py-10 text-[13px] text-slate-500">Ładowanie terminów…</div>
            ) : slots.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-500">
                Brak wolnych terminów tego dnia. Wybierz inny dzień.
              </div>
            ) : (
              <div className="grid gap-3">
                {morning.length > 0 && <SlotBucket title="Rano" slots={morning} selected={selectedSlot} onPick={setSelectedSlot} />}
                {afternoon.length > 0 && <SlotBucket title="Po południu" slots={afternoon} selected={selectedSlot} onPick={setSelectedSlot} />}
                {evening.length > 0 && <SlotBucket title="Wieczorem" slots={evening} selected={selectedSlot} onPick={setSelectedSlot} />}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canConfirm}
                className="h-10 px-5 rounded-lg bg-slate-900 text-white text-[13.5px] font-semibold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Dalej →
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold tracking-[-0.005em] m-0 mb-1">Potwierdzenie</h2>
            <p className="text-[12.5px] text-slate-500 mb-4">
              Sprawdź szczegóły i zarezerwuj pierwszą sesję.
            </p>

            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13.5px]">
              <dt className="text-slate-500">Pakiet</dt>
              <dd className="font-medium text-slate-900">{pkg.name}</dd>
              <dt className="text-slate-500">Trener</dt>
              <dd className="font-medium text-slate-900">{trainerName}</dd>
              <dt className="text-slate-500">Lokalizacja</dt>
              <dd className="text-slate-700">{trainerLocation}</dd>
              <dt className="text-slate-500">Termin</dt>
              <dd className="font-medium text-slate-900">{dateLabel}, {slotLabel}</dd>
              <dt className="text-slate-500">Cena pakietu</dt>
              <dd className="font-semibold text-slate-900 tabular-nums">{pkg.price} zł</dd>
            </dl>

            <form action={action} className="mt-5 grid gap-3">
              <input type="hidden" name="trainer_slug" value={trainerSlug} />
              <input type="hidden" name="package_id" value={pkg.id} />
              <input type="hidden" name="start_iso" value={selectedSlot} />

              <label className="block">
                <span className="text-[12.5px] font-medium text-slate-700 block mb-1.5">
                  Notatka dla trenera (opcjonalnie)
                </span>
                <textarea
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Cele, przeciwwskazania, inne uwagi…"
                  className="w-full px-3 py-2.5 text-[13.5px] rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 leading-relaxed"
                />
              </label>

              {state && "error" in state && (
                <div className="text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {state.error}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-10 px-4 rounded-lg text-[13.5px] font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  ← Wstecz
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !canConfirm}
                  className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-[13.5px] font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? "Rezerwuję…" : "Zarezerwuj pakiet"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {/* RIGHT — sticky summary */}
      <aside className="lg:sticky lg:top-6 grid gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trainerAvatar}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
              style={{ objectPosition: trainerAvatarFocal ?? "center" }}
            />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900 truncate">{trainerName}</div>
              <div className="text-[12px] text-slate-500 truncate">{trainerLocation}</div>
            </div>
          </div>

          <div className="h-px bg-slate-100 my-4" />

          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-2">
            Pakiet
          </div>
          <div className="text-[14px] font-semibold text-slate-900">{pkg.name}</div>
          {pkg.period && <div className="text-[12px] text-slate-500 mt-0.5">{pkg.period}</div>}
          {pkg.items.length > 0 && (
            <ul className="mt-3 grid gap-1.5 text-[12.5px] text-slate-700">
              {pkg.items.slice(0, 5).map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="h-px bg-slate-100 my-4" />

          <div className="flex justify-between items-baseline">
            <span className="text-[12.5px] text-slate-600">Cena pakietu</span>
            <span className="text-[18px] font-semibold text-slate-900 tabular-nums">
              {pkg.price} zł
            </span>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-2 leading-relaxed">
            Płatność u trenera — BLIK, przelew lub gotówka przy pierwszej sesji.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li
      className={
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition " +
        (active
          ? "border-slate-900 bg-slate-900 text-white"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-500")
      }
    >
      <span
        className={
          "w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] font-semibold shrink-0 " +
          (active
            ? "bg-white text-slate-900"
            : done
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-500")
        }
      >
        {done ? "✓" : n}
      </span>
      {label}
    </li>
  );
}

function SlotBucket({
  title,
  slots,
  selected,
  onPick,
}: {
  title: string;
  slots: Slot[];
  selected: string;
  onPick: (s: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-semibold mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => {
          const on = selected === s.startIso;
          return (
            <button
              key={s.startIso}
              type="button"
              onClick={() => onPick(s.startIso)}
              disabled={!s.available}
              className={
                "h-9 px-3 rounded-lg text-[13px] font-medium tabular-nums transition border " +
                (on
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400")
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
