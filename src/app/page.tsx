import Link from "next/link";
import { specializations } from "@/data/specializations";
import { trainers } from "@/data/mock-trainers";
import TrainerCard from "@/components/TrainerCard";

const coverImages: Record<string, string> = {
  "anna-kowalska": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&h=450&fit=crop",
  "marek-nowak": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=450&fit=crop",
  "katarzyna-zielinska": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=450&fit=crop",
};

export default function Home() {
  const topTrainers = trainers.slice(0, 3);
  const topCategories = specializations.slice(0, 6);
  const trainerCounts: Record<string, number> = {
    "weight-loss": 284, "muscle-gain": 198, "yoga": 134,
    "strength": 221, "rehabilitation": 142, "cardio": 167,
  };

  return (
    <div>
      {/* Hero */}
      <section className="px-5 pt-5 pb-7 sm:px-0 sm:pt-0 sm:pb-0 bg-[radial-gradient(500px_300px_at_20%_0%,rgba(16,185,129,0.2),transparent_60%),linear-gradient(180deg,#f0fdf4_0%,#ffffff_70%)] sm:bg-gradient-to-br sm:from-emerald-600 sm:via-emerald-700 sm:to-teal-800">
        <div className="sm:mx-auto sm:max-w-[1200px] sm:px-6 sm:py-24 lg:py-32">
          {/* Mobile eyebrow */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5 pr-3 text-xs text-slate-700 mb-5 sm:hidden">
            <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full text-[11px]">Nowość</span>
            1 200+ trenerów w Polsce
          </div>

          {/* Headline */}
          <h1 className="text-[38px] leading-[1.05] tracking-tighter font-semibold text-slate-950 sm:text-white sm:text-5xl lg:text-6xl sm:max-w-2xl">
            Znajdź trenera, który{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent sm:text-emerald-200">
              zmieni Twoje życie.
            </span>
          </h1>
          <p className="mt-3.5 text-[15px] text-slate-600 leading-relaxed sm:text-lg sm:text-emerald-100 sm:max-w-xl sm:mt-6">
            Odchudzanie, masa, joga, rehabilitacja — dopasuj trenera do celu, lokalizacji i budżetu.
          </p>

          {/* CTAs */}
          <div className="grid gap-2.5 mt-5 sm:flex sm:gap-3 sm:mt-8">
            <Link href="/trainers" className="flex items-center justify-center h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[15px] font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition sm:bg-white sm:from-white sm:to-white sm:text-emerald-700 sm:shadow-lg sm:shadow-emerald-900/20 sm:px-6 sm:h-12 sm:rounded-xl sm:text-sm sm:font-semibold">
              Znajdź trenera →
            </Link>
            <Link href="#" className="flex items-center justify-center h-14 border border-slate-200 bg-white text-slate-900 rounded-xl text-[15px] font-medium hover:border-slate-400 transition sm:border-white/30 sm:bg-transparent sm:text-white sm:hover:bg-white/10 sm:px-6 sm:h-12 sm:rounded-xl sm:text-sm sm:font-semibold">
              Dołącz jako trener
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-[14px] bg-white mt-5 sm:bg-white/10 sm:border-white/20 sm:mt-8 sm:max-w-md">
            <div className="flex -space-x-1.5 shrink-0">
              {[
                "https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=80&h=80&fit=crop&crop=faces",
                "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=80&h=80&fit=crop&crop=faces",
                "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=80&h=80&fit=crop&crop=faces",
              ].map((src, i) => (
                <img key={i} src={src} alt="" className="w-7 h-7 rounded-full border-2 border-white object-cover sm:border-emerald-700" />
              ))}
            </div>
            <div className="text-xs text-slate-600 leading-snug sm:text-emerald-100">
              <strong className="block text-slate-900 font-semibold sm:text-white">4.9 ★ · 12 400+ opinii</strong>
              38 000 zrealizowanych treningów
            </div>
          </div>

          {/* Mobile hero visual — tilted cards */}
          <div className="relative h-[240px] mt-6 sm:hidden">
            <div className="absolute left-0 top-0 w-[180px] h-[220px] rounded-2xl overflow-hidden shadow-[0_20px_40px_-14px_rgba(2,6,23,0.2)] border border-white/80 -rotate-[4deg]">
              <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&fit=crop" alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md rounded-[10px] px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                <strong className="text-slate-900">Anna K.</strong>
                <span>4.9 ★</span>
              </div>
            </div>
            <div className="absolute right-0 top-5 w-[160px] h-[200px] rounded-2xl overflow-hidden shadow-[0_20px_40px_-14px_rgba(2,6,23,0.2)] border border-white/80 rotate-[4deg]">
              <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&fit=crop" alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md rounded-[10px] px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                <strong className="text-slate-900">Kasia Z.</strong>
                <span>5.0 ★</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-5 py-9 sm:py-16 sm:mx-auto sm:max-w-[1200px] sm:px-6">
        <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium sm:hidden">Specjalizacje</span>
        <h2 className="text-2xl font-semibold tracking-tight mt-1 mb-2 sm:text-2xl sm:font-bold sm:text-gray-900">
          Wybierz cel
        </h2>
        <p className="text-sm text-slate-600 mb-5 sm:text-gray-600">
          Każdy trener zweryfikowany pod kątem certyfikatów.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 sm:gap-3">
          {topCategories.map((spec) => (
            <Link
              key={spec.id}
              href={`/trainers?spec=${spec.id}`}
              className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl bg-white hover:shadow-md hover:border-emerald-300 transition sm:flex-col sm:items-center sm:gap-2 sm:p-4 sm:text-center"
            >
              <div className="w-9 h-9 rounded-[10px] bg-emerald-50 inline-flex items-center justify-center text-lg sm:text-3xl sm:w-auto sm:h-auto sm:bg-transparent">
                {spec.icon}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-900 sm:text-sm sm:font-medium sm:text-gray-700">{spec.label}</div>
                <div className="text-[11px] text-slate-500 sm:hidden">{trainerCounts[spec.id] ?? 100}</div>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/trainers" className="block text-center mt-3.5 text-[13px] text-emerald-700 font-medium sm:hidden">
          Zobacz wszystkie 10 kategorii →
        </Link>
      </section>

      {/* Top trainers */}
      <section className="py-9 sm:py-16 bg-slate-50">
        <div className="px-5 sm:mx-auto sm:max-w-[1200px] sm:px-6">
          <div className="sm:flex sm:items-center sm:justify-between mb-5">
            <div>
              <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium sm:hidden">Top tygodnia</span>
              <h2 className="text-2xl font-semibold tracking-tight mt-1 sm:text-2xl sm:font-bold sm:text-gray-900">
                Najlepiej oceniani
              </h2>
              <p className="text-sm text-slate-600 mt-1 sm:text-gray-600">
                <span className="sm:hidden">Swipe → aby zobaczyć więcej</span>
                <span className="hidden sm:inline">Sprawdź trenerów z najlepszymi opiniami</span>
              </p>
            </div>
            <Link href="/trainers" className="hidden sm:inline text-sm font-medium text-emerald-600 hover:text-emerald-700 transition">
              Zobacz wszystkich →
            </Link>
          </div>

          {/* Mobile: horizontal scroll */}
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-2 snap-x snap-mandatory sm:hidden">
            {topTrainers.map((t) => (
              <Link key={t.id} href={`/trainers/${t.id}`} className="shrink-0 w-[280px] snap-start bg-white border border-slate-200 rounded-[14px] overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img src={coverImages[t.id] ?? ""} alt="" className="w-full h-full object-cover" />
                  <span className="absolute top-2.5 left-2.5 bg-white/95 rounded-full px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    {t.rating}
                  </span>
                </div>
                <div className="p-3.5 grid gap-2">
                  <div className="text-[15px] font-semibold">{t.name}</div>
                  <div className="text-xs text-slate-500">📍 {t.location}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {t.specializations.slice(0, 2).map((s) => (
                      <span key={s} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{specializations.find((sp) => sp.id === s)?.label}</span>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 pt-2.5 flex justify-between items-baseline">
                    <div className="text-[13px] font-semibold">od {t.priceFrom} zł <span className="text-[11px] text-slate-500 font-normal">/ sesja</span></div>
                    <span className="text-xs text-emerald-700 font-medium">Profil →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {topTrainers.map((trainer) => (
              <TrainerCard key={trainer.id} trainer={trainer} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-9 sm:py-16 sm:mx-auto sm:max-w-[1200px] sm:px-6">
        <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Jak to działa</span>
        <h2 className="text-2xl font-semibold tracking-tight mt-1 mb-5 sm:mb-8">
          Trzy kroki do pierwszego treningu
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-5">
          {[
            {
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
              num: "01",
              title: "Znajdź trenera",
              desc: "Filtruj po specjalizacji, lokalizacji i cenie.",
            },
            {
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
              num: "02",
              title: "Zarezerwuj termin",
              desc: "Wybierz pakiet lub sesję, potwierdź w kilka kliknięć.",
            },
            {
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>,
              num: "03",
              title: "Trenuj i zmieniaj się",
              desc: "Sala, dom lub online — płatność przez platformę.",
            },
          ].map((step) => (
            <div key={step.num} className="bg-white border border-slate-200 rounded-[14px] p-4.5 sm:p-6">
              <div className="flex justify-between items-center">
                <span className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center">
                  <span className="w-5 h-5">{step.icon}</span>
                </span>
                <span className="font-mono text-xs text-slate-400">{step.num}</span>
              </div>
              <h4 className="text-base font-semibold mt-3.5 mb-1">{step.title}</h4>
              <p className="text-[13px] text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA for trainers */}
      <section className="px-5 pb-7 sm:py-16 sm:mx-auto sm:max-w-[1200px] sm:px-6">
        <div className="rounded-[20px] overflow-hidden relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-8 sm:p-12 text-center sm:text-center">
          <div className="absolute inset-0 bg-[radial-gradient(400px_200px_at_100%_0%,rgba(16,185,129,0.35),transparent_60%)]" />
          <div className="relative">
            <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-300 font-medium">Dla trenerów</span>
            <h2 className="text-[26px] sm:text-3xl font-semibold tracking-tight text-white mt-1.5 mb-3">
              Zostań widocznym trenerem w Polsce
            </h2>
            <p className="text-sm text-white/80 leading-relaxed mb-5 sm:max-w-lg sm:mx-auto">
              Profesjonalny profil w 10 minut, 0% prowizji przez 3 miesiące.
            </p>
            <Link href="#" className="inline-flex items-center justify-center w-full sm:w-auto h-14 sm:h-12 bg-white text-slate-900 rounded-xl px-6 text-[15px] sm:text-sm font-semibold shadow-lg hover:bg-emerald-50 transition">
              Zacznij za darmo →
            </Link>
          </div>
        </div>
      </section>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 grid grid-cols-4 px-4 pt-2.5 pb-3.5 sm:hidden">
        {[
          { label: "Główna", active: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12L12 3l9 9M5 10v10h14V10" /></svg> },
          { label: "Szukaj", active: false, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg> },
          { label: "Zapisane", active: false, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" /></svg> },
          { label: "Profil", active: false, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /></svg> },
        ].map((tab) => (
          <Link key={tab.label} href={tab.label === "Szukaj" ? "/trainers" : "#"} className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium ${tab.active ? "text-emerald-600" : "text-slate-500"}`}>
            <span className="w-[22px] h-[22px]">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </nav>
      {/* Spacer for tab bar */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}
