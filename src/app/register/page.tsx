"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { register, type RegisterState } from "./actions";

export default function RegisterPage() {
  // useSearchParams needs a Suspense boundary in a client page.
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, null);
  const [showPassword, setShowPassword] = useState(false);
  const sp = useSearchParams();
  const next = sp.get("next") ?? "";
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 lg:fixed lg:inset-0 lg:h-[100dvh] lg:overflow-hidden min-h-[100dvh] bg-slate-100">
      {/* ============ LEFT: photo brand panel ============ */}
      <aside className="relative hidden lg:flex flex-col justify-between p-8 lg:p-9 text-white overflow-hidden bg-slate-900">
        {/* Background photo */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&h=1200&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 [background:linear-gradient(135deg,rgba(15,23,42,0.55)_0%,rgba(15,23,42,0.85)_100%)]" />
        </div>

        {/* Top: logo */}
        <div className="relative z-[3] flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[9px] bg-white/[0.16] inline-flex items-center justify-center font-bold text-base">
              Z
            </span>
            <span className="text-base font-semibold tracking-[-0.01em]">NaZdrow!</span>
          </Link>
        </div>

        {/* Middle: pitch */}
        <div className="relative z-[3] max-w-[440px]">
          <div className="text-[11px] tracking-[0.12em] uppercase font-semibold opacity-80 mb-2.5">
            Dla klientów
          </div>
          <h2 className="text-[28px] sm:text-[32px] leading-[1.08] tracking-[-0.025em] font-semibold m-0 mb-3">
            Trener, który Cię rozumie.
          </h2>
          <p className="text-[13px] leading-snug opacity-85 max-w-[360px] mb-5">
            Przeglądaj profile trenerów, porównaj ceny i specjalizacje, umów pierwszą sesję —
            wszystko w jednym miejscu.
          </p>
          <div className="grid gap-2.5">
            {[
              ["⚡", "Umawiaj sesje online i stacjonarnie", "Rezerwujesz termin w kalendarzu trenera w kilka kliknięć."],
              ["💬", "Czat z trenerem po rezerwacji", "Dopytasz o szczegóły i przygotowanie przed pierwszą sesją."],
              ["★", "Płatność bezpośrednio u trenera", "BLIK, przelew lub gotówka — bez pośredników."],
            ].map(([ico, title, desc]) => (
              <div key={title} className="flex gap-3 items-start text-[13px] leading-[1.45]">
                <span className="w-6.5 h-6.5 min-w-[26px] h-[26px] rounded-lg bg-white/[0.16] inline-flex items-center justify-center">
                  {ico}
                </span>
                <div>
                  <b className="block font-semibold mb-0.5">{title}</b>
                  <span className="opacity-80">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom line — honest, no invented numbers */}
        <div className="relative z-[3] mb-16">
          <span className="text-xs text-white/70">
            Konto jest darmowe — płacisz tylko trenerowi za sesje.
          </span>
        </div>
      </aside>

      {/* ============ RIGHT: form panel ============ */}
      <section className="flex flex-col bg-white p-6 sm:p-8 lg:p-9">
        {/* Mobile-only logo */}
        <Link href="/" className="lg:hidden inline-flex items-center gap-2.5 mb-6">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            Z
          </span>
          <span className="font-semibold text-[17px] tracking-[-0.01em]">NaZdrow!</span>
        </Link>

        <div className="flex justify-between text-[13px] text-slate-500 mb-5">
          <span>Klient</span>
          <span>
            Masz konto?{" "}
            <Link href={loginHref} className="text-emerald-700 font-semibold hover:underline">
              Zaloguj się
            </Link>
          </span>
        </div>

        {/* Role toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-full mb-5 self-start">
          <Link
            href="/register/trainer"
            className="px-4 py-[7px] rounded-full text-[13px] font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Trener
          </Link>
          <span className="px-4 py-[7px] rounded-full text-[13px] font-medium bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            Klient
          </span>
        </div>

        <h1 className="text-[26px] tracking-[-0.025em] font-semibold mt-0 mb-2">Cześć! Zaczynamy?</h1>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed max-w-[440px]">
          Konto zajmie 30 sekund. Resztę uzupełnisz później w swoim panelu.
        </p>

        <div className="max-w-[440px]">
          <GoogleAuthButton next={next} />
        </div>
        <form action={action} className="grid gap-4 max-w-[440px] mt-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Imię i nazwisko</label>
            <input
              type="text"
              name="display_name"
              required
              autoComplete="name"
              className="w-full h-11 px-3.5 rounded-[10px] border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
            />
          </div>

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

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Hasło</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
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
            <p className="text-[12px] text-slate-500 mt-1.5">Min. 8 znaków.</p>
          </div>

          <label className="flex gap-2.5 items-start text-[13px] text-slate-700 leading-[1.45] mt-1">
            <input
              type="checkbox"
              required
              defaultChecked
              className="w-4 h-4 mt-0.5 accent-emerald-500 shrink-0"
            />
            <span>
              Akceptuję{" "}
              <Link href="/regulamin" className="text-emerald-700 font-semibold">
                Regulamin
              </Link>{" "}
              i{" "}
              <Link href="/prywatnosc" className="text-emerald-700 font-semibold">
                Politykę prywatności
              </Link>
              .
            </span>
          </label>

          <label className="flex gap-2.5 items-start text-[13px] text-slate-600 leading-[1.45]">
            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-500 shrink-0" />
            <span>Chcę dostawać porady wellness na maila (1 wiadomość / tyg., max).</span>
          </label>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5">
              {state.error}
            </p>
          )}
          {state?.info && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-[10px] px-3.5 py-2.5">
              {state.info}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full h-12 mt-1.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-[0_8px_24px_-8px_rgba(16,185,129,0.4)] inline-flex items-center justify-center gap-2 hover:brightness-105 transition disabled:opacity-60"
          >
            {pending ? "Tworzenie konta..." : "Zarejestruj się →"}
          </button>
        </form>
      </section>
    </div>
  );
}
