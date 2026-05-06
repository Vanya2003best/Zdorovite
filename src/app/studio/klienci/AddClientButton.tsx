"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualClient } from "./actions";

/**
 * "Dodaj klienta" — modal-style add form. Triggered by a button in the
 * Klienci list header. Manual entries (cash-paying clients off-platform
 * + new contacts trainer wants to track before they book online).
 */
export default function AddClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setDisplayName("");
    setEmail("");
    setPhone("");
    setGoal("");
    setTagsRaw("");
    setNotes("");
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await addManualClient({
        displayName,
        email: email || undefined,
        phone: phone || undefined,
        goal: goal || undefined,
        notes: notes || undefined,
        tags,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
      router.push(`/studio/klienci/${res.id}`);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Dodaj klienta
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-[520px] w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 m-0 mb-1">
              Nowy klient
            </h2>
            <p className="text-[12.5px] text-slate-500 mb-5">
              Dla klienta off-platform (płaci gotówką / BLIK-iem prywatnie).
              Możesz później połączyć z kontem NaZdrow! gdy się zarejestruje.
            </p>

            <form onSubmit={onSubmit} className="grid gap-3">
              <input
                type="text"
                placeholder="Imię i nazwisko"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={80}
                autoFocus
                className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="tel"
                  placeholder="Telefon"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>
              <input
                type="text"
                placeholder="Cel klienta (np. -10 kg do lipca)"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={200}
                className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
              />
              <input
                type="text"
                placeholder="Tagi po przecinku (np. siłownia, po porodzie)"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
              />
              <textarea
                placeholder="Notatki (max 4000 znaków, markdown OK)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={4000}
                rows={3}
                className="text-[13px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 resize-vertical"
              />

              {error && (
                <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 h-11 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition disabled:opacity-60"
                >
                  {pending ? "Dodaję..." : "Dodaj klienta"}
                </button>
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  className="px-4 h-11 rounded-lg bg-white border border-slate-200 text-slate-700 text-[13px] font-medium hover:border-slate-400 transition"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
