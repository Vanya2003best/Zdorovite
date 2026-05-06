"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markBookingPaid, type PaymentMethod } from "./actions";

const METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: "blik", label: "BLIK", hint: "Klient zapłacił BLIK-iem" },
  { id: "cash", label: "Gotówka", hint: "Klient zapłacił gotówką" },
  { id: "transfer", label: "Przelew", hint: "Klient zrobił przelew" },
  { id: "package", label: "Pakiet", hint: "Sesja z opłaconego pakietu" },
  { id: "platform", label: "NaZdrow!", hint: "Płatność przez platformę" },
];

/**
 * Compact mark-paid trigger — opens a method picker on click. After
 * picking, fires markBookingPaid() and the parent re-renders without
 * the row (it moves from "pending" to "paid" list).
 */
export default function MarkPaidButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPick = (method: PaymentMethod) => {
    setError(null);
    startTransition(async () => {
      const res = await markBookingPaid(bookingId, method);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 transition"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Oznacz jako opłacone
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1.5 p-2 rounded-lg bg-white border border-emerald-300 shadow-sm">
      <div className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-emerald-700 px-1">
        Wybierz metodę
      </div>
      <div className="flex gap-1 flex-wrap">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(m.id)}
            title={m.hint}
            className="text-[11.5px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400 transition disabled:opacity-60"
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-[11.5px] text-slate-500 px-2 py-1 hover:text-slate-800 transition"
        >
          ×
        </button>
      </div>
      {error && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
