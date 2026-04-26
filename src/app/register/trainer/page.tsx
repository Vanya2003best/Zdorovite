import Link from "next/link";
import { redirect } from "next/navigation";
import { specializations } from "@/data/specializations";
import { getCurrentUser, isTrainer } from "@/lib/auth";
import TrainerSignupForm from "./TrainerSignupForm";

export default async function TrainerRegisterPage() {
  // Already a trainer? Skip the signup, send them straight to Studio.
  const cu = await getCurrentUser();
  if (cu && isTrainer(cu.profile)) redirect("/studio");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[100dvh] bg-slate-100">
      {/* ============ LEFT: emerald brand panel ============ */}
      <aside className="relative hidden lg:flex flex-col justify-between p-9 lg:p-11 text-white overflow-hidden bg-[radial-gradient(120%_120%_at_0%_0%,#047857_0%,#065f46_60%,#022c22_100%)]">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_80%_30%,rgba(16,185,129,0.4),transparent_70%)]" />
        <div className="pointer-events-none absolute right-[-100px] bottom-[-80px] w-80 h-80 rounded-full [background:radial-gradient(circle,rgba(110,231,183,0.3),transparent_70%)]" />

        {/* Top: logo */}
        <div className="relative z-[2] flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[9px] bg-white/[0.16] inline-flex items-center justify-center font-bold text-base">
              Z
            </span>
            <span className="text-base font-semibold tracking-[-0.01em]">NaZdrow!</span>
          </Link>
        </div>

        {/* Middle: pitch */}
        <div className="relative z-[2] max-w-[440px]">
          <div className="text-[12px] tracking-[0.12em] uppercase font-semibold opacity-80 mb-3.5">
            Dla trenerów
          </div>
          <h2 className="text-[32px] sm:text-[36px] leading-[1.08] tracking-[-0.025em] font-semibold m-0 mb-4">
            Twój gabinet zawsze otwarty.
          </h2>
          <p className="text-sm leading-relaxed opacity-85 max-w-[360px] mb-7">
            Zbuduj profil w 15 minut. Wybierz jeden z 7 szablonów. Zacznij przyjmować rezerwacje
            jeszcze dziś — bez prowizji od pierwszej sesji.
          </p>
          <div className="grid gap-3">
            {[
              ["Bez prowizji przez 30 dni", "Plan Free do 3 klientów. Bez karty."],
              ["7 szablonów profilu", "Od Minimal po Signature — Twój styl, Twój ton."],
              ["Płatności i rezerwacje", "BLIK, karta, Przelewy24. Pieniądze następnego dnia."],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3 items-start text-[13px] leading-[1.45]">
                <span className="min-w-[26px] h-[26px] rounded-lg bg-white/[0.16] inline-flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <b className="block font-semibold mb-0.5">{title}</b>
                  <span className="opacity-80">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: stats */}
        <div className="relative z-[2] flex gap-7 flex-wrap">
          <div>
            <div className="text-[22px] font-bold tracking-[-0.02em]">2 412</div>
            <div className="text-[11px] opacity-70 tracking-wider uppercase mt-0.5">Trenerów na platformie</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tracking-[-0.02em]">38k</div>
            <div className="text-[11px] opacity-70 tracking-wider uppercase mt-0.5">Sesji w 2026</div>
          </div>
          <div>
            <div className="text-[22px] font-bold tracking-[-0.02em]">4,89★</div>
            <div className="text-[11px] opacity-70 tracking-wider uppercase mt-0.5">Średnia ocena</div>
          </div>
        </div>
      </aside>

      {/* ============ RIGHT: form panel ============ */}
      <section className="flex flex-col bg-white p-6 sm:p-9 lg:p-11 overflow-y-auto">
        {/* Mobile-only logo */}
        <Link href="/" className="lg:hidden inline-flex items-center gap-2.5 mb-8">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            Z
          </span>
          <span className="font-semibold text-[17px] tracking-[-0.01em]">NaZdrow!</span>
        </Link>

        <div className="flex justify-between text-[13px] text-slate-500 mb-6">
          <span>Trener</span>
          <span>
            Masz konto?{" "}
            <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
              Zaloguj się
            </Link>
          </span>
        </div>

        {/* Role toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-full mb-6 self-start">
          <span className="px-4 py-[7px] rounded-full text-[13px] font-medium bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            Trener
          </span>
          <Link
            href="/register"
            className="px-4 py-[7px] rounded-full text-[13px] font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Klient
          </Link>
        </div>

        <h1 className="text-[28px] tracking-[-0.025em] font-semibold mt-0 mb-2">Załóż konto trenera</h1>
        <p className="text-sm text-slate-600 mb-7 leading-relaxed max-w-[480px]">
          Konto + podstawy profilu w jednym kroku. Po założeniu wylądujesz w panelu Studio,
          gdzie dodasz usługi, pakiety i ustawisz wygląd.
        </p>

        <div className="max-w-[560px]">
          <TrainerSignupForm specializations={specializations} />
        </div>
      </section>
    </div>
  );
}
