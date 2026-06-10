"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualClient } from "./actions";

/**
 * "Dodaj klienta" — manual roster entry for people who pay cash and never
 * touched the platform (linked clients arrive automatically via bookings).
 */
export default function AddClientModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addManualClient({
        displayName: String(formData.get("displayName") ?? ""),
        email: String(formData.get("email") ?? "") || undefined,
        phone: String(formData.get("phone") ?? "") || undefined,
        goal: String(formData.get("goal") ?? "") || undefined,
        tags: String(formData.get("tags") ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-[9px] bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Dodaj klienta
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_20px_60px_rgba(2,6,23,0.25)] p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-[19px] font-bold tracking-[-0.02em] m-0">Dodaj klienta</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zamknij"
                className="text-slate-400 hover:text-slate-700 transition -mt-1"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-[12.5px] text-slate-500 mt-0 mb-4">
              Dla osób spoza platformy (płatność gotówką itp.). Klienci rezerwujący
              przez NaZdrow! pojawiają się tu automatycznie.
            </p>

            <form ref={formRef} action={submit} className="grid gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Imię i nazwisko *
                </label>
                <input
                  name="displayName"
                  required
                  maxLength={80}
                  className="w-full h-10 px-3 rounded-[9px] border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    name="email"
                    type="email"
                    className="w-full h-10 px-3 rounded-[9px] border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Telefon</label>
                  <input
                    name="phone"
                    type="tel"
                    className="w-full h-10 px-3 rounded-[9px] border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Cel</label>
                <input
                  name="goal"
                  maxLength={200}
                  placeholder="np. redukcja, siła, przygotowanie do maratonu"
                  className="w-full h-10 px-3 rounded-[9px] border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tagi <span className="text-slate-400 font-normal">(po przecinku)</span>
                </label>
                <input
                  name="tags"
                  placeholder="Siłownia, Online, Redukcja"
                  className="w-full h-10 px-3 rounded-[9px] border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[9px] px-3 py-2 m-0">
                  {error}
                </p>
              )}

              <div className="flex gap-2.5 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-[9px] border-[1.5px] border-slate-200 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2.5 rounded-[9px] bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 transition disabled:opacity-60"
                >
                  {pending ? "Dodawanie..." : "Dodaj klienta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
