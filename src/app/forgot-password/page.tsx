"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "./actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    requestPasswordReset,
    null
  );

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_10px_40px_rgba(2,6,23,0.08)] p-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-7">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm">
            Z
          </span>
          <span className="font-semibold text-[17px] tracking-[-0.01em]">NaZdrow!</span>
        </Link>

        <h1 className="text-[24px] tracking-[-0.025em] font-semibold mt-0 mb-2">
          Zapomniałeś hasła?
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Podaj email, na który założyłeś konto — wyślemy link do ustawienia nowego hasła.
        </p>

        {state?.info ? (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-[10px] px-3.5 py-3 mb-4">
            {state.info}
          </div>
        ) : (
          <form action={action} className="grid gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full h-11 px-3.5 rounded-[10px] border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-[10px] bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center hover:bg-black transition disabled:opacity-60"
            >
              {pending ? "Wysyłanie..." : "Wyślij link →"}
            </button>
          </form>
        )}

        <div className="text-[13px] text-slate-500 mt-6">
          <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
            ← Wróć do logowania
          </Link>
        </div>
      </div>
    </div>
  );
}
