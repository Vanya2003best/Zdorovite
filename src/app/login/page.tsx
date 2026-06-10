import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

function LoginFormFallback() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="grid gap-1.5">
        <div className="h-3.5 w-12 bg-slate-100 rounded" />
        <div className="h-11 rounded-[10px] bg-slate-100" />
      </div>
      <div className="grid gap-1.5">
        <div className="h-3.5 w-12 bg-slate-100 rounded" />
        <div className="h-11 rounded-[10px] bg-slate-100" />
      </div>
      <div className="h-12 mt-2 rounded-[10px] bg-slate-100" />
    </div>
  );
}

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 lg:fixed lg:inset-0 lg:h-[100dvh] lg:overflow-hidden min-h-[100dvh] bg-slate-100">
      {/* ============ LEFT: brand panel ============ */}
      <aside className="relative hidden lg:flex flex-col justify-between p-8 lg:p-9 text-white overflow-hidden bg-slate-950">
        {/* Glow + decorative circles */}
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_60%_at_70%_30%,rgba(16,185,129,0.3),transparent_60%)]" />
        <div className="pointer-events-none absolute left-10 bottom-10 w-[220px] h-[220px] rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute left-[70px] bottom-[70px] w-40 h-40 rounded-full border border-white/[0.08]" />

        {/* Top: logo */}
        <div className="relative z-[1] flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[9px] bg-white/[0.16] inline-flex items-center justify-center font-bold text-base">
              Z
            </span>
            <span className="text-base font-semibold tracking-[-0.01em]">NaZdrow!</span>
          </Link>
        </div>

        {/* Middle: eyebrow + testimonial */}
        <div className="relative z-[1] max-w-[440px]">
          <div className="text-[11px] tracking-[0.12em] uppercase font-semibold opacity-80 mb-2.5">
            Witaj z powrotem
          </div>
          <h2 className="text-[28px] sm:text-[32px] leading-[1.08] tracking-[-0.025em] font-semibold m-0">
            „NaZdrow! zmieniło sposób, w jaki pracuję z klientami. Mniej Excela, więcej treningu."
          </h2>
          <div className="flex items-center gap-3 mt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1594381898411-846e7d193883?w=120&h=120&fit=crop&crop=faces"
              alt=""
              className="w-11 h-11 rounded-full object-cover border-[1.5px] border-white/30"
            />
            <div>
              <div className="text-sm font-semibold">Anna Kowalska</div>
              <div className="text-xs opacity-60">Trenerka · Warszawa · 4,9★</div>
            </div>
          </div>
        </div>

        {/* Bottom: stats — raised from very bottom */}
        <div className="relative z-[1] mb-16 flex gap-7">
          <div>
            <div className="text-[22px] font-bold tracking-[-0.02em]">8 sek.</div>
            <div className="text-[11px] opacity-70 tracking-wider uppercase mt-0.5">Średni czas logowania</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tracking-[-0.02em]">SSL</div>
            <div className="text-[11px] opacity-70 tracking-wider uppercase mt-0.5">Szyfrowane połączenie</div>
          </div>
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

        <div className="flex justify-between text-[13px] text-slate-500 mb-6">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Wszystko działa
          </span>
          <span>
            Nie masz konta?{" "}
            <Link href={registerHref} className="text-emerald-700 font-semibold hover:underline">
              Załóż
            </Link>
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-[440px] w-full">
          <h1 className="text-[28px] tracking-[-0.025em] font-semibold mt-0 mb-2">Zaloguj się</h1>
          <p className="text-sm text-slate-600 mb-7 leading-relaxed">
            Wpisz email i hasło. Tę samą drogę używają trenerzy i klienci — rozpoznamy Cię automatycznie po roli konta.
          </p>

          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
