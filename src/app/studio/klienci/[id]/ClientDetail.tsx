"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientStatus } from "@/lib/db/clients";
import { saveSessionNotes } from "../../sesja/actions";
import { updateClient } from "../actions";

/**
 * /studio/klienci/[id] — OLX-style client detail view, LIVE data.
 *
 * Visual reference: design 36-studio-klient-detail-olx.html.
 * Everything rendered here is real: roster row (trainer_clients), sessions
 * and KPIs (bookings, incl. per-session notes — 025), package saldo
 * (packages), chat preview (messages). Sections that had no backing tables
 * (goals progress, lead source, demographics, NPS) were removed rather than
 * faked.
 */

type ClientData = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  goal: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
};

export type DetailSession = {
  id: string;
  startIso: string;
  status: string;
  title: string;
  price: number;
  notes: string | null;
  packageId: string | null;
  packageName: string | null;
  packageTotal: number | null;
};

export type DetailExtras = {
  profileId: string | null;
  archived: boolean;
  status: ClientStatus;
  statusDays: number | null;
  firstSessionIso: string | null;
  next: { startIso: string; title: string } | null;
  sessions: DetailSession[];
  kpi: {
    total: number;
    thisMonth: number;
    cancelled: number;
    ltv12m: number | null;
    attendancePct: number | null;
  };
  pkg: { name: string; used: number; total: number } | null;
  chat: { fromMe: boolean; body: string; atIso: string }[];
};

type Tab = "overview" | "sessions" | "notes";

const PL_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

const ICON = {
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  tab_overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  tab_cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  tab_chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  tab_notes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  chev: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  act_pkg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
    </svg>
  ),
  act_pause: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
};

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}

function monthYearPl(iso: string): string {
  const d = new Date(iso);
  return `${PL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function sessionDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return {
    date: sameDay ? "Dziś" : `${d.getDate()} ${PL_MONTHS[d.getMonth()].slice(0, 3)}.`,
    time: d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
  };
}

const STATUS_PILL: Record<ClientStatus, { cls: string; dot: string; label: string }> = {
  lead:   { cls: "bg-blue-100 text-blue-900",       dot: "bg-blue-600",    label: "Lead" },
  new:    { cls: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-400", label: "Nowy" },
  active: { cls: "bg-emerald-700 text-white",       dot: "bg-emerald-300", label: "Aktywny" },
  pause:  { cls: "bg-amber-100 text-amber-900",     dot: "bg-amber-500",   label: "Pauza" },
  ended:  { cls: "bg-slate-200 text-slate-700",     dot: "bg-slate-500",   label: "Zakończony" },
};

const SESSION_STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: "✓ Zakończona", cls: "text-emerald-700" },
  pending:   { label: "Oczekuje",     cls: "text-blue-700" },
  paid:      { label: "Opłacona",     cls: "text-blue-700" },
  confirmed: { label: "Zaplanowana",  cls: "text-blue-700" },
  cancelled: { label: "Odwołana",     cls: "text-red-600" },
  no_show:   { label: "Nieobecność",  cls: "text-red-600" },
};

export default function ClientDetail({
  client,
  extras,
}: {
  client: ClientData;
  extras: DetailExtras;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const router = useRouter();
  const [archPending, startArch] = useTransition();

  const name = client.display_name || "Klient";
  const inits = initialsOf(name);
  const pill = STATUS_PILL[extras.status];
  const sinceIso = extras.firstSessionIso ?? client.created_at;
  const chatHref = extras.profileId ? `/studio/messages?with=${extras.profileId}` : null;

  function toggleArchive() {
    const msg = extras.archived
      ? "Przywrócić klienta do aktywnej listy?"
      : "Zakończyć współpracę? Klient trafi do zakładki „Zakończeni” (historia zostaje).";
    if (!window.confirm(msg)) return;
    startArch(async () => {
      await updateClient(client.id, { archived: !extras.archived });
      router.refresh();
    });
  }

  return (
    <>
      {/* BREADCRUMBS */}
      <section className="bg-white border-b border-slate-200 py-4">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
          <nav className="flex items-center gap-2 text-[13px]">
            <Link href="/studio" className="text-slate-500 hover:text-slate-900 hover:underline">Pulpit</Link>
            <span className="text-slate-300">{ICON.chev}</span>
            <Link href="/studio/klienci" className="text-slate-500 hover:text-slate-900 hover:underline">Klienci</Link>
            <span className="text-slate-300">{ICON.chev}</span>
            <span className="text-slate-900 font-semibold">{name}</span>
          </nav>
        </div>
      </section>

      <section className="py-7 pb-16">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7 items-start">

          {/* ============================== MAIN COLUMN ============================== */}
          <main>
            {/* HEADER CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-7 grid grid-cols-[96px_1fr] gap-6 items-start max-md:grid-cols-[64px_1fr] max-md:p-5">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-[34px] inline-flex items-center justify-center shrink-0 max-md:w-16 max-md:h-16 max-md:text-[24px]">
                {inits}
              </div>
              <div className="min-w-0">
                <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] m-0 mb-1.5 flex items-center gap-3.5 flex-wrap">
                  <span className="truncate">{name}</span>
                  <span className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold " + pill.cls}>
                    <span className={"w-[7px] h-[7px] rounded-full " + pill.dot} />
                    {pill.label}
                    {extras.statusDays !== null && extras.statusDays > 0 && <> · {extras.statusDays} dni</>}
                  </span>
                </h1>
                <div className="text-[13.5px] text-slate-500 mb-3.5">
                  {extras.firstSessionIso
                    ? `Klient od ${monthYearPl(sinceIso)}`
                    : `Na liście od ${monthYearPl(client.created_at)}`}
                  {!extras.profileId && " · dodany ręcznie (poza platformą)"}
                </div>
                <div className="flex gap-5 flex-wrap text-[13.5px]">
                  {client.email && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <span className="text-slate-500">{ICON.mail}</span>
                      <a href={`mailto:${client.email}`} className="text-slate-900 font-semibold hover:underline">{client.email}</a>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <span className="text-slate-500">{ICON.phone}</span>
                      <a href={`tel:${client.phone}`} className="text-slate-900 font-semibold hover:underline">{client.phone}</a>
                    </div>
                  )}
                </div>
                {client.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-3.5 flex-wrap">
                    {client.tags.map((t) => (
                      <span key={t} className="text-[11.5px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* DETAIL TABS */}
            <div className="flex border border-slate-200 border-b-[1.5px] bg-white rounded-t-2xl px-4 mt-6 overflow-x-auto scrollbar-hide">
              <DetailTab on={tab === "overview"} onClick={() => setTab("overview")} icon={ICON.tab_overview} label="Przegląd" />
              <DetailTab
                on={tab === "sessions"}
                onClick={() => setTab("sessions")}
                icon={ICON.tab_cal}
                label="Sesje"
                badge={extras.sessions.length > 0 ? String(extras.sessions.length) : undefined}
              />
              <DetailTab on={tab === "notes"} onClick={() => setTab("notes")} icon={ICON.tab_notes} label="Notatki i cel" />
              {chatHref && (
                <Link href={chatHref} className="flex items-center gap-2 px-4 py-4 text-[14px] font-bold whitespace-nowrap text-slate-600 hover:text-slate-900 transition">
                  {ICON.tab_chat}
                  Czat
                  <span className="text-slate-400">↗</span>
                </Link>
              )}
            </div>

            {/* PANE */}
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl p-7 max-md:p-5">
              {tab === "overview" && (
                <OverviewPane client={client} extras={extras} chatHref={chatHref} openSessions={() => setTab("sessions")} />
              )}
              {tab === "sessions" && <SessionsPane sessions={extras.sessions} />}
              {tab === "notes" && <NotesPane client={client} />}
            </div>
          </main>

          {/* ============================== ASIDE ============================== */}
          <aside className="lg:sticky lg:top-[92px] flex flex-col gap-4">
            {/* NEXT SESSION */}
            {extras.next ? (
              <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#047857,#065f46)" }}>
                <div className="text-[11px] uppercase tracking-[0.08em] opacity-80 font-bold mb-2">Najbliższa sesja</div>
                <div className="text-[22px] font-bold tracking-[-0.02em] mb-1">
                  {sessionDate(extras.next.startIso).date} · {sessionDate(extras.next.startIso).time}
                </div>
                <div className="text-[13px] opacity-90 mb-3.5">{extras.next.title}</div>
                <Link
                  href="/studio/calendar"
                  className="block w-full py-2.5 rounded-lg bg-white text-emerald-700 text-[12.5px] font-bold hover:bg-emerald-50 transition text-center"
                >
                  Otwórz w kalendarzu
                </Link>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-2">Najbliższa sesja</div>
                <div className="text-[14px] text-slate-500 mb-3.5">Brak zaplanowanej sesji.</div>
                <Link
                  href="/studio/calendar"
                  className="block w-full py-2.5 rounded-lg bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-800 transition text-center"
                >
                  Umów sesję
                </Link>
              </div>
            )}

            {/* AKCJE */}
            <div className="bg-white border border-slate-200 rounded-[14px] p-5">
              <h3 className="text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold m-0 mb-3.5">Akcje</h3>
              <div className="grid gap-2">
                {chatHref && (
                  <Link href={chatHref} className="px-4 py-3 rounded-[10px] text-[13.5px] font-bold inline-flex items-center gap-2.5 transition bg-slate-900 text-white hover:bg-slate-800">
                    {ICON.tab_chat}
                    Wyślij wiadomość
                  </Link>
                )}
                <Link href="/studio/calendar" className="px-4 py-3 rounded-[10px] text-[13.5px] font-bold inline-flex items-center gap-2.5 transition bg-white border-[1.5px] border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-400">
                  {ICON.tab_cal}
                  Umów sesję
                </Link>
                <Link href="/studio/uslugi" className="px-4 py-3 rounded-[10px] text-[13.5px] font-bold inline-flex items-center gap-2.5 transition bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                  {ICON.act_pkg}
                  Zaproponuj pakiet
                </Link>
                <button
                  type="button"
                  onClick={() => setTab("notes")}
                  className="px-4 py-3 rounded-[10px] text-[13.5px] font-bold inline-flex items-center gap-2.5 transition bg-white border-[1.5px] border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-400"
                >
                  {ICON.tab_notes}
                  Edytuj notatki
                </button>
                <button
                  type="button"
                  onClick={toggleArchive}
                  disabled={archPending}
                  className={
                    "px-4 py-3 rounded-[10px] text-[13.5px] font-bold inline-flex items-center gap-2.5 transition disabled:opacity-60 " +
                    (extras.archived
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-white border-[1.5px] border-slate-200 text-red-700 hover:bg-red-50")
                  }
                >
                  {ICON.act_pause}
                  {extras.archived ? "Przywróć klienta" : "Zakończ współpracę"}
                </button>
              </div>
            </div>

            {/* SZYBKIE STATYSTYKI */}
            <div className="bg-white border border-slate-200 rounded-[14px] p-5">
              <h3 className="text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold m-0 mb-3.5">Szybkie statystyki</h3>
              <StatRow lab="Na liście od" v={shortDate(client.created_at)} />
              <StatRow lab="Sesji łącznie" v={String(extras.kpi.total)} />
              <StatRow lab="W tym miesiącu" v={String(extras.kpi.thisMonth)} />
              {extras.kpi.attendancePct !== null && (
                <StatRow lab="Frekwencja" v={`${extras.kpi.attendancePct} %`} />
              )}
              <StatRow lab="Odwołania" v={String(extras.kpi.cancelled)} />
              {extras.kpi.ltv12m !== null && (
                <StatRow lab="Wydane (12 mies.)" v={`${extras.kpi.ltv12m.toLocaleString("pl-PL")} zł`} />
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

/* ====================== Helpers + small subcomponents ====================== */

function DetailTab({
  on, onClick, icon, label, badge,
}: {
  on: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-2 px-4 py-4 text-[14px] font-bold whitespace-nowrap border-b-[3px] -mb-[1.5px] transition " +
        (on
          ? "text-slate-900 border-slate-900"
          : "text-slate-600 border-transparent hover:text-slate-900")
      }
    >
      {icon}
      {label}
      {badge && (
        <span className="bg-emerald-500 text-white text-[10.5px] font-bold px-1.5 py-px rounded-md">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatRow({ lab, v }: { lab: string; v: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-[13px] last:border-b-0">
      <span className="text-slate-600">{lab}</span>
      <span className="text-slate-900 font-bold tabular-nums">{v}</span>
    </div>
  );
}

function Section({
  title, right, children,
}: {
  title: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="text-[15px] font-bold tracking-[-0.01em] m-0 mb-3.5 flex items-center justify-between gap-3">
        {title}
        {right}
      </h2>
      {children}
    </section>
  );
}

function Kpi({
  lab, v, small, delta,
}: {
  lab: string; v: string; small?: string; delta?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1.5">{lab}</div>
      <div className="text-[24px] font-bold tracking-[-0.02em] text-slate-900 tabular-nums">
        {v}
        {small && <small className="text-[13px] font-medium text-slate-500 ml-0.5">{small}</small>}
      </div>
      {delta && <div className="text-[11.5px] text-slate-600 mt-1">{delta}</div>}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-8 px-4 text-center text-[13px] text-slate-500">
      {children}
    </div>
  );
}

/* ============================== OverviewPane ============================== */

function OverviewPane({
  client, extras, chatHref, openSessions,
}: {
  client: ClientData;
  extras: DetailExtras;
  chatHref: string | null;
  openSessions: () => void;
}) {
  const recent = extras.sessions.slice(0, 4);
  return (
    <>
      <Section title="Podsumowanie">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Kpi lab="Sesji łącznie" v={String(extras.kpi.total)} delta={`+${extras.kpi.thisMonth} w tym miesiącu`} />
          <Kpi
            lab="Frekwencja"
            v={extras.kpi.attendancePct !== null ? String(extras.kpi.attendancePct) : "—"}
            small={extras.kpi.attendancePct !== null ? "%" : undefined}
            delta={`${extras.kpi.cancelled} odwołań`}
          />
          <Kpi
            lab="Wartość 12 mies."
            v={extras.kpi.ltv12m !== null ? extras.kpi.ltv12m.toLocaleString("pl-PL") : "—"}
            small={extras.kpi.ltv12m !== null ? "zł" : undefined}
          />
          <Kpi
            lab="Pakiet"
            v={extras.pkg ? `${extras.pkg.used}/${extras.pkg.total}` : "—"}
            delta={extras.pkg ? extras.pkg.name : "brak pakietu"}
          />
        </div>
      </Section>

      <Section title="Aktywny pakiet">
        {extras.pkg ? (
          <div className="bg-slate-50 rounded-xl p-5 grid grid-cols-[1fr_auto] gap-4 items-center max-md:grid-cols-1">
            <div>
              <div className="text-[14px] font-bold mb-2.5">{extras.pkg.name}</div>
              <div className="h-2 bg-slate-200 rounded-md overflow-hidden">
                <div
                  className={"h-full rounded-md " + (extras.pkg.used >= extras.pkg.total ? "bg-red-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(100, Math.round((extras.pkg.used / extras.pkg.total) * 100))}%` }}
                />
              </div>
            </div>
            <div className="text-right max-md:text-left">
              <div className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">
                {extras.pkg.used} / {extras.pkg.total}
              </div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold">Wykorzystane</div>
            </div>
          </div>
        ) : (
          <EmptyHint>Klient nie ma aktywnego pakietu.</EmptyHint>
        )}
      </Section>

      <Section title="Cel klienta">
        {client.goal ? (
          <div className="bg-white border border-slate-200 rounded-[10px] px-4 py-3.5 text-[13.5px] text-slate-900">
            {client.goal}
          </div>
        ) : (
          <EmptyHint>Brak zapisanego celu — dodasz go w zakładce „Notatki i cel”.</EmptyHint>
        )}
      </Section>

      <Section
        title="Ostatnie sesje"
        right={
          extras.sessions.length > 0 ? (
            <button type="button" onClick={openSessions} className="text-[12.5px] font-semibold text-emerald-700 hover:underline">
              Wszystkie {extras.sessions.length} →
            </button>
          ) : undefined
        }
      >
        {recent.length > 0 ? (
          <div className="grid gap-2">
            {recent.map((s) => (
              <SessionRowView key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <EmptyHint>
            {extras.profileId
              ? "Jeszcze żadnych rezerwacji — historia pojawi się po pierwszej sesji."
              : "Klient spoza platformy — sesje rezerwowane przez NaZdrow! pojawiłyby się tutaj."}
          </EmptyHint>
        )}
      </Section>

      <Section
        title="Ostatnia rozmowa"
        right={
          chatHref ? (
            <Link href={chatHref} className="text-[12.5px] font-semibold text-emerald-700 hover:underline">
              Otwórz czat →
            </Link>
          ) : undefined
        }
      >
        {extras.chat.length > 0 ? (
          <div className="bg-slate-50 rounded-xl p-4">
            {extras.chat.map((m, i) => (
              <div
                key={i}
                className={"text-[13px] text-slate-800 leading-relaxed py-2 " + (i === extras.chat.length - 1 ? "" : "border-b border-slate-200")}
              >
                <span className="font-bold text-slate-900">{m.fromMe ? "Ty" : client.display_name.split(" ")[0]}</span>
                <span className="text-slate-500 text-[11.5px] ml-1.5">{shortDate(m.atIso)}</span>
                <br />
                {m.body}
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint>
            {chatHref ? "Brak wiadomości — napisz pierwszy." : "Czat działa tylko z klientami zarejestrowanymi na platformie."}
          </EmptyHint>
        )}
      </Section>
    </>
  );
}

/* ============================== SessionsPane ============================== */

function SessionRowView({ s }: { s: DetailSession }) {
  const { date, time } = sessionDate(s.startIso);
  const st = SESSION_STATUS[s.status] ?? { label: s.status, cls: "text-slate-500" };
  return (
    <div className="grid grid-cols-[80px_1fr_110px] gap-4 items-center px-4 py-3.5 border border-slate-200 rounded-[10px] bg-white max-md:grid-cols-[80px_1fr]">
      <div className="text-[12px] font-bold text-slate-900">
        {date}
        <small className="block text-slate-500 font-medium mt-0.5">{time}</small>
      </div>
      <div>
        <div className="text-[13.5px] font-semibold text-slate-900">{s.title}</div>
        <div className="text-[12px] text-slate-500 mt-0.5">{s.price} zł{s.packageName ? ` · ${s.packageName}` : ""}</div>
      </div>
      <div className={"text-right text-[11.5px] font-bold max-md:hidden " + st.cls}>{st.label}</div>
    </div>
  );
}

function SessionsPane({ sessions }: { sessions: DetailSession[] }) {
  if (sessions.length === 0) {
    return <EmptyHint>Brak sesji w historii.</EmptyHint>;
  }
  return (
    <div className="grid gap-2.5">
      {sessions.map((s) => (
        <SessionWithNotes key={s.id} s={s} />
      ))}
    </div>
  );
}

function SessionWithNotes({ s }: { s: DetailSession }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(s.notes ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveSessionNotes(s.id, text);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved("Zapisano ✓");
      setTimeout(() => setSaved(null), 2500);
    });
  }

  return (
    <div className="border border-slate-200 rounded-[10px] bg-white">
      <div className="grid grid-cols-[80px_1fr_auto] gap-4 items-center px-4 py-3.5 max-md:grid-cols-[80px_1fr]">
        <div className="text-[12px] font-bold text-slate-900">
          {sessionDate(s.startIso).date}
          <small className="block text-slate-500 font-medium mt-0.5">{sessionDate(s.startIso).time}</small>
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-slate-900">{s.title}</div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            {s.price} zł{s.packageName ? ` · ${s.packageName}` : ""}
            {" · "}
            <span className={(SESSION_STATUS[s.status] ?? { cls: "text-slate-500" }).cls + " font-bold"}>
              {(SESSION_STATUS[s.status] ?? { label: s.status }).label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] font-bold text-slate-700 border-[1.5px] border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-400 transition max-md:col-start-2 max-md:justify-self-start"
        >
          {s.notes || open ? "Notatka" : "+ Notatka"}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Notatka z tej sesji — np. „PB w przysiadzie 102 kg, kontrolować kolano”…"
            className="w-full rounded-[9px] border border-slate-200 p-3 text-[13px] focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition resize-y"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 transition disabled:opacity-60"
            >
              {pending ? "Zapisywanie..." : "Zapisz notatkę"}
            </button>
            {saved && <span className="text-[12px] font-semibold text-emerald-700">{saved}</span>}
            {error && <span className="text-[12px] font-semibold text-red-600">{error}</span>}
          </div>
        </div>
      )}
      {!open && s.notes && (
        <div className="border-t border-slate-100 px-4 py-3 text-[12.5px] text-slate-700 whitespace-pre-line">
          {s.notes}
        </div>
      )}
    </div>
  );
}

/* ============================== NotesPane ============================== */

function NotesPane({ client }: { client: ClientData }) {
  const [goal, setGoal] = useState(client.goal ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updateClient(client.id, { goal, notes });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved("Zapisano ✓");
      setTimeout(() => setSaved(null), 2500);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 max-w-[640px]">
      <div>
        <label className="block text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-2">
          Cel klienta
        </label>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={200}
          placeholder="np. redukcja 72 → 65 kg do wakacji"
          className="w-full h-11 px-3.5 rounded-[10px] border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition"
        />
      </div>
      <div>
        <label className="block text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-2">
          Notatki o kliencie
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={10}
          maxLength={4000}
          placeholder="Prywatne notatki — kontuzje, preferencje, ustalenia… (notatki z pojedynczych sesji zapisuj w zakładce Sesje)"
          className="w-full rounded-[10px] border border-slate-200 p-3.5 text-sm leading-relaxed focus:outline-none focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 transition resize-y"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-5 py-3 rounded-[10px] bg-slate-900 text-white text-[13.5px] font-bold hover:bg-slate-800 transition disabled:opacity-60"
        >
          {pending ? "Zapisywanie..." : "Zapisz"}
        </button>
        {saved && <span className="text-[13px] font-semibold text-emerald-700">{saved}</span>}
        {error && <span className="text-[13px] font-semibold text-red-600">{error}</span>}
      </div>
    </div>
  );
}
