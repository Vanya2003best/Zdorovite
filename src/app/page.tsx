import Link from "next/link";
import { specializations } from "@/data/specializations";
import { getTopTrainers } from "@/lib/db/trainers";
import TrainerCard from "@/components/TrainerCard";

const coverImages: Record<string, string> = {
  "anna-kowalska": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&h=450&fit=crop",
  "marek-nowak": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=450&fit=crop",
  "katarzyna-zielinska": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=450&fit=crop",
  "jakub-wisniewski": "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=450&fit=crop",
  "ewa-dabrowska": "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=600&h=450&fit=crop",
  "tomasz-kaczmarek": "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=600&h=450&fit=crop",
};

const fallbackCover = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=450&fit=crop";

const trainerCounts: Record<string, number> = {
  "weight-loss": 284, "muscle-gain": 198, "rehabilitation": 142,
  "flexibility": 96, "cardio": 167, "strength": 221,
  "crossfit": 78, "yoga": 134, "martial-arts": 61, "nutrition": 89,
};

export default async function Home() {
  const topTrainers = await getTopTrainers(3);

  return (
    <div>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(900px_500px_at_100%_10%,rgba(20,184,166,0.14),transparent_60%),linear-gradient(180deg,#f0fdf4_0%,#ffffff_65%)]">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          {/* Desktop: 2-col grid */}
          <div className="sm:grid sm:grid-cols-[1.05fr_1fr] sm:gap-16 sm:items-center sm:pt-3 sm:pb-8 pt-5 pb-7">
            <div>
              {/* Eyebrow */}
              <span className="inline-flex items-center gap-2.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-[13px] text-slate-700 font-medium shadow-[0_1px_2px_rgba(2,6,23,0.04)] mb-5">
                <span className="bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1">Nowość</span>
                <span className="hidden sm:inline">Ponad 1 200 zweryfikowanych trenerów w Polsce</span>
                <span className="sm:hidden">1 200+ trenerów w Polsce</span>
              </span>

              <h1 className="text-[38px] sm:text-[68px] leading-[1.05] sm:leading-[1.02] tracking-[-0.035em] sm:tracking-[-0.04em] font-semibold text-slate-950 mt-5 mb-5">
                Znajdź trenera,
                <br className="hidden sm:block" />{" "}
                który
                <span className="bg-[linear-gradient(135deg,#059669_0%,#0d9488_60%,#10b981_100%)] bg-clip-text text-transparent">
                  {" "}zmieni Twoje życie.
                </span>
              </h1>

              <p className="text-[15px] sm:text-[19px] text-slate-600 leading-relaxed sm:leading-[1.55] sm:max-w-[520px] mb-5 sm:mb-8">
                Odchudzanie, masa mięśniowa, joga, rehabilitacja — dopasuj trenera do
                <span className="hidden sm:inline"> swojego</span> celu, lokalizacji i budżetu.
                <span className="hidden sm:inline"> Zweryfikowane profile, prawdziwe opinie, bezpieczne rezerwacje.</span>
              </p>

              {/* CTAs */}
              <div className="grid gap-2.5 sm:flex sm:gap-3 mb-5 sm:mb-10">
                <Link href="/trainers" className="flex items-center justify-center gap-2 h-14 sm:h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[15px] font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition sm:px-6">
                  Znajdź trenera
                  <svg className="hidden sm:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                </Link>
                <Link href="/account/become-trainer" className="flex items-center justify-center h-14 sm:h-14 border border-slate-200 bg-white text-slate-900 rounded-xl text-[15px] font-medium hover:border-slate-400 transition sm:px-6">
                  Dołącz jako trener
                </Link>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                <div className="flex -space-x-2">
                  {[
                    "photo-1548690312-e3b507d8c110", "photo-1571019613454-1cb2f99b2d8b",
                    "photo-1567013127542-490d757e51fc", "photo-1594381898411-846e7d193883",
                    "photo-1599058917212-d750089bc07e",
                  ].map((id, i) => (
                    <img key={i} src={`https://images.unsplash.com/${id}?w=120&h=120&fit=crop&crop=faces`} alt="" className={`w-7 sm:w-9 h-7 sm:h-9 rounded-full border-2 border-white object-cover ${i > 2 ? "hidden sm:block" : ""}`} />
                  ))}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 leading-snug">
                  <strong className="block text-slate-900 font-semibold">4.9 ★ · 12 400+ opinii</strong>
                  <span className="text-slate-500">Ponad 38 000 zrealizowanych treningów</span>
                </div>
              </div>
            </div>

            {/* Hero visual — desktop: tilted cards, mobile: 2 cards */}
            <div className="relative h-[240px] mt-6 sm:h-[580px] sm:mt-0">
              {/* Desktop cards */}
              <div className="hidden sm:block">
                <div className="absolute top-0 left-10 w-[300px] h-[380px] rounded-[20px] overflow-hidden shadow-[0_30px_60px_-20px_rgba(2,6,23,0.18),0_10px_24px_-8px_rgba(2,6,23,0.08)] border border-white/90 -rotate-3">
                  <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=760&fit=crop" alt="" className="w-full h-full object-cover" />
                  <div className="absolute left-5 right-5 bottom-3.5 bg-white/92 backdrop-blur-lg rounded-xl p-2.5 px-3 flex items-center justify-between text-[13px] shadow-[0_4px_12px_rgba(2,6,23,0.06)]">
                    <div>
                      <div className="font-semibold">Anna Kowalska</div>
                      <div className="text-[11px] text-slate-500">Odchudzanie · Warszawa</div>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      4.9
                    </span>
                  </div>
                </div>
                <div className="absolute top-[60px] right-0 w-[260px] h-[340px] rounded-[20px] overflow-hidden shadow-[0_30px_60px_-20px_rgba(2,6,23,0.18)] border border-white/90 rotate-[4deg]">
                  <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=760&fit=crop" alt="" className="w-full h-full object-cover" />
                  <div className="absolute left-5 right-5 bottom-3.5 bg-white/92 backdrop-blur-lg rounded-xl p-2.5 px-3 flex items-center justify-between text-[13px] shadow-[0_4px_12px_rgba(2,6,23,0.06)]">
                    <div>
                      <div className="font-semibold">Katarzyna Z.</div>
                      <div className="text-[11px] text-slate-500">Joga · Wrocław</div>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      5.0
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-[110px] w-[280px] h-[180px] rounded-[20px] overflow-hidden shadow-[0_30px_60px_-20px_rgba(2,6,23,0.18)] border border-white/90 rotate-2">
                  <img src="https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=400&fit=crop" alt="" className="w-full h-full object-cover" />
                  <div className="absolute left-5 right-5 bottom-3.5 bg-white/92 backdrop-blur-lg rounded-xl p-2.5 px-3 flex items-center justify-between text-[13px] shadow-[0_4px_12px_rgba(2,6,23,0.06)]">
                    <div>
                      <div className="font-semibold">Marek Nowak</div>
                      <div className="text-[11px] text-slate-500">Siła · Kraków</div>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      4.8
                    </span>
                  </div>
                </div>
                {/* Floating notification */}
                <div className="absolute -top-2.5 -right-5 bg-white rounded-[14px] p-3 px-3.5 shadow-lg border border-slate-200 flex items-center gap-2.5 text-[13px]">
                  <span className="w-8 h-8 rounded-[10px] bg-emerald-50 text-emerald-700 inline-flex items-center justify-center text-base">✓</span>
                  <div>
                    <div className="font-semibold">Rezerwacja potwierdzona</div>
                    <div className="text-xs text-slate-500">Jutro, 18:00 · Warszawa</div>
                  </div>
                </div>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden">
                <div className="absolute left-0 top-0 w-[180px] h-[220px] rounded-2xl overflow-hidden shadow-[0_20px_40px_-14px_rgba(2,6,23,0.2)] border border-white/80 -rotate-[4deg]">
                  <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&fit=crop" alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md rounded-[10px] px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                    <strong className="text-slate-900">Anna K.</strong><span>4.9 ★</span>
                  </div>
                </div>
                <div className="absolute right-0 top-5 w-[160px] h-[200px] rounded-2xl overflow-hidden shadow-[0_20px_40px_-14px_rgba(2,6,23,0.2)] border border-white/80 rotate-[4deg]">
                  <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&fit=crop" alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-md rounded-[10px] px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                    <strong className="text-slate-900">Kasia Z.</strong><span>5.0 ★</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CATEGORIES ============ */}
      <section className="px-5 py-9 sm:py-24 sm:mx-auto sm:max-w-[1200px] sm:px-6">
        <div className="sm:max-w-[640px] sm:mb-10">
          <span className="text-[11px] sm:text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Specjalizacje</span>
          <h2 className="text-2xl sm:text-[32px] font-semibold tracking-tight mt-1 sm:mt-2 mb-2 sm:mb-3">
            <span className="sm:hidden">Wybierz cel</span>
            <span className="hidden sm:inline">Wybierz cel — znajdź eksperta</span>
          </h2>
          <p className="text-sm sm:text-[17px] text-slate-600 sm:leading-relaxed">
            Każdy trener <span className="hidden sm:inline">jest </span>zweryfikowany pod kątem certyfikatów<span className="hidden sm:inline"> i doświadczenia w swojej dziedzinie</span>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3.5">
          {specializations.map((spec) => (
            <Link
              key={spec.id}
              href={`/trainers?spec=${spec.id}`}
              className="flex items-center gap-3 p-3.5 sm:flex-col sm:gap-4 sm:p-5 border border-slate-200 rounded-xl sm:rounded-[14px] bg-white hover:border-emerald-500 hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-[10px] sm:rounded-xl bg-emerald-50 inline-flex items-center justify-center text-lg sm:text-[22px]">
                {spec.icon}
              </div>
              <div>
                <div className="text-[13px] sm:text-[15px] font-semibold text-slate-900">{spec.label}</div>
                <div className="text-[11px] sm:text-[13px] text-slate-500">{trainerCounts[spec.id] ?? 80} trenerów</div>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/trainers" className="block text-center mt-3.5 text-[13px] text-emerald-700 font-medium sm:hidden">
          Zobacz wszystkie 10 kategorii →
        </Link>
      </section>

      {/* ============ TOP TRAINERS ============ */}
      <section className="py-9 sm:py-24 bg-slate-50">
        <div className="px-5 sm:mx-auto sm:max-w-[1200px] sm:px-6">
          <div className="sm:flex sm:items-end sm:justify-between sm:mb-10 mb-5">
            <div className="sm:max-w-[560px]">
              <span className="text-[11px] sm:text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Top tygodnia</span>
              <h2 className="text-2xl sm:text-[32px] font-semibold tracking-tight mt-1 sm:mt-2 mb-1 sm:mb-3">Najlepiej oceniani trenerzy</h2>
              <p className="text-sm sm:text-[17px] text-slate-600 sm:leading-relaxed">
                <span className="sm:hidden">Swipe → aby zobaczyć więcej</span>
                <span className="hidden sm:inline">Wybierani na podstawie opinii klientów z ostatnich 30 dni.</span>
              </p>
            </div>
            <Link href="/trainers" className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition">
              Zobacz wszystkich →
            </Link>
          </div>

          {/* Mobile: horizontal scroll */}
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-2 snap-x snap-mandatory sm:hidden">
            {topTrainers.map((t) => (
              <Link key={t.id} href={`/trainers/${t.id}`} className="shrink-0 w-[280px] snap-start bg-white border border-slate-200 rounded-[14px] overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img src={coverImages[t.id] ?? fallbackCover} alt="" className="w-full h-full object-cover" />
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
          <div className="hidden sm:grid sm:grid-cols-3 gap-5">
            {topTrainers.map((trainer) => (
              <TrainerCard key={trainer.id} trainer={trainer} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="px-5 py-9 sm:py-24 sm:mx-auto sm:max-w-[1200px] sm:px-6">
        <div className="sm:max-w-[640px] sm:mb-10">
          <span className="text-[11px] sm:text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Jak to działa</span>
          <h2 className="text-2xl sm:text-[32px] font-semibold tracking-tight mt-1 sm:mt-2 mb-2 sm:mb-3">
            <span className="sm:hidden">Trzy kroki do pierwszego treningu</span>
            <span className="hidden sm:inline">Od poszukiwania do pierwszego treningu</span>
          </h2>
          <p className="hidden sm:block text-[17px] text-slate-600 leading-relaxed">
            Trzy proste kroki, które prowadzą Cię do trenera dopasowanego do Twojego celu.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-6 mt-4 sm:mt-0">
          {[
            {
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
              num: "01", title: "Znajdź trenera",
              descM: "Filtruj po specjalizacji, lokalizacji i cenie.",
              descD: "Filtruj po specjalizacji, lokalizacji, cenie i opiniach. Porównaj ofertę kilku trenerów w jednym miejscu.",
            },
            {
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
              num: "02", title: "Zarezerwuj termin",
              descM: "Wybierz pakiet lub sesję, potwierdź w kilka kliknięć.",
              descD: "Wybierz pakiet lub pojedynczą sesję, sprawdź dostępność i potwierdź w kilka kliknięć.",
            },
            {
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>,
              num: "03", title: "Trenuj i zmieniaj się",
              descM: "Sala, dom lub online — płatność przez platformę.",
              descD: "Spotkaj się z trenerem na sali, w domu lub online. Opłacasz sesje bezpiecznie przez platformę.",
            },
          ].map((step) => (
            <div key={step.num} className="bg-white border border-slate-200 rounded-[14px] sm:rounded-2xl p-4.5 sm:p-7 relative">
              <span className="absolute top-5 sm:top-6 right-5 sm:right-6 font-mono text-xs text-slate-400">{step.num}</span>
              <span className="w-10 sm:w-12 h-10 sm:h-12 rounded-[10px] sm:rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center mb-3.5 sm:mb-4">
                <span className="w-5 sm:w-[22px] h-5 sm:h-[22px]">{step.icon}</span>
              </span>
              <h4 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{step.title}</h4>
              <p className="text-[13px] sm:text-sm text-slate-600 leading-relaxed sm:leading-relaxed">
                <span className="sm:hidden">{step.descM}</span>
                <span className="hidden sm:inline">{step.descD}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CTA FOR TRAINERS ============ */}
      <section className="px-5 pb-7 sm:pb-24 sm:mx-auto sm:max-w-[1200px] sm:px-6">
        <div className="rounded-[20px] sm:rounded-3xl overflow-hidden relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900">
          <div className="absolute inset-0 bg-[radial-gradient(600px_300px_at_90%_120%,rgba(16,185,129,0.35),transparent_60%),radial-gradient(400px_300px_at_10%_-20%,rgba(20,184,166,0.25),transparent_60%)]" />
          <div className="relative p-8 sm:p-16 sm:grid sm:grid-cols-[1.2fr_1fr] sm:gap-12 sm:items-center">
            <div>
              <span className="text-[11px] sm:text-[13px] uppercase tracking-[0.08em] text-emerald-300 font-medium">Dla trenerów</span>
              <h2 className="text-[26px] sm:text-[40px] font-semibold tracking-tight text-white mt-1.5 sm:mt-2 mb-3 sm:mb-4 leading-[1.15] sm:leading-[1.1]">
                Zostań widocznym trenerem w Polsce.
              </h2>
              <p className="text-sm sm:text-[17px] text-white/80 leading-relaxed mb-5 sm:mb-7 sm:max-w-[480px]">
                <span className="sm:hidden">Profesjonalny profil w 10 minut, 0% prowizji przez 3 miesiące.</span>
                <span className="hidden sm:inline">Stwórz profesjonalny profil w 10 minut, zarządzaj kalendarzem, rezerwacjami i opiniami — wszystko w jednym miejscu.</span>
              </p>
              <div className="sm:flex sm:gap-3">
                <Link href="/account/become-trainer" className="flex items-center justify-center w-full sm:w-auto h-14 sm:h-14 bg-white text-slate-900 rounded-xl px-6 text-[15px] font-semibold hover:bg-slate-50 transition">
                  Zacznij za darmo
                </Link>
                <Link href="#" className="hidden sm:flex items-center justify-center h-14 border border-white/30 text-white rounded-xl px-6 text-[15px] font-medium hover:bg-white/10 transition">
                  Zobacz jak to działa
                </Link>
              </div>
            </div>
            {/* Desktop: feature checklist */}
            <div className="hidden sm:block bg-white/[0.06] border border-white/[0.14] rounded-2xl p-6 backdrop-blur-lg">
              <ul className="space-y-4">
                {[
                  { title: "6 szablonów profilu", desc: "Premium i Cozy w darmowym planie, plus 4 szablony PRO." },
                  { title: "0% prowizji przez 3 miesiące", desc: "Dla trenerów dołączających do końca maja." },
                  { title: "Kalendarz i płatności", desc: "Automatyczne rozliczenia i faktury przez system." },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3 text-sm text-white/85 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-emerald-950 inline-flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </span>
                    <div>
                      <strong className="block text-white font-semibold mb-0.5">{item.title}</strong>
                      {item.desc}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MOBILE BOTTOM TAB BAR ============ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 grid grid-cols-4 px-4 pt-2.5 pb-3.5 sm:hidden">
        {[
          { label: "Główna", active: true, href: "/", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12L12 3l9 9M5 10v10h14V10" /></svg> },
          { label: "Szukaj", active: false, href: "/trainers", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg> },
          { label: "Zapisane", active: false, href: "#", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" /></svg> },
          { label: "Profil", active: false, href: "#", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /></svg> },
        ].map((tab) => (
          <Link key={tab.label} href={tab.href} className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium ${tab.active ? "text-emerald-600" : "text-slate-500"}`}>
            <span className="w-[22px] h-[22px]">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="h-20 sm:hidden" />
    </div>
  );
}
