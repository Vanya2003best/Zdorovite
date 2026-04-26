"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type AuthState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  const [showPassword, setShowPassword] = useState(false);
  const sp = useSearchParams();
  const next = sp.get("next") ?? "";

  return (
    <form action={action} className="grid gap-4 max-w-[440px]">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Email lub telefon
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="w-full h-11 px-3.5 rounded-[10px] border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Hasło</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            className="w-full h-11 px-3.5 pr-10 rounded-[10px] border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center text-[12.5px] mt-1">
        <label className="flex gap-2 items-center text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="w-4 h-4 accent-emerald-500"
          />
          Pamiętaj mnie 30 dni
        </label>
        <Link href="#" className="text-slate-700 hover:text-slate-900">
          Zapomniałeś hasła?
        </Link>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 mt-1 rounded-[10px] bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-60"
      >
        {pending ? "Logowanie..." : "Zaloguj się →"}
      </button>
    </form>
  );
}
