"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type AuthState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  const sp = useSearchParams();
  const next = sp.get("next") ?? "";

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
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
          autoComplete="current-password"
          className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[15px] font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition disabled:opacity-60"
      >
        {pending ? "Logowanie..." : "Zaloguj się"}
      </button>
    </form>
  );
}
