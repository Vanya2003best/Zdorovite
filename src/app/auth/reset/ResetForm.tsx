"use client";

import { useActionState } from "react";
import { setNewPassword, type ResetState } from "./actions";

export default function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    setNewPassword,
    null
  );

  return (
    <form action={action} className="grid gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Nowe hasło</label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full h-11 px-3.5 rounded-[10px] border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
        />
        <p className="text-[12px] text-slate-500 mt-1.5">Min. 8 znaków.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Powtórz hasło
        </label>
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? "Zapisywanie..." : "Zapisz nowe hasło →"}
      </button>
    </form>
  );
}
