"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type RegisterState } from "./actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    register,
    null
  );

  return (
    <div className="mx-auto max-w-md px-5 sm:px-6 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Utwórz konto</h1>
      <p className="text-sm text-slate-600 mt-2 mb-8">
        Masz już konto?{" "}
        <Link href="/login" className="text-emerald-700 font-medium hover:underline">
          Zaloguj się
        </Link>
      </p>

      <form action={action} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-[13px] font-medium text-slate-700">Imię i nazwisko</span>
          <input
            type="text"
            name="display_name"
            required
            autoComplete="name"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[13px] font-medium text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[13px] font-medium text-slate-700">Hasło</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <span className="text-[11px] text-slate-500">Minimum 8 znaków.</span>
        </label>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            {state.error}
          </p>
        )}
        {state?.info && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
            {state.info}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-12 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[15px] font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-60"
        >
          {pending ? "Tworzenie konta..." : "Zarejestruj się"}
        </button>
      </form>
    </div>
  );
}
