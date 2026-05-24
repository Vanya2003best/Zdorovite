import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MOCK_CLIENTS,
  countByStatus,
  ltv12mTotal,
  type ClientStatus,
  type MockClient,
} from "@/data/mock-clients";

/**
 * /studio/klienci — OLX-style client roster.
 *
 * Visual reference: design file 35-studio-klienci-olx-style.html.
 *
 * Data currently from `data/mock-clients.ts` because the CRM tables aren't
 * wired end-to-end yet (no `clients` table, no LTV materialised, no status
 * derivation). When migration 031_clients lands, swap MOCK_CLIENTS for a
 * `getClientsForTrainer(user.id)` server fetch — the component shape will
 * stay identical because mock-clients.ts mirrors the eventual row schema.
 */

type SP = Promise<{ status?: string }>;

const STATUS_LABEL: Record<ClientStatus | "all", string> = {
  all: "Wszyscy",
  lead: "Leady",
  new: "Nowi",
  active: "Aktywni",
  pause: "Pauza",
  ended: "Zakończeni",
};

const AV_TONES = [
  "bg-gradient-to-br from-orange-400 to-orange-600",
  "bg-gradient-to-br from-cyan-400 to-cyan-700",
  "bg-gradient-to-br from-violet-400 to-violet-700",
  "bg-gradient-to-br from-emerald-400 to-emerald-700",
  "bg-gradient-to-br from-pink-400 to-pink-700",
  "bg-gradient-to-br from-blue-400 to-blue-700",
  "bg-gradient-to-br from-amber-300 to-amber-700",
  "bg-gradient-to-br from-slate-400 to-slate-700",
  "bg-gradient-to-br from-red-400 to-red-700",
];

export default async function StudioKlienciPage(props: { searchParams: SP }) {
  const sp = await props.searchParams;
  const filterParam = (sp?.status ?? "all").toLowerCase();
  const filter: ClientStatus | "all" =
    filterParam === "lead" || filterParam === "new" || filterParam === "active" ||
    filterParam === "pause" || filterParam === "ended"
      ? (filterParam as ClientStatus)
      : "all";

  // Auth check — layout already requires trainer, but explicit redirect keeps
  // the URL bookmark-friendly for unauth visitors.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/klienci");

  const counts = countByStatus();
  const total = MOCK_CLIENTS.length;
  const totalLtv = ltv12mTotal();
  const visible = filter === "all" ? MOCK_CLIENTS : MOCK_CLIENTS.filter((c) => c.status === filter);

  return (
    <section className="bg-slate-50 min-h-[calc(100vh-64px-56px)]">
      {/* PAGE HEADER — white panel with title + right-side stats/CTAs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-9 pb-7 flex justify-between items-start gap-6 flex-wrap">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] m-0">Twoi klienci</h1>
            <p className="text-[13.5px] text-slate-500 mt-1">Zarządzaj wszystkimi klientami w jednym miejscu</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-[12.5px] text-slate-700">
              Saldo konta: <b className="text-slate-900">1 840 zł</b>
              <br />
              Pakiet aktywny: <b className="text-slate-900">Pro · do 12.06.2026</b>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="px-4 py-2.5 border-[1.5px] border-slate-900 rounded-[9px] bg-white text-[13px] font-bold text-slate-900 hover:bg-slate-50 transition"
              >
                Uzupełnij portfel
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-[9px] bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Dodaj klienta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-7 pb-16">
        {/* INFO BANNER */}
        <div className="bg-blue-100/70 rounded-xl px-5 py-4 mb-6">
          <b className="block text-[13.5px] text-slate-900 mb-1">Uwaga</b>
          <p className="text-[12.5px] text-slate-700 leading-snug m-0">
            Wszystkie płatności od klientów obsługujemy przez bezpieczny system NaZdrow! Pay.{" "}
            <Link href="/docs/packages" className="text-blue-700 underline font-semibold">Dowiedz się więcej</Link>
            {" · "}
            <Link href="/docs/cancellation-policy" className="text-blue-700 underline font-semibold">Polityka anulowania</Link>
          </p>
        </div>

        {/* STATUS SUB-TABS */}
        <nav className="flex border-b-[1.5px] border-slate-200 mb-6 overflow-x-auto scrollbar-hide">
          {(["all", "lead", "new", "active", "pause", "ended"] as const).map((s) => {
            const on = filter === s;
            const cnt = s === "all" ? total : counts[s];
            return (
              <Link
                key={s}
                href={s === "all" ? "/studio/klienci" : `/studio/klienci?status=${s}`}
                className={
                  "flex items-center gap-2 px-5 py-3 text-[14px] font-bold border-b-[3px] -mb-[1.5px] whitespace-nowrap transition " +
                  (on
                    ? "text-slate-900 border-slate-900"
                    : "text-slate-600 border-transparent hover:text-slate-900")
                }
              >
                {STATUS_LABEL[s]}
                <span className={"font-semibold text-[13px] " + (on ? "text-slate-700" : "text-slate-500")}>
                  [{cnt}]
                </span>
              </Link>
            );
          })}
        </nav>

        {/* FILTER BAR */}
        <div className="flex gap-3 items-center mb-5 flex-wrap">
          <button
            type="button"
            className="inline-flex items-center gap-2 h-12 px-4 border-[1.5px] border-slate-200 rounded-[9px] bg-white text-[13.5px] font-bold text-slate-900 hover:border-slate-400 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filtry
          </button>
          <div className="flex-1 min-w-[240px] flex items-center gap-2.5 h-12 px-4 border-[1.5px] border-slate-200 rounded-[9px] bg-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4-4" />
            </svg>
            <input
              type="search"
              placeholder="Wyszukaj po imieniu, e-mailu, telefonie…"
              className="flex-1 border-0 outline-none text-[13.5px] text-slate-900 bg-transparent"
            />
          </div>
          <div className="hidden sm:flex items-center justify-between gap-2.5 h-12 px-4 border-[1.5px] border-slate-200 rounded-[9px] bg-white text-[13.5px] text-slate-900 min-w-[200px] cursor-pointer">
            Wszystkie usługi
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-500">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div className="hidden sm:flex items-center justify-between gap-2.5 h-12 px-4 border-[1.5px] border-slate-200 rounded-[9px] bg-white text-[13.5px] text-slate-900 min-w-[220px] cursor-pointer">
            Sortuj: Ostatnia sesja
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-500">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="text-[12.5px] text-slate-500 mb-4">
          Wyświetlono <b className="text-slate-900">{visible.length} {visible.length === 1 ? "klient" : visible.length < 5 ? "klientów" : "klientów"}</b>
          {filter === "all" && (
            <> · łączna wartość 12-mies.: <b className="text-slate-900">{totalLtv.toLocaleString("pl-PL")} zł</b></>
          )}
        </div>

        {/* CARDS */}
        <div className="grid gap-3.5">
          {visible.map((c) => (
            <ClientCard key={c.id} c={c} />
          ))}
        </div>

        {/* PROMO */}
        <div className="mt-7 bg-white border border-slate-200 rounded-[14px] px-6 py-5 grid grid-cols-[80px_1fr_220px] gap-5 items-center max-md:grid-cols-1 max-md:text-center">
          <div className="w-20 h-20 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-200 inline-flex items-center justify-center text-[34px] mx-auto md:mx-0">
            🎯
          </div>
          <div>
            <h3 className="m-0 mb-1.5 text-[17px] font-bold tracking-[-0.015em]">Pozyskaj nowych klientów dzięki NaZdrow! Pro</h3>
            <p className="m-0 text-[13.5px] text-slate-600 leading-relaxed">
              Pakiet Pro zwiększa Twoją widoczność w wyszukiwarce, daje priorytet w wynikach i odznakę „TOP trener". Średnio +12 nowych klientów miesięcznie.
            </p>
          </div>
          <button
            type="button"
            className="px-5 py-3 bg-slate-900 text-white rounded-[9px] text-[13.5px] font-bold hover:bg-slate-800 transition"
          >
            Sprawdź NaZdrow! Pro →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */

function ClientCard({ c }: { c: MockClient }) {
  return (
    <article className="bg-white border border-slate-200 rounded-xl px-5 py-4 grid grid-cols-[64px_1fr_200px_200px_200px_140px] gap-5 items-center hover:border-slate-900 transition cursor-pointer max-lg:grid-cols-[56px_1fr_140px] max-lg:gap-3.5 max-md:grid-cols-[48px_1fr] max-md:gap-3">
      <div className={"w-16 h-16 rounded-full text-white font-bold text-[22px] inline-flex items-center justify-center shrink-0 max-lg:w-14 max-lg:h-14 max-md:w-12 max-md:h-12 max-md:text-[18px] " + AV_TONES[c.avatarTone - 1]}>
        {c.initials}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <div className="text-[16px] sm:text-[17px] font-bold tracking-[-0.015em] text-slate-900 truncate">
            {c.name}
          </div>
          <StatusPill status={c.status} days={c.statusDaysLabel} />
        </div>
        <div className="text-[12px] sm:text-[12.5px] text-slate-500 truncate">
          {c.email}
          <Dot />
          {c.phone}
          {c.trailingMeta && (
            <>
              <Dot />
              {c.trailingMeta}
            </>
          )}
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {c.tags.map((t, i) => (
            <span
              key={i}
              className="text-[10.5px] px-2 py-[3px] rounded-full bg-slate-100 text-slate-700 font-semibold"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Pakiet col — hidden on mobile */}
      <div className="max-lg:hidden">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">Pakiet</div>
        {c.pkg && c.pkg.total > 0 ? (
          <>
            <div className={"text-[14px] font-semibold " + (c.pkg.tone === "empty" ? "text-red-500" : "text-slate-900")}>
              {c.pkg.used} / {c.pkg.total} sesji
            </div>
            {c.pkg.note ? (
              <div className="text-[11.5px] text-slate-500 mt-0.5">{c.pkg.note}</div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 max-w-[80px] h-[5px] bg-slate-100 rounded-[3px] overflow-hidden">
                  <i
                    className={
                      "block h-full rounded-[3px] " +
                      (c.pkg.tone === "empty"
                        ? "bg-red-500"
                        : c.pkg.tone === "low"
                          ? "bg-amber-500"
                          : "bg-emerald-500")
                    }
                    style={{ width: `${Math.round((c.pkg.used / c.pkg.total) * 100)}%` }}
                  />
                </div>
                <span className="text-[12px] font-bold text-slate-700">
                  {Math.round((c.pkg.used / c.pkg.total) * 100)}%
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[14px] font-semibold text-slate-400">— brak</div>
            {c.pkg?.note && <div className="text-[11.5px] text-slate-500 mt-0.5">{c.pkg.note}</div>}
          </>
        )}
      </div>

      {/* Ostatnia sesja col — hidden on mobile */}
      <div className="max-lg:hidden">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">
          {c.lastEvent.label}
        </div>
        <div className="text-[14px] font-semibold text-slate-900">{c.lastEvent.primary}</div>
        <div className={"text-[11.5px] mt-0.5 " + (c.lastEvent.urgent ? "text-red-500" : "text-slate-500")}>
          {c.lastEvent.secondary}
        </div>
      </div>

      {/* LTV col — hidden on mobile */}
      <div className="max-lg:hidden">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">
          {c.ltv.label}
        </div>
        <div className={"text-[17px] font-bold tracking-[-0.015em] tabular-nums " + (c.ltv.estimated ? "text-emerald-700" : "text-slate-900")}>
          {c.ltv.estimated && "~ "}
          {c.ltv.amount.toLocaleString("pl-PL")}
          <small className="text-[12px] font-medium text-slate-500 ml-1">zł{c.ltv.suffix ? " " + c.ltv.suffix : ""}</small>
        </div>
      </div>

      {/* Actions col */}
      <div className="flex flex-col gap-1.5 max-md:flex-row max-md:col-start-2">
        <button
          type="button"
          className={
            "px-3 py-2 text-[12px] font-bold rounded-lg inline-flex items-center justify-center gap-1 transition " +
            actionTone(c.actions.primary.tone)
          }
        >
          {c.actions.primary.label}
        </button>
        <Link
          href={`/studio/klienci/${c.id}`}
          className="px-3 py-2 text-[12px] font-bold rounded-lg bg-white border-[1.5px] border-slate-200 text-slate-900 hover:bg-slate-50 transition text-center"
        >
          {c.actions.secondary.label}
        </Link>
      </div>
    </article>
  );
}

function actionTone(t: "ink" | "brand" | "lead" | "pause"): string {
  switch (t) {
    case "ink":   return "bg-slate-900 text-white hover:bg-slate-800";
    case "brand": return "bg-white border-[1.5px] border-slate-200 text-slate-900 hover:bg-slate-50";
    case "lead":  return "bg-emerald-500 text-white hover:bg-emerald-600";
    case "pause": return "bg-amber-100 border-[1.5px] border-amber-200 text-amber-900 hover:bg-amber-200";
  }
}

function Dot() {
  return <span className="inline-block w-[3px] h-[3px] rounded-full bg-slate-300 mx-2 align-middle" />;
}

function StatusPill({ status, days }: { status: ClientStatus; days?: string }) {
  const map: Record<ClientStatus, { cls: string; dot: string; label: string }> = {
    lead:   { cls: "bg-blue-100 text-blue-900",       dot: "bg-blue-600",    label: "Lead" },
    new:    { cls: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-400", label: "Nowy" },
    active: { cls: "bg-emerald-700 text-white",       dot: "bg-emerald-300", label: "Aktywny" },
    pause:  { cls: "bg-amber-100 text-amber-900",     dot: "bg-amber-500",   label: "Pauza" },
    ended:  { cls: "bg-slate-200 text-slate-700",     dot: "bg-slate-500",   label: "Zakończony" },
  };
  const s = map[status];
  return (
    <span className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold " + s.cls}>
      <span className={"w-[7px] h-[7px] rounded-full " + s.dot} />
      {s.label}
      {days && <> · {days}</>}
    </span>
  );
}
