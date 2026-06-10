import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cennik · NaZdrow!",
  description:
    "0% prowizji od sesji — zawsze. Płacisz tylko stały abonament, klient płaci bezpośrednio Tobie. Trzy plany dla trenerów: 39, 69, 99 zł/miesiąc.",
};

type Tier = {
  id: "start" | "pro" | "max";
  name: string;
  price: number;
  tagline: string;
  bestFor: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "start",
    name: "Start",
    price: 39,
    tagline: "Wszystko, czego potrzeba, żeby zacząć przyjmować klientów online.",
    bestFor: "Nowi trenerzy budujący portfolio",
    features: [
      "Profil z 2 szablonami (Premium, Cozy)",
      "Kalendarz + rezerwacje online",
      "Czat z klientami w aplikacji",
      "Do 20 aktywnych klientów",
      "Płatność klient → Tobie (BLIK / przelew / gotówka)",
    ],
    ctaLabel: "Zarejestruj się",
    ctaHref: "/register/trainer",
  },
  {
    id: "pro",
    name: "PRO",
    price: 69,
    tagline: "Wyróżnij się — premium szablony i marketingowe narzędzia.",
    bestFor: "Aktywni trenerzy z istniejącą bazą klientów",
    features: [
      "Wszystko ze Start, plus:",
      "4 szablony PRO (Cinematic, Luxury, Signature, Studio)",
      "Promowanie w wyszukiwarce",
      "Bez limitu aktywnych klientów",
      "Statystyki przychodu i konwersji",
      "Pakiety sesyjne (4× / 8×)",
    ],
    ctaLabel: "Wybierz PRO",
    ctaHref: "/register/trainer?tier=pro",
    highlight: true,
  },
  {
    id: "max",
    name: "MAX",
    price: 99,
    tagline: "Pełna kontrola brandu i priorytetowe wsparcie.",
    bestFor: "Studia treningowe i renomowani trenerzy",
    features: [
      "Wszystko z PRO, plus:",
      "Domena .pl pod własnym brandem",
      "Priorytetowe miejsce w rekomendacjach",
      "Verification badge",
      "Dedykowane wsparcie (response < 4h)",
      "Wczesny dostęp do nowych funkcji",
    ],
    ctaLabel: "Wybierz MAX",
    ctaHref: "/register/trainer?tier=max",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Czy NaZdrow! pobiera prowizję od sesji?",
    a: "Nie. Nigdy. To nasz najważniejszy committment — kliknij sesję za 150 zł, dostajesz pełne 150 zł. Platforma utrzymuje się ze stałego abonamentu, nie z Twojej pracy.",
  },
  {
    q: "Jak klient mi płaci?",
    a: "Bezpośrednio. BLIK, przelew, gotówka na miejscu — to ustalasz Ty. NaZdrow! nie jest pośrednikiem płatności; trzymamy się z dala od Twoich pieniędzy.",
  },
  {
    q: "Mogę zmienić plan w trakcie miesiąca?",
    a: "Tak. Upgrade jest natychmiastowy z proporcjonalną dopłatą; downgrade wchodzi w życie od kolejnego okresu rozliczeniowego.",
  },
  {
    q: "Co jeśli rezygnuję?",
    a: "Bez kar. Anulujesz w ustawieniach, profil zostaje aktywny do końca opłaconego okresu, potem przechodzi w tryb tylko-do-odczytu (klienci dalej widzą historię, ale nowych rezerwacji nie ma).",
  },
];

export default function CennikPage() {
  return (
    <div className="bg-slate-100 min-h-screen">
      {/* ====================== HERO ====================== */}
      <section className="text-white pt-12 pb-14" style={{ background: "#002f34" }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 text-center">
          <span className="inline-block px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-[12px] font-bold text-emerald-300 mb-4 uppercase tracking-[0.08em]">
            Cennik dla trenerów
          </span>
          <h1 className="m-0 text-[36px] sm:text-[48px] leading-[1.05] tracking-[-0.025em] font-bold">
            <span className="text-emerald-400">0% prowizji</span> od sesji — zawsze.
          </h1>
          <p className="text-[15px] sm:text-[17px] text-white/80 max-w-[640px] mx-auto mt-4 mb-0">
            Płacisz tylko stały abonament. Klient płaci bezpośrednio Tobie — BLIK, przelew lub gotówka.
            NaZdrow! nigdy nie staje między Tobą a Twoim wynagrodzeniem.
          </p>
        </div>
      </section>

      {/* ====================== TIERS ====================== */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 -mt-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>
      </section>

      {/* ====================== COMPARE TO BOOKSY ====================== */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-12">
        <div className="bg-white rounded-[14px] p-6 sm:p-8 border border-slate-200">
          <h2 className="m-0 text-[22px] sm:text-[26px] tracking-[-0.02em] font-bold text-[#002f34] mb-4">
            Dlaczego inaczej niż Booksy?
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px] min-w-[520px]">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-3 pr-4 font-bold text-[#002f34]"></th>
                  <th className="py-3 px-4 font-bold text-[#002f34]">NaZdrow!</th>
                  <th className="py-3 px-4 font-bold text-slate-500">Booksy / inne</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold">Prowizja od sesji</td>
                  <td className="py-3 px-4 text-emerald-600 font-extrabold">0%</td>
                  <td className="py-3 px-4">5-15%</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold">Stały koszt</td>
                  <td className="py-3 px-4 font-extrabold">39-99 zł/mc</td>
                  <td className="py-3 px-4">0-50 zł/mc</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-semibold">Płatność klienta</td>
                  <td className="py-3 px-4 font-extrabold">Bezpośrednio do trenera</td>
                  <td className="py-3 px-4">Przez platformę</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">Próg opłacalności*</td>
                  <td className="py-3 px-4 font-extrabold">1-3 sesje/mc</td>
                  <td className="py-3 px-4">brak — % rośnie z przychodem</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-4 mb-0 italic">
            * Przy średniej cenie sesji 130 zł: abonament Start (39 zł) zwraca się przy 1. sesji w miesiącu, PRO (69 zł) — przy 1-2, MAX (99 zł) — przy 2-3.
          </p>
        </div>
      </section>

      {/* ====================== FAQ ====================== */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-12">
        <h2 className="m-0 text-[22px] sm:text-[26px] tracking-[-0.02em] font-bold text-[#002f34] mb-4">
          Najczęstsze pytania
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FAQ.map((item) => (
            <div key={item.q} className="bg-white rounded-[10px] p-5 border border-slate-200">
              <h3 className="m-0 text-[14.5px] font-bold text-[#002f34] mb-2">{item.q}</h3>
              <p className="m-0 text-[13px] text-slate-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ====================== FINAL CTA ====================== */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-14">
        <div
          className="rounded-[14px] px-6 sm:px-10 py-10 text-white text-center"
          style={{ background: "linear-gradient(135deg, #002f34 0%, #004a52 100%)" }}
        >
          <h2 className="m-0 text-[24px] sm:text-[30px] tracking-[-0.02em] font-bold mb-3">
            Gotowy zacząć?
          </h2>
          <p className="text-[14px] sm:text-[15px] text-white/80 max-w-[520px] mx-auto mb-6">
            Rejestracja zajmuje 4 minuty. Pierwsze 14 dni bez opłaty — zobacz, jak to działa, zanim cokolwiek zapłacisz.
          </p>
          <Link
            href="/register/trainer"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-3.5 font-bold text-[15px] rounded-md transition"
          >
            Załóż profil trenera
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const highlight = tier.highlight;
  return (
    <div
      className={
        "relative bg-white rounded-[14px] p-6 sm:p-7 border-2 transition flex flex-col " +
        (highlight
          ? "border-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.18)]"
          : "border-slate-200 hover:border-slate-300")
      }
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white rounded-full text-[11px] font-extrabold uppercase tracking-[0.08em]">
          Najpopularniejszy
        </span>
      )}
      <div className="text-[18px] font-extrabold text-[#002f34] mb-1">{tier.name}</div>
      <p className="text-[12.5px] text-slate-500 m-0 mb-4 leading-snug min-h-[36px]">{tier.tagline}</p>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[40px] font-extrabold text-[#002f34] tracking-[-0.03em]">{tier.price}</span>
        <span className="text-[15px] text-slate-500 font-bold">zł / miesiąc</span>
      </div>
      <div className="text-[11.5px] text-slate-500 mb-5">
        Dla: <b className="text-slate-700">{tier.bestFor}</b>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-slate-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 mt-0.5 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={tier.ctaHref}
        className={
          "block text-center w-full py-3 rounded-md font-extrabold text-[13.5px] transition " +
          (highlight
            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
            : "bg-white border-2 border-[#002f34] text-[#002f34] hover:bg-slate-50")
        }
      >
        {tier.ctaLabel}
      </Link>
    </div>
  );
}
