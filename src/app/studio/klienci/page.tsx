import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getClientsForTrainer,
  type ClientStatus,
  type RosterClient,
} from "@/lib/db/clients";
import AddClientModal from "./AddClientModal";

/**
 * /studio/klienci — OLX-style client roster, LIVE data.
 *
 * Visual reference: design file 35-studio-klienci-olx-style.html.
 * Rows come from trainer_clients (023) — manual entries plus clients
 * auto-imported on booking (031 trigger). Status / package saldo / LTV are
 * derived from bookings in lib/db/clients.ts.
 */

type SP = Promise<{ status?: string; q?: string }>;

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
  const q = (sp?.q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/klienci");

  const clients = await getClientsForTrainer(user.id);

  const counts: Record<ClientStatus, number> = { lead: 0, new: 0, active: 0, pause: 0, ended: 0 };
  for (const c of clients) counts[c.status]++;
  const total = clients.length;
  const totalLtv = clients.reduce((s, c) => s + (c.ltv12m ?? 0), 0);

  const visible = clients
    .filter((c) => filter === "all" || c.status === filter)
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
    );

  return (
    <section className="bg-slate-50 min-h-[calc(100vh-64px-56px)]">
      {/* PAGE HEADER */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-9 pb-7 flex justify-between items-start gap-6 flex-wrap">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] m-0">Twoi klienci</h1>
            <p className="text-[13.5px] text-slate-500 mt-1">Zarządzaj wszystkimi klientami w jednym miejscu</p>
          </div>
          <AddClientModal />
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-7 pb-16">
        {/* INFO BANNER */}
        <div className="bg-blue-100/70 rounded-xl px-5 py-4 mb-6">
          <b className="block text-[13.5px] text-slate-900 mb-1">Jak działa lista?</b>
          <p className="text-[12.5px] text-slate-700 leading-snug m-0">
            Klienci rezerwujący przez NaZdrow! pojawiają się tu automatycznie. Osoby spoza
            platformy dodasz przyciskiem „Dodaj klienta”. Płatności rozliczasz z klientem
            bezpośrednio (BLIK, gotówka, przelew) — NaZdrow! nie pośredniczy w pieniądzach.
          </p>
        </div>

        {/* STATUS SUB-TABS */}
        <nav className="flex border-b-[1.5px] border-slate-200 mb-6 overflow-x-auto scrollbar-hide">
          {(["all", "lead", "new", "active", "pause", "ended"] as const).map((s) => {
            const on = filter === s;
            const cnt = s === "all" ? total : counts[s];
            const href =
              (s === "all" ? "/studio/klienci" : `/studio/klienci?status=${s}`) +
              (q ? `${s === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : "");
            return (
              <Link
                key={s}
                href={href}
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

        {/* SEARCH */}
        <form method="get" className="flex gap-3 items-center mb-5 flex-wrap">
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
          <div className="flex-1 min-w-[240px] flex items-center gap-2.5 h-12 px-4 border-[1.5px] border-slate-200 rounded-[9px] bg-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4-4" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Wyszukaj po imieniu, e-mailu, telefonie…"
              className="flex-1 border-0 outline-none text-[13.5px] text-slate-900 bg-transparent"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-5 border-[1.5px] border-slate-200 rounded-[9px] bg-white text-[13.5px] font-bold text-slate-900 hover:border-slate-400 transition"
          >
            Szukaj
          </button>
        </form>

        <div className="text-[12.5px] text-slate-500 mb-4">
          Wyświetlono <b className="text-slate-900">{visible.length} {visible.length === 1 ? "klient" : "klientów"}</b>
          {filter === "all" && totalLtv > 0 && (
            <> · łączna wartość 12-mies.: <b className="text-slate-900">{totalLtv.toLocaleString("pl-PL")} zł</b></>
          )}
        </div>

        {/* CARDS / EMPTY STATE */}
        {visible.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 px-6 text-center">
            <div className="text-[34px] mb-2">🪪</div>
            <p className="text-[15px] font-bold text-slate-900 m-0">
              {q || filter !== "all" ? "Brak wyników" : "Twoja lista klientów jest pusta"}
            </p>
            <p className="text-[13px] text-slate-500 mt-1.5 m-0">
              {q || filter !== "all"
                ? "Zmień filtr lub wyszukiwanie."
                : "Klienci pojawią się tu automatycznie po pierwszej rezerwacji — albo dodaj kogoś ręcznie."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3.5">
            {visible.map((c) => (
              <ClientCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================ */

function ClientCard({ c }: { c: RosterClient }) {
  const meta = [c.email, c.phone, c.sinceLabel].filter(Boolean);
  return (
    <article className="bg-white border border-slate-200 rounded-xl px-5 py-4 grid grid-cols-[64px_1fr_200px_200px_200px_140px] gap-5 items-center hover:border-slate-900 transition max-lg:grid-cols-[56px_1fr_140px] max-lg:gap-3.5 max-md:grid-cols-[48px_1fr] max-md:gap-3">
      <div className={"w-16 h-16 rounded-full text-white font-bold text-[22px] inline-flex items-center justify-center shrink-0 max-lg:w-14 max-lg:h-14 max-md:w-12 max-md:h-12 max-md:text-[18px] " + AV_TONES[c.avatarTone - 1]}>
        {c.initials}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <Link
            href={`/studio/klienci/${c.id}`}
            className="text-[16px] sm:text-[17px] font-bold tracking-[-0.015em] text-slate-900 truncate hover:underline"
          >
            {c.name}
          </Link>
          <StatusPill status={c.status} days={c.statusDays} />
        </div>
        {meta.length > 0 && (
          <div className="text-[12px] sm:text-[12.5px] text-slate-500 truncate">
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && <Dot />}
                {m}
              </span>
            ))}
          </div>
        )}
        {c.tags.length > 0 && (
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
        )}
      </div>

      {/* Pakiet col */}
      <div className="max-lg:hidden">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">Pakiet</div>
        {c.pkg ? (
          <>
            <div className={"text-[14px] font-semibold " + (c.pkg.used >= c.pkg.total ? "text-red-500" : "text-slate-900")}>
              {c.pkg.used} / {c.pkg.total} sesji
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 max-w-[80px] h-[5px] bg-slate-100 rounded-[3px] overflow-hidden">
                <i
                  className={
                    "block h-full rounded-[3px] " +
                    (c.pkg.used >= c.pkg.total
                      ? "bg-red-500"
                      : c.pkg.total - c.pkg.used <= 2
                        ? "bg-amber-500"
                        : "bg-emerald-500")
                  }
                  style={{ width: `${Math.min(100, Math.round((c.pkg.used / c.pkg.total) * 100))}%` }}
                />
              </div>
              <span className="text-[12px] font-bold text-slate-700">
                {Math.min(100, Math.round((c.pkg.used / c.pkg.total) * 100))}%
              </span>
            </div>
          </>
        ) : (
          <div className="text-[14px] font-semibold text-slate-400">— brak</div>
        )}
      </div>

      {/* Sesja col */}
      <div className="max-lg:hidden">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">
          {c.lastSession.label}
        </div>
        {c.lastSession.primary ? (
          <>
            <div className="text-[14px] font-semibold text-slate-900">{c.lastSession.primary}</div>
            {c.lastSession.daysAgo !== null && c.lastSession.daysAgo > 21 && (
              <div className="text-[11.5px] mt-0.5 text-red-500">{c.lastSession.daysAgo} dni temu</div>
            )}
          </>
        ) : (
          <div className="text-[14px] font-semibold text-slate-400">—</div>
        )}
      </div>

      {/* LTV col */}
      <div className="max-lg:hidden">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">
          Wartość 12 mies.
        </div>
        {c.ltv12m !== null ? (
          <div className="text-[17px] font-bold tracking-[-0.015em] tabular-nums text-slate-900">
            {c.ltv12m.toLocaleString("pl-PL")}
            <small className="text-[12px] font-medium text-slate-500 ml-1">zł</small>
          </div>
        ) : (
          <div className="text-[14px] font-semibold text-slate-400">—</div>
        )}
      </div>

      {/* Actions col */}
      <div className="flex flex-col gap-1.5 max-md:flex-row max-md:col-start-2">
        {c.profileId ? (
          <Link
            href={`/studio/messages?with=${c.profileId}`}
            className="px-3 py-2 text-[12px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition text-center"
          >
            Wiadomość
          </Link>
        ) : c.email ? (
          <a
            href={`mailto:${c.email}`}
            className="px-3 py-2 text-[12px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition text-center"
          >
            Email
          </a>
        ) : c.phone ? (
          <a
            href={`tel:${c.phone.replace(/\s/g, "")}`}
            className="px-3 py-2 text-[12px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition text-center"
          >
            Zadzwoń
          </a>
        ) : null}
        <Link
          href={`/studio/klienci/${c.id}`}
          className="px-3 py-2 text-[12px] font-bold rounded-lg bg-white border-[1.5px] border-slate-200 text-slate-900 hover:bg-slate-50 transition text-center"
        >
          Profil →
        </Link>
      </div>
    </article>
  );
}

function Dot() {
  return <span className="inline-block w-[3px] h-[3px] rounded-full bg-slate-300 mx-2 align-middle" />;
}

function StatusPill({ status, days }: { status: ClientStatus; days: number | null }) {
  const map: Record<ClientStatus, { cls: string; dot: string; label: string }> = {
    lead:   { cls: "bg-blue-100 text-blue-900",       dot: "bg-blue-600",    label: "Lead" },
    new:    { cls: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-400", label: "Nowy" },
    active: { cls: "bg-emerald-700 text-white",       dot: "bg-emerald-300", label: "Aktywny" },
    pause:  { cls: "bg-amber-100 text-amber-900",     dot: "bg-amber-500",   label: "Pauza" },
    ended:  { cls: "bg-slate-200 text-slate-700",     dot: "bg-slate-500",   label: "Zakończony" },
  };
  const s = map[status];
  const showDays = days !== null && days > 0 && status !== "active" && status !== "ended";
  return (
    <span className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold " + s.cls}>
      <span className={"w-[7px] h-[7px] rounded-full " + s.dot} />
      {s.label}
      {showDays && <> · {days} {days === 1 ? "dzień" : "dni"}</>}
    </span>
  );
}
