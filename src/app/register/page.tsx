"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { register, type RegisterState } from "./actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[100dvh] bg-slate-100">
      {/* ============ LEFT: photo brand panel ============ */}
      <aside className="relative hidden lg:flex flex-col justify-between p-9 lg:p-11 text-white overflow-hidden bg-slate-900">
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
          <div className="text-[12px] tracking-[0.12em] uppercase font-semibold opacity-80 mb-3.5">
            Dla klientów
          </div>
          <h2 className="text-[32px] sm:text-[36px] leading-[1.08] tracking-[-0.025em] font-semibold m-0 mb-4">
            Trener, który Cię rozumie. W 5 minut.
          </h2>
          <p className="text-sm leading-relaxed opacity-85 max-w-[360px] mb-7">
            Powiedz nam o sobie, a my dobierzemy 3 trenerów dopasowanych do celu, dostępności i budżetu.
            Pierwsza sesja — zwrot pieniędzy w 7 dni jeśli nie pasuje.
          </p>
          <div className="grid gap-3">
            {[
              ["★", "Tylko zweryfikowani trenerzy", "Sprawdzamy certyfikaty i opinie. 4,89 średnia ocena."],
              ["↻", "Gwarancja zwrotu", "Pierwsza sesja Cię nie przekonała? Zwracamy 100% w 7 dni."],
              ["⚡", "Dopasowanie w 5 minut", "Krótki quiz → 3 propozycje. Bez przeglądania setek profili."],
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

        {/* Bottom: avatar row */}
        <div className="relative z-[3] flex gap-2.5 items-center">
          <div className="flex">
            {[
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=faces",
              "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=faces",
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=faces",
            ].map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className={`w-[30px] h-[30px] rounded-full border-2 border-slate-900 object-cover ${i > 0 ? "-ml-2.5" : ""}`}
              />
            ))}
          </div>
          <span className="text-xs text-white/70">
            Dołącz do 14 200 osób, które już ćwiczą z NaZdrow!
          </span>
        </div>
      </aside>

      {/* ============ RIGHT: form panel ============ */}
      <section className="flex flex-col bg-white p-6 sm:p-9 lg:p-11">
        {/* Mobile-only logo */}
        <Link href="/" className="lg:hidden inline-flex items-center gap-2.5 mb-8">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            Z
          </span>
          <span className="font-semibold text-[17px] tracking-[-0.01em]">NaZdrow!</span>
        </Link>

        <div className="flex justify-between text-[13px] text-slate-500 mb-6">
          <span>Klient</span>
          <span>
            Masz konto?{" "}
            <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
              Zaloguj się
            </Link>
          </span>
        </div>

        {/* Role toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-full mb-6 self-start">
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

        <h1 className="text-[28px] tracking-[-0.025em] font-semibold mt-0 mb-2">Cześć! Zaczynamy?</h1>
        <p className="text-sm text-slate-600 mb-7 leading-relaxed max-w-[440px]">
          Konto zajmie 30 sekund. Resztę dopowiesz w krótkim quizie po rejestracji.
        </p>

        <form action={action} className="grid gap-4 max-w-[440px]">
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
            <p className="text-[11.5px] text-slate-500 mt-1.5">Min. 8 znaków.</p>
          </div>

          <label className="flex gap-2.5 items-start text-[12.5px] text-slate-700 leading-[1.45] mt-1">
            <input
              type="checkbox"
              required
              defaultChecked
              className="w-4 h-4 mt-0.5 accent-emerald-500 shrink-0"
            />
            <span>
              Akceptuję{" "}
              <Link href="#" className="text-emerald-700 font-semibold">
                Regulamin
              </Link>{" "}
              i{" "}
              <Link href="#" className="text-emerald-700 font-semibold">
                Politykę prywatności
              </Link>
              .
            </span>
          </label>

          <label className="flex gap-2.5 items-start text-[12.5px] text-slate-600 leading-[1.45]">
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
            className="w-full h-12 mt-1 rounded-[10px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-[0_8px_24px_-8px_rgba(16,185,129,0.4)] inline-flex items-center justify-center gap-2 hover:brightness-105 transition disabled:opacity-60"
          >
            {pending ? "Tworzenie konta..." : "Zarejestruj się →"}
          </button>
        </form>

        <p className="text-[13px] text-slate-600 text-center mt-auto pt-4 max-w-[440px] leading-relaxed">
          Klikając „Zarejestruj się" akceptujesz nasze warunki. Zwrot pieniędzy gwarantowany przez 7 dni od pierwszej sesji.
        </p>
      </section>
    </div>
  );
}
