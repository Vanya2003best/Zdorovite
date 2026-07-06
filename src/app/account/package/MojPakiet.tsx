"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * /account/package — Mój pakiet (design 39).
 *
 * Four modes via top switcher: Bieżący pakiet / Wykorzystanie / Zmień
 * pakiet / Faktury. Hero card always visible at top with progress ring +
 * key stats. Schema realities:
 *   - packages table exists, bookings.package_id links sessions → 100%
 *     real data for "current usage" + history
 *   - no purchase / subscription records → next-renewal / valid-until are
 *     synthesized from first booking + 30-day default window
 *   - no payment methods, no auto-renewal, no invoicing → those panels
 *     render honest empty states
 */

export type PackageHero = {
  /** Package name from packages.name. */
  name: string;
  description: string;
  /** Total sessions in the package. */
  total: number;
  /** Sessions the trainer marked as completed — the only ones counted as "used". */
  done: number;
  /** Past sessions awaiting the trainer's completion mark ("czeka na potwierdzenie trenera"). */
  pendingConfirmation: number;
  /** Future sessions booked but not held yet (= upcoming). */
  scheduled: number;
  /** First booking date in this package — anchors the validity window. */
  firstBookedIso: string | null;
  /** Last booking date — used to compute days remaining estimate. */
  lastBookedIso: string | null;
  /** Total price paid (sum of price across the package's bookings). */
  pricePaid: number;
  /** price / sessions_total — effective per-session cost. */
  pricePerSession: number;
  /** Trainer name + slug for "with X" subtitle. */
  trainerName: string | null;
  trainerSlug: string | null;
  trainerId: string | null;
};

export type PackageSessionRow = {
  id: string;
  iso: string;
  /** "kwiecień", "maj", etc. month label for the date pill. */
  monthShort: string;
  dayNum: number;
  serviceName: string;
  durationMin: number;
  location: string;
  /** "done" | "pending" (czeka na potwierdzenie trenera) | "upcoming" |
   *  "cancelled" — drives the badge + deduction copy. */
  state: "done" | "pending" | "upcoming" | "cancelled";
  /** Sessions remaining after this row (computed by the server). */
  sessionsLeftAfter: number;
};

export type AlternativePackage = {
  id: string;
  name: string;
  description: string;
  price: number;
  sessionsTotal: number;
  pricePerSession: number;
  /** Saving vs. cheapest option (PLN). 0 when this IS the cheapest. */
  savePln: number;
  /** Whether this is the package currently in use. */
  isCurrent: boolean;
  /** Whether this is the recommended upgrade (highest sessions count among non-current). */
  isPopular: boolean;
  trainerSlug: string;
};

export type MojPakietData = {
  hero: PackageHero | null;
  sessions: PackageSessionRow[];
  alternatives: AlternativePackage[];
  /** Average sessions/week for this package (null when too short). */
  weeklyAvg: number | null;
  /** Days since first booking. */
  daysActive: number;
};

type Mode = "current" | "usage" | "upgrade" | "invoices";

export default function MojPakiet({ data }: { data: MojPakietData }) {
  const [mode, setMode] = useState<Mode>("current");

  if (!data.hero) {
    return <NoPackageState alternatives={data.alternatives} />;
  }

  const consumed = data.hero.done + data.hero.pendingConfirmation + data.hero.scheduled;
  const remaining = Math.max(0, data.hero.total - consumed);
  const pctUsed = Math.round((consumed / Math.max(1, data.hero.total)) * 100);

  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      <Topbar trainerId={data.hero.trainerId} />
      <Hero hero={data.hero} pctUsed={pctUsed} remaining={remaining} />
      <ModeBar mode={mode} onChange={setMode} sessionsCount={consumed} total={data.hero.total} />
      <ModeBanner mode={mode} hero={data.hero} remaining={remaining} weeklyAvg={data.weeklyAvg} />

      {mode === "current" && <CurrentPanel hero={data.hero} sessions={data.sessions} />}
      {mode === "usage" && <UsagePanel sessions={data.sessions} hero={data.hero} weeklyAvg={data.weeklyAvg} daysActive={data.daysActive} />}
      {mode === "upgrade" && <UpgradePanel alternatives={data.alternatives} />}
      {mode === "invoices" && <InvoicesPanel hero={data.hero} />}
    </div>
  );
}

/* ====================== TOPBAR ====================== */

function Topbar({ trainerId }: { trainerId: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
      <div>
        <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Mój pakiet</h1>
        <div className="text-[12.5px] text-slate-500 mt-1">
          Sesje w pakiecie · oszczędności · zmiana planu
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {trainerId && (
          <Link
            href={`/account/messages?with=${trainerId}`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-700 hover:border-slate-300"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            Pytanie do trenera
          </Link>
        )}
        <Link
          href="/account/bookings?mode=book"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
        >
          + Zarezerwuj z pakietu
        </Link>
      </div>
    </div>
  );
}

/* ====================== HERO ====================== */

function Hero({ hero, pctUsed, remaining }: { hero: PackageHero; pctUsed: number; remaining: number }) {
  const validUntil = hero.firstBookedIso ? addDays(hero.firstBookedIso, 30) : null;
  const daysLeft = validUntil ? Math.max(0, Math.round((validUntil.getTime() - Date.now()) / 86_400_000)) : null;
  return (
    <div className="rounded-[16px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 sm:p-6 mb-4 grid grid-cols-1 md:grid-cols-[2fr_auto_1fr_1fr] gap-5 items-center">
      <div>
        <div className="text-[10px] uppercase tracking-[0.08em] opacity-80 font-bold mb-1.5">
          Aktywny pakiet
        </div>
        <div className="text-[22px] font-bold tracking-[-0.018em] mb-1.5">{hero.name}</div>
        <div className="text-[12.5px] opacity-85 leading-[1.5]">{hero.description}</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-[88px] h-[88px]">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeDasharray={`${pctUsed} 100`}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
              pathLength={100}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[18px] font-bold leading-none">{pctUsed}%</div>
            <div className="text-[9px] uppercase opacity-80 mt-0.5">wykorz.</div>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] opacity-80 font-bold">Sesje</div>
          <div className="text-[24px] font-bold tracking-[-0.02em] tabular-nums leading-none">
            {hero.done + hero.pendingConfirmation + hero.scheduled} / {hero.total}
          </div>
          <div className="text-[11px] opacity-85 mt-1">
            {remaining} {plural(remaining, "wolna", "wolne", "wolnych")}
          </div>
          {hero.pendingConfirmation > 0 && (
            <div className="text-[11px] opacity-85 mt-0.5">
              {hero.pendingConfirmation} czeka na potwierdzenie trenera
            </div>
          )}
        </div>
      </div>

      <HeroStat
        label="Ważny do"
        value={validUntil ? `${validUntil.getDate()}` : "—"}
        unit={validUntil ? PL_MONTHS_SHORT[validUntil.getMonth()] : ""}
        detail={daysLeft !== null ? `${daysLeft} ${plural(daysLeft, "dzień", "dni", "dni")}` : "synthesized 30 dni"}
      />
      <HeroStat
        label="Cena za sesję"
        value={hero.pricePerSession.toFixed(0)}
        unit="PLN"
        detail={`Pełny koszt: ${hero.pricePaid} PLN`}
      />
    </div>
  );
}

function HeroStat({ label, value, unit, detail }: { label: string; value: string; unit: string; detail: string }) {
  return (
    <div className="border-l border-white/20 pl-4">
      <div className="text-[10px] uppercase tracking-[0.08em] opacity-80 font-bold mb-1">{label}</div>
      <div className="text-[22px] font-bold tracking-[-0.02em] tabular-nums leading-none">
        {value}
        {unit && <span className="text-[12px] font-medium opacity-80 ml-1">{unit}</span>}
      </div>
      {detail && <div className="text-[11px] opacity-85 mt-1">{detail}</div>}
    </div>
  );
}

/* ====================== MODE BAR ====================== */

function ModeBar({ mode, onChange, sessionsCount, total }: { mode: Mode; onChange: (m: Mode) => void; sessionsCount: number; total: number }) {
  return (
    <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
      <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium">
        {(
          [
            { id: "current", label: "Bieżący pakiet", badge: "" },
            { id: "usage", label: "Wykorzystanie", badge: `${sessionsCount}/${total}` },
            { id: "upgrade", label: "Zmień pakiet", badge: "" },
            { id: "invoices", label: "Faktury", badge: "" },
          ] as { id: Mode; label: string; badge: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={
              "inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] whitespace-nowrap transition " +
              (mode === m.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-900")
            }
          >
            <ModeIcon id={m.id} />
            {m.label}
            {m.badge && (
              <span
                className={
                  "text-[10.5px] font-semibold px-[6px] py-[1px] rounded-[5px] " +
                  (mode === m.id ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700")
                }
              >
                {m.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeBanner({ mode, hero, remaining, weeklyAvg }: { mode: Mode; hero: PackageHero; remaining: number; weeklyAvg: number | null }) {
  const cls = "flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 border ";
  if (mode === "current") {
    return (
      <div className={cls + "bg-emerald-50 border-emerald-200 text-emerald-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            Pakiet aktywny — {hero.done} {plural(hero.done, "sesja zrealizowana", "sesje zrealizowane", "sesji zrealizowanych")} ·
            {hero.pendingConfirmation > 0 && (
              <>{" "}{hero.pendingConfirmation} czeka na potwierdzenie trenera ·</>
            )}
            {" "}{remaining} {plural(remaining, "wolna", "wolne", "wolnych")} do umówienia
          </b>
          <div className="text-emerald-800/80 mt-0.5">
            Niewykorzystane sesje wygasają z końcem cyklu. Anulacja bez kosztów do 24h przed sesją.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "usage") {
    return (
      <div className={cls + "bg-sky-50 border-sky-200 text-sky-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-sky-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {hero.done} {plural(hero.done, "sesja wykorzystana", "sesje wykorzystane", "sesji wykorzystanych")} ·
            {hero.pendingConfirmation > 0 && (
              <>{" "}{hero.pendingConfirmation} czeka na potwierdzenie trenera ·</>
            )}
            {" "}{hero.scheduled} zaplanowane · {remaining} do umówienia
          </b>
          <div className="text-sky-800/80 mt-0.5">
            {weeklyAvg != null
              ? `Średnio ${weeklyAvg.toFixed(1)} sesji / tydzień. ${weeklyAvg < 1.5 ? "Sugestia: zwiększ tempo, by wyrobić pakiet w terminie." : "Świetne tempo — utrzymuj rytm."}`
              : "Pierwsze sesje już za Tobą — zarezerwuj kolejne, by wyrobić pakiet."}
          </div>
        </div>
      </div>
    );
  }
  if (mode === "upgrade") {
    return (
      <div className={cls + "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-fuchsia-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5-5 5 5" /></svg>
        </span>
        <div>
          <b className="font-semibold">Inne pakiety u tego samego trenera</b>
          <div className="text-fuchsia-800/80 mt-0.5">
            Większy pakiet = niższa cena za sesję. Płacisz raz, sesje rezerwujesz w dowolnym terminie.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cls + "bg-slate-100 border-slate-200 text-slate-700"}>
      <span className="w-7 h-7 rounded-[8px] bg-slate-500 text-white inline-flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16" /></svg>
      </span>
      <div>
        <b className="font-semibold">Faktury</b>
        <div className="text-slate-500 mt-0.5">
          Faktury elektroniczne pojawią się tutaj po wprowadzeniu modułu fakturowego.
        </div>
      </div>
    </div>
  );
}

/* ====================== CURRENT PANEL ====================== */

function CurrentPanel({ hero, sessions }: { hero: PackageHero; sessions: PackageSessionRow[] }) {
  const slots: ("done" | "pending" | "upcoming" | "free")[] = [];
  for (let i = 0; i < hero.total; i++) {
    if (i < hero.done) slots.push("done");
    else if (i < hero.done + hero.pendingConfirmation) slots.push("pending");
    else if (i < hero.done + hero.pendingConfirmation + hero.scheduled) slots.push("upcoming");
    else slots.push("free");
  }
  const lastSession = sessions.find((s) => s.state === "upcoming") ?? sessions[sessions.length - 1] ?? null;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title={`Co zawiera pakiet "${hero.name}"`} sub={`${hero.total} sesji`} />
          <Perks total={hero.total} />
        </Card>

        <Card>
          <CardHeader
            title="Wykorzystanie sesji"
            sub={
              `${hero.done} użytych · ` +
              (hero.pendingConfirmation > 0 ? `${hero.pendingConfirmation} czeka na potwierdzenie · ` : "") +
              `${hero.scheduled} zaplanowanych · ${hero.total - hero.done - hero.pendingConfirmation - hero.scheduled} wolnych`
            }
          />
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s, i) => (
              <div
                key={i}
                className={
                  "aspect-square rounded-[10px] flex items-center justify-center text-[14px] font-bold " +
                  (s === "done"
                    ? "bg-emerald-500 text-white"
                    : s === "pending"
                      ? "bg-sky-100 text-sky-900 border-[1.5px] border-dashed border-sky-400"
                      : s === "upcoming"
                        ? "bg-amber-100 text-amber-900 border-[1.5px] border-dashed border-amber-400"
                        : "bg-slate-100 text-slate-400")
                }
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="flex gap-3.5 mt-3.5 text-[11.5px] text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />Użyta
            </span>
            {hero.pendingConfirmation > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-sky-100 border-[1.5px] border-dashed border-sky-400" />Czeka na potwierdzenie
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-100 border-[1.5px] border-dashed border-amber-400" />Zaplanowana
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-slate-100" />Wolna
            </span>
          </div>
          {hero.total - hero.done - hero.pendingConfirmation - hero.scheduled > 0 && (
            <div className="mt-3.5 px-3.5 py-3 bg-emerald-50 rounded-[9px] text-[12px] text-emerald-800 leading-[1.5]">
              <b>📅 Wskazówka:</b> Zarezerwuj pozostałe {hero.total - hero.done - hero.pendingConfirmation - hero.scheduled}{" "}
              {plural(hero.total - hero.done - hero.pendingConfirmation - hero.scheduled, "sesję", "sesje", "sesji")} z odpowiednim wyprzedzeniem.
              <Link
                href="/account/bookings?mode=book"
                className="block mt-2 inline-flex items-center bg-emerald-700 text-white px-3 py-1.5 rounded-[6px] text-[11px] font-semibold hover:bg-emerald-800"
              >
                + Zarezerwuj sesję
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Sposób płatności" sub="moduł kart w przygotowaniu" />
          <PlaceholderEmpty
            text="Karty domyślne i historia obciążeń pojawią się tu po wprowadzeniu integracji ze Stripe / Przelewy24. Obecnie pakiety opłacasz bezpośrednio u trenera (BLIK / przelew / gotówka)."
          />
        </Card>
        <Card>
          <CardHeader title="Auto-odnowienie" sub="wkrótce" />
          <PlaceholderEmpty
            text="Automatyczne odnowienie pakietu z karty będzie dostępne razem z modułem płatności. Na razie nowy pakiet kupujesz manualnie u trenera."
          />
        </Card>
      </div>

      <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-[11px] text-[11.5px] text-slate-700 leading-[1.5]">
        <b>📋 Warunki pakietu:</b> Pakiet ważny domyślnie 30 dni od pierwszej zarezerwowanej sesji.
        Niewykorzystane sesje nie przenoszą się. Anulacja bez kosztów do 24h przed sesją.
        {lastSession && lastSession.state === "upcoming" && (
          <> Najbliższa sesja: <b>{lastSession.dayNum} {lastSession.monthShort}</b>.</>
        )}
      </div>
    </>
  );
}

function Perks({ total }: { total: number }) {
  const items = [
    {
      ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M5 8l7-6 7 6" /></svg>,
      nm: `${total} sesji 1:1 (60 min)`,
      det: "Trening siłowy / cardio / mobilność — Twój wybór",
    },
    {
      ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0116 0v1" /></svg>,
      nm: "Wsparcie trenera",
      det: "Wiadomości w aplikacji · odpowiedź zwykle do 24h",
    },
    {
      ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 14l4-4 4 4" /></svg>,
      nm: "Tracking postępów",
      det: "Pomiary wagi, sesje, cele długoterminowe",
    },
    {
      ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /></svg>,
      nm: "Elastyczność rezerwacji",
      det: "Bez kosztów anulacji do 24h przed sesją",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {items.map((p) => (
        <div key={p.nm} className="flex gap-3 items-start">
          <span className="w-9 h-9 rounded-[9px] bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0">
            <span className="w-[16px] h-[16px]">{p.ic}</span>
          </span>
          <div>
            <div className="text-[13px] font-semibold text-slate-900">{p.nm}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5 leading-[1.45]">{p.det}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ====================== USAGE PANEL ====================== */

function UsagePanel({
  sessions,
  hero,
  weeklyAvg,
  daysActive,
}: {
  sessions: PackageSessionRow[];
  hero: PackageHero;
  weeklyAvg: number | null;
  daysActive: number;
}) {
  return (
    <>
      <Card>
        <CardHeader
          title={`Historia sesji · pakiet "${hero.name}"`}
          sub={`${sessions.length} ${plural(sessions.length, "sesja", "sesje", "sesji")} w cyklu`}
        />
        {sessions.length === 0 ? (
          <PlaceholderEmpty text="Brak sesji w tym pakiecie. Zarezerwuj pierwszą — pojawi się tu jako historia." />
        ) : (
          <div className="flex flex-col">
            {sessions.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
        <StatCard
          title="Średnia tygodniowa"
          value={weeklyAvg != null ? weeklyAvg.toFixed(1) : "—"}
          unit="sesji/tydz."
          detail={
            weeklyAvg == null
              ? "Brak danych"
              : weeklyAvg < 1.5
                ? "Cel: ~2/tydz · podkręć tempo"
                : weeklyAvg >= 2
                  ? "Świetne tempo!"
                  : "Stabilne tempo"
          }
          accent={weeklyAvg != null && weeklyAvg >= 2 ? "good" : weeklyAvg != null && weeklyAvg < 1.5 ? "warn" : "neutral"}
        />
        <StatCard
          title="Koszt sesji efektywny"
          value={hero.pricePerSession.toFixed(0)}
          unit="PLN"
          detail={`Pakiet ${hero.pricePaid} PLN / ${hero.total} sesji`}
          accent="good"
        />
        <StatCard
          title="Pakiet aktywny"
          value={String(daysActive)}
          unit="dni"
          detail={`${hero.done + hero.pendingConfirmation + hero.scheduled} z ${hero.total} sesji wykorzystane`}
          accent="neutral"
        />
      </div>
    </>
  );
}

function StatCard({
  title,
  value,
  unit,
  detail,
  accent,
}: {
  title: string;
  value: string;
  unit: string;
  detail: string;
  accent: "good" | "warn" | "neutral";
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="text-[32px] font-bold tracking-[-0.025em] text-slate-900 tabular-nums leading-none">
        {value}
        <span className="text-[14px] text-slate-500 font-medium ml-1">{unit}</span>
      </div>
      <div
        className={
          "mt-3.5 px-3 py-2.5 rounded-[8px] text-[11.5px] leading-[1.4] " +
          (accent === "good"
            ? "bg-emerald-50 text-emerald-700"
            : accent === "warn"
              ? "bg-amber-50 text-amber-900"
              : "bg-slate-50 text-slate-600")
        }
      >
        {detail}
      </div>
    </Card>
  );
}

function SessionRow({ s }: { s: PackageSessionRow }) {
  const stateClasses =
    s.state === "done"
      ? "bg-emerald-50 text-emerald-700"
      : s.state === "pending"
        ? "bg-sky-50 text-sky-900"
        : s.state === "upcoming"
          ? "bg-amber-50 text-amber-900"
          : "bg-red-50 text-red-700";
  const stateLabel =
    s.state === "done"
      ? "✓ Zrealizowana"
      : s.state === "pending"
        ? "⏳ Czeka na potwierdzenie"
        : s.state === "upcoming"
          ? "⏰ Zaplanowana"
          : "⊘ Anulowana";
  return (
    <div className="grid grid-cols-[60px_1.7fr_1fr_auto_120px] gap-3 items-center py-3 border-b border-dashed border-slate-100 last:border-0">
      <div className="text-center">
        <div className="text-[20px] font-bold leading-none text-slate-900">{s.dayNum}</div>
        <div className="text-[10px] uppercase tracking-[0.06em] text-slate-500 font-bold mt-0.5">{s.monthShort}</div>
      </div>
      <div>
        <div className="text-[13px] font-semibold text-slate-900">{s.serviceName}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{s.durationMin} min</div>
      </div>
      <div className="text-[11.5px] text-slate-500 truncate">{s.location || "—"}</div>
      <div className={`text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[3px] rounded-full ${stateClasses}`}>
        {stateLabel}
      </div>
      <div className="text-right">
        <div
          className={
            "text-[11.5px] font-medium " +
            (s.state === "cancelled" ? "text-emerald-700" : "text-slate-700")
          }
        >
          {s.state === "cancelled" ? "+1 do pakietu" : "−1 sesja"}
        </div>
        <div className="text-[11px] text-slate-500 font-bold tabular-nums mt-0.5">
          {s.sessionsLeftAfter} zostało
        </div>
      </div>
    </div>
  );
}

/* ====================== UPGRADE PANEL ====================== */

function UpgradePanel({ alternatives }: { alternatives: AlternativePackage[] }) {
  if (alternatives.length === 0) {
    return (
      <Card>
        <PlaceholderEmpty text="Brak innych pakietów u tego trenera. Zapytaj o rozszerzoną ofertę indywidualnie." />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {alternatives.map((p) => (
        <PlanCard key={p.id} p={p} />
      ))}
    </div>
  );
}

function PlanCard({ p }: { p: AlternativePackage }) {
  return (
    <div
      className={
        "rounded-[14px] border bg-white p-5 relative " +
        (p.isCurrent
          ? "border-emerald-500 bg-gradient-to-b from-emerald-50/80 to-white shadow-[0_8px_24px_-12px_rgba(16,185,129,0.4)]"
          : p.isPopular
            ? "border-fuchsia-300 shadow-[0_8px_24px_-12px_rgba(168,85,247,0.3)]"
            : "border-slate-200")
      }
    >
      {p.isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10.5px] font-bold uppercase tracking-[0.06em]">
          ✓ Twój pakiet
        </div>
      )}
      {p.isPopular && !p.isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-fuchsia-500 text-white text-[10.5px] font-bold uppercase tracking-[0.06em]">
          ⭐ Najlepszy wybór
        </div>
      )}

      <div className="text-[18px] font-bold text-slate-900 mb-1">{p.name}</div>
      {p.description && (
        <div className="text-[11.5px] text-slate-500 mb-3.5 leading-[1.45]">{p.description}</div>
      )}

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-[36px] font-bold tracking-[-0.025em] text-slate-900 tabular-nums">{p.price}</span>
        <span className="text-[14px] text-slate-500 font-medium">PLN</span>
      </div>
      <div className="text-[12px] text-slate-500 mb-3">
        {p.sessionsTotal} sesji · <b className="text-slate-900 font-semibold">{p.pricePerSession.toFixed(0)} PLN/sesja</b>
      </div>
      {p.savePln > 0 && !p.isCurrent && (
        <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5 inline-block mb-3.5">
          Oszcz. {p.savePln} PLN vs najniższy koszt
        </div>
      )}

      {p.isCurrent ? (
        <button
          type="button"
          disabled
          className="w-full h-10 rounded-[9px] bg-slate-100 text-slate-500 text-[13px] font-semibold cursor-not-allowed"
        >
          Aktualnie używasz
        </button>
      ) : (
        <Link
          href={`/trainers/${p.trainerSlug}/checkout/${p.id}`}
          className="w-full h-10 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold inline-flex items-center justify-center hover:bg-black"
        >
          Przejdź na {p.name}
        </Link>
      )}
    </div>
  );
}

/* ====================== INVOICES PANEL ====================== */

function InvoicesPanel({ hero }: { hero: PackageHero }) {
  return (
    <>
      <Card>
        <CardHeader title="Faktury" sub="moduł fakturowy w przygotowaniu" />
        <PlaceholderEmpty text="Faktury elektroniczne (PDF) za pakiety pojawią się tutaj, gdy uruchomimy moduł fakturowy. Obecnie potwierdzenie zakupu otrzymujesz bezpośrednio od trenera." />
      </Card>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Łącznie zapłacono"
          value={hero.pricePaid.toString()}
          unit="PLN"
          detail={`Za pakiet ${hero.name}`}
          accent="neutral"
        />
        <StatCard
          title="Sesje opłacone"
          value={String(hero.total)}
          unit=""
          detail={`${hero.done + hero.pendingConfirmation + hero.scheduled} wykorzystanych`}
          accent="neutral"
        />
        <StatCard
          title="Koszt / sesja"
          value={hero.pricePerSession.toFixed(0)}
          unit="PLN"
          detail="Cena efektywna"
          accent="good"
        />
      </div>
    </>
  );
}

/* ====================== NO PACKAGE ====================== */

function NoPackageState({ alternatives }: { alternatives: AlternativePackage[] }) {
  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
        <div>
          <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Mój pakiet</h1>
          <div className="text-[12.5px] text-slate-500 mt-1">Brak aktywnego pakietu sesji</div>
        </div>
      </div>

      <div className="rounded-[16px] bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 p-6 sm:p-8 mb-4 text-center">
        <div className="text-[18px] font-bold text-slate-900 mb-2">Nie masz jeszcze pakietu</div>
        <p className="text-[13px] text-slate-600 max-w-[480px] mx-auto leading-[1.5] mb-4">
          Pakiet to kilka sesji opłaconych z góry — niższa cena za sesję i pewność dostępu do trenera w długim okresie.
          Wybierz trenera w katalogu i zarezerwuj pakiet na jego profilu.
        </p>
        <Link
          href="/"
          className="inline-flex items-center h-10 px-4 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold hover:bg-black"
        >
          Otwórz katalog trenerów →
        </Link>
      </div>

      {alternatives.length > 0 && (
        <>
          <h3 className="text-[15px] font-bold text-slate-900 mb-3">Pakiety dostępne u Twojego trenera</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alternatives.map((p) => (
              <PlanCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ====================== SHARED ====================== */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded-[14px] px-5 py-[18px]">{children}</div>;
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center mb-3.5">
      <h3 className="text-[14px] font-bold text-slate-900 m-0">{title}</h3>
      {sub && <span className="text-[11px] text-slate-500 font-medium">{sub}</span>}
    </div>
  );
}

function PlaceholderEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-slate-200 py-10 px-6 text-center">
      <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[480px] mx-auto">{text}</p>
    </div>
  );
}

function ModeIcon({ id }: { id: Mode }) {
  if (id === "current")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
      </svg>
    );
  if (id === "usage")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
      </svg>
    );
  if (id === "upgrade")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12l5-5 5 5M5 19l5-5 5 5" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    </svg>
  );
}

const PL_MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function addDays(iso: string, n: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d;
}
