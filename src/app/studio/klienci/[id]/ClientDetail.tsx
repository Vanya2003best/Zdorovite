"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * /studio/klienci/[id] — OLX-style client detail view.
 *
 * Visual reference: design 36-studio-klient-detail-olx.html.
 *
 * Real fields wired through page.tsx (trainer_clients row): display_name,
 * email, phone, tags, notes, created_at. Everything else (KPIs, sesje
 * history, goals, package, chat preview, next session, quick stats,
 * source) is mocked here because the underlying tables don't exist yet:
 *   - bookings → sessions count / history / next session
 *   - packages + package_redemptions → active package + LTV
 *   - client_goals → goals
 *   - messages → chat preview
 *   - lead_sources → source attribution
 * Each section is tagged with a `MOCK:` comment so future migration
 * passes can swap surfaces independently without touching the layout.
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

type Tab = "overview" | "sessions" | "plan" | "chat" | "notes";

const ICON = {
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
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
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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
  tab_plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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
  act_msg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  act_book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ClientDetail({ client }: { client: ClientData }) {
  const [tab, setTab] = useState<Tab>("overview");

  const name = client.display_name || "Klient";
  const inits = initialsOf(name);

  return (
    <>
      {/* BREADCRUMBS — sits between studio chrome and the body. White
          background with a single-line trail Pulpit › Klienci › <name>. */}
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
            {/* HEADER CARD: avatar + name + status + contact + tags + row-acts */}
            <div className="bg-white border border-slate-200 rounded-2xl p-7 grid grid-cols-[96px_1fr_auto] gap-6 items-start max-md:grid-cols-[64px_1fr] max-md:p-5">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-[34px] inline-flex items-center justify-center shrink-0 max-md:w-16 max-md:h-16 max-md:text-[24px]">
                {inits}
              </div>
              <div className="min-w-0">
                <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] m-0 mb-1.5 flex items-center gap-3.5 flex-wrap">
                  <span className="truncate">{name}</span>
                  {/* MOCK: status — trainer_clients doesn't have a status column
                      yet. Hardcoded "Aktywny" pill. Migration 024 adds status. */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-700 text-white text-[12.5px] font-bold">
                    <span className="w-[7px] h-[7px] rounded-full bg-emerald-300" />
                    Aktywny
                  </span>
                </h1>
                <div className="text-[13.5px] text-slate-500 mb-3.5">
                  Klient{name.endsWith("a") ? "ka" : ""} od {monthYearPl(client.created_at)}
                  {/* MOCK: trainer rating + tenure-in-months. Need a derived
                      view over reviews. */}
                  {" · ★ 4,9 / 5 — ocena trenera"}
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
                  {/* MOCK: location + demographics — trainer_clients has no
                      city/age/gender fields. Migration 024 adds optional
                      `city` and `birth_year`. */}
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-slate-500">{ICON.pin}</span>
                    Warszawa · Mokotów
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-slate-500">{ICON.clock}</span>
                    Kobieta · 34 lata
                  </div>
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
              <div className="flex flex-col gap-2 items-end max-md:hidden">
                <button type="button" title="Edytuj" className="w-9 h-9 rounded-[9px] border-[1.5px] border-slate-200 bg-white inline-flex items-center justify-center text-slate-700 hover:border-slate-400 transition">
                  {ICON.edit}
                </button>
                <button type="button" title="Udostępnij" className="w-9 h-9 rounded-[9px] border-[1.5px] border-slate-200 bg-white inline-flex items-center justify-center text-slate-700 hover:border-slate-400 transition">
                  {ICON.share}
                </button>
                <button type="button" title="Więcej" className="w-9 h-9 rounded-[9px] border-[1.5px] border-slate-200 bg-white inline-flex items-center justify-center text-slate-700 hover:border-slate-400 transition">
                  {ICON.more}
                </button>
              </div>
            </div>

            {/* DETAIL TABS — top-rounded card edges connect to the pane below */}
            <div className="flex border border-slate-200 border-b-[1.5px] bg-white rounded-t-2xl px-4 mt-6 overflow-x-auto scrollbar-hide">
              <DetailTab on={tab === "overview"} onClick={() => setTab("overview")} icon={ICON.tab_overview} label="Przegląd" />
              {/* MOCK: 23 = total sessions; real count requires bookings join */}
              <DetailTab on={tab === "sessions"} onClick={() => setTab("sessions")} icon={ICON.tab_cal} label="Sesje" badge="23" />
              <DetailTab on={tab === "plan"} onClick={() => setTab("plan")} icon={ICON.tab_plan} label="Plan treningowy" />
              <DetailTab on={tab === "chat"} onClick={() => setTab("chat")} icon={ICON.tab_chat} label="Czat" />
              <DetailTab on={tab === "notes"} onClick={() => setTab("notes")} icon={ICON.tab_notes} label="Notatki" badge="7" />
            </div>

            {/* PANE — bottom-rounded, connected to tabs */}
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl p-7 max-md:p-5">
              {tab === "overview" && <OverviewPane clientNotes={client.notes} />}
              {tab !== "overview" && (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-10 text-center text-[13px] text-slate-500">
                  Sekcja „{tab === "sessions" ? "Sesje" : tab === "plan" ? "Plan treningowy" : tab === "chat" ? "Czat" : "Notatki"}" pojawi się tutaj wkrótce.
                </div>
              )}
            </div>
          </main>

          {/* ============================== ASIDE ============================== */}
          <aside className="lg:sticky lg:top-[92px] flex flex-col gap-4">
            {/* NEXT SESSION — green gradient hero card */}
            {/* MOCK: derived from upcoming bookings WHERE client = this one */}
            <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#047857,#065f46)" }}>
              <div className="text-[11px] uppercase tracking-[0.08em] opacity-80 font-bold mb-2">Najbliższa sesja</div>
              <div className="text-[22px] font-bold tracking-[-0.02em] mb-1">Dziś · 14:00</div>
              <div className="text-[13px] opacity-90 mb-3.5">Siłownia Mokotów · nogi + brzuch</div>
              <div className="flex gap-2">
                <button type="button" className="flex-1 py-2.5 rounded-lg bg-white text-emerald-700 text-[12.5px] font-bold hover:bg-emerald-50 transition">
                  Rozpocznij
                </button>
                <button type="button" className="flex-1 py-2.5 rounded-lg bg-white/20 text-white text-[12.5px] font-bold hover:bg-white/25 transition">
                  Przełóż
                </button>
              </div>
            </div>

            {/* AKCJE */}
            <div className="bg-white border border-slate-200 rounded-[14px] p-5">
              <h3 className="text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold m-0 mb-3.5">Akcje</h3>
              <div className="grid gap-2">
                <ActionBtn tone="prim" icon={ICON.act_msg} label="Wyślij wiadomość" />
                <ActionBtn tone="line" icon={ICON.act_book} label="Umów sesję" />
                <ActionBtn tone="line" icon={ICON.tab_plan} label="Zaktualizuj plan" />
                <ActionBtn tone="brand" icon={ICON.act_pkg} label="Zaproponuj nowy pakiet" />
                <ActionBtn tone="line" icon={ICON.tab_notes} label="Dodaj notatkę" />
                <ActionBtn tone="danger" icon={ICON.act_pause} label="Wstrzymaj klienta" />
              </div>
            </div>

            {/* SZYBKIE STATYSTYKI */}
            {/* MOCK: requires bookings + packages aggregation */}
            <div className="bg-white border border-slate-200 rounded-[14px] p-5">
              <h3 className="text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold m-0 mb-3.5">Szybkie statystyki</h3>
              <StatRow lab="Klient od" v={shortDate(client.created_at)} />
              <StatRow lab="Sesji łącznie" v="23" />
              <StatRow lab="Średnio / tydz." v="1,9" />
              <StatRow lab="Frekwencja" v="96 %" />
              <StatRow lab="Odwołania" v="1" />
              <StatRow lab="Wydane łącznie" v="4 320 zł" />
              <StatRow lab="Ostatnia płatność" v="14.04 · 1 440 zł" />
            </div>

            {/* ŹRÓDŁO POZYSKANIA */}
            {/* MOCK: requires lead_sources table tracking acquisition channel */}
            <div className="bg-white border border-slate-200 rounded-[14px] p-5">
              <h3 className="text-[12.5px] uppercase tracking-[0.08em] text-slate-500 font-bold m-0 mb-3.5">Źródło pozyskania</h3>
              <StatRow lab="Kanał" v="Z /trainers (profil)" />
              <StatRow lab="Pierwszy kontakt" v="9.01.2026" />
              <StatRow lab="Konsultacja" v="11.01 · 15 min" />
              <StatRow lab="Konwersja" v="2 dni" />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

/* ====================== Helpers + small subcomponents ====================== */

function shortDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

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

function ActionBtn({
  tone, icon, label,
}: {
  tone: "prim" | "line" | "brand" | "danger"; icon: React.ReactNode; label: string;
}) {
  const cls =
    tone === "prim"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : tone === "brand"
        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        : tone === "danger"
          ? "bg-white border-[1.5px] border-slate-200 text-red-700 hover:bg-red-50"
          : "bg-white border-[1.5px] border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-400";
  return (
    <button
      type="button"
      className={"px-4 py-3 rounded-[10px] text-[13.5px] font-bold inline-flex items-center gap-2.5 transition " + cls}
    >
      {icon}
      {label}
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

/* ============================== OverviewPane ============================== */

function OverviewPane({ clientNotes }: { clientNotes: string | null }) {
  return (
    <>
      {/* SECTION: KPI ROW — Podsumowanie */}
      <Section title="Podsumowanie">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* MOCK: each KPI needs a derived view */}
          <Kpi lab="Sesji łącznie" v="23" delta="+5 w tym miesiącu" />
          <Kpi lab="Frekwencja" v="96" small="%" delta={<><b className="text-emerald-700">↑ 4 pp</b> vs średnia</>} />
          <Kpi lab="Wartość LTV" v="4 320" small="zł" delta="~ 1 080 zł / mies." />
          <Kpi lab="NPS" v="9" small="/10" delta="Promotor" />
        </div>
      </Section>

      {/* SECTION: AKTYWNY PAKIET */}
      <Section title="Aktywny pakiet" rightLink="Historia pakietów →">
        {/* MOCK: requires package_redemptions table */}
        <div className="bg-slate-50 rounded-xl p-5 grid grid-cols-[1fr_auto] gap-4 items-center max-md:grid-cols-1">
          <div>
            <div className="text-[14px] font-bold mb-1">Pakiet 8 sesji · Siłownia indywidualna</div>
            <div className="text-[12px] text-slate-600 mb-2.5">
              Kupiony 14.04.2026 · Wygasa 14.07.2026 · 1 440 zł (180 zł / sesja)
            </div>
            <div className="h-2 bg-slate-200 rounded-md overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-md" style={{ width: "62%" }} />
            </div>
          </div>
          <div className="text-right max-md:text-left">
            <div className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">5 / 8</div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold">Wykorzystane</div>
          </div>
        </div>
      </Section>

      {/* SECTION: CELE */}
      <Section title="Cele" rightLink="Edytuj cele →">
        {/* MOCK: requires client_goals table */}
        <div className="grid gap-2.5">
          <Goal nm="Redukcja masy: 72 → 65 kg" sub="Pomiar 11 stycznia: 72,4 kg · pomiar 8 maja: 67,1 kg" pct="75%" />
          <Goal nm="Martwy ciąg: 80 kg × 5" sub="Start: 50 kg × 5 · obecnie: 70 kg × 5" pct="67%" />
          <Goal nm="Frekwencja 2× / tydz. przez 3 mies." sub="Marzec 8/8 · kwiecień 9/9 · maj 5/9 (w toku)" pct="88%" />
        </div>
      </Section>

      {/* SECTION: OSTATNIE SESJE */}
      <Section title="Ostatnie sesje" rightLink="Wszystkie 23 →">
        {/* MOCK: requires bookings WHERE client_id = this client */}
        <div className="grid gap-2">
          <SessionRow date="Dziś" time="14:00" nm="Siłownia · nogi + brzuch" sub="90 min · plan A2" loc="Mokotów" status="up" statusLabel="Zaplanowana" />
          <SessionRow date="Pon 5.05" time="14:00" nm="Siłownia · klatka + barki" sub="90 min · plan A1 · ★ 5/5" loc="Mokotów" status="done" statusLabel="✓ Zakończona" />
          <SessionRow date="Czw 1.05" time="14:00" nm="Siłownia · plecy + biceps" sub="90 min · plan B1" loc="Mokotów" status="done" statusLabel="✓ Zakończona" />
          <SessionRow date="Pon 28.04" time="14:00" nm="Siłownia · nogi" sub="90 min · plan A2" loc="Mokotów" status="done" statusLabel="✓ Zakończona" />
        </div>
      </Section>

      {/* SECTION: CHAT PREVIEW */}
      <Section title="Ostatnia rozmowa" rightLink="Otwórz czat →">
        {/* MOCK: requires last 3 rows from messages WHERE (from_id, to_id) match */}
        <div className="bg-slate-50 rounded-xl p-4">
          <ChatMsg who="Anna" time="wczoraj · 19:42" body="Cześć! Czy możemy przełożyć jutrzejszą sesję z 14:00 na 16:00? Mam zebranie służbowe." last={false} />
          <ChatMsg who="Ty" time="wczoraj · 20:15" body="Jasne, bez problemu. Przepisuję na 16:00. Powodzenia na zebraniu!" last={false} />
          <ChatMsg who="Anna" time="wczoraj · 20:16" body="Dzięki wielkie! ❤️" last />
        </div>
      </Section>

      {/* SECTION: NOTES */}
      <Section title="Ostatnie notatki" rightLink="Wszystkie 7 →">
        {/* Real: client.notes is one big textarea; we surface it as the
            first note. The rest are MOCK until we split notes into a
            separate `client_notes` table with timestamps + categories. */}
        <div className="grid gap-2.5">
          {clientNotes && clientNotes.trim() ? (
            <NoteRow meta="z formularza profilu" body={clientNotes} />
          ) : null}
          <NoteRow
            meta="5 maja · po sesji"
            body="Anna w świetnej formie — martwy ciąg 70 kg poszedł czysto. Następna progresja w czerwcu: 75 kg. Wspomniała o lekkim bólu kolana — kontrolować przy przysiadach."
          />
          <NoteRow
            meta="14 kwietnia · plan"
            body="Zaktualizowany plan A/B na maj — dodajemy hipertroficzny dzień barków. Cel: złamać 70 kg w martwym do połowy czerwca."
          />
        </div>
      </Section>
    </>
  );
}

function Section({
  title, rightLink, children,
}: {
  title: string; rightLink?: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="text-[15px] font-bold tracking-[-0.01em] m-0 mb-3.5 flex items-center justify-between gap-3">
        {title}
        {rightLink && (
          <button type="button" className="text-[12.5px] font-semibold text-emerald-700 hover:underline">
            {rightLink}
          </button>
        )}
      </h2>
      {children}
    </section>
  );
}

function Kpi({
  lab, v, small, delta,
}: {
  lab: string; v: string; small?: string; delta: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1.5">{lab}</div>
      <div className="text-[24px] font-bold tracking-[-0.02em] text-slate-900 tabular-nums">
        {v}
        {small && <small className="text-[13px] font-medium text-slate-500 ml-0.5">{small}</small>}
      </div>
      <div className="text-[11.5px] text-slate-600 mt-1">{delta}</div>
    </div>
  );
}

function Goal({ nm, sub, pct }: { nm: string; sub: string; pct: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] px-4 py-3.5 grid grid-cols-[1fr_auto] gap-3.5 items-center">
      <div>
        <div className="text-[13.5px] font-semibold">{nm}</div>
        <div className="text-[11.5px] text-slate-500 mt-0.5">{sub}</div>
      </div>
      <div className="text-[18px] font-bold text-emerald-700">{pct}</div>
    </div>
  );
}

function SessionRow({
  date, time, nm, sub, loc, status, statusLabel,
}: {
  date: string; time: string; nm: string; sub: string; loc: string; status: "done" | "up"; statusLabel: string;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_140px_110px] gap-4 items-center px-4 py-3.5 border border-slate-200 rounded-[10px] bg-white hover:border-slate-400 transition max-md:grid-cols-[80px_1fr]">
      <div className="text-[12px] font-bold text-slate-900">
        {date}
        <small className="block text-slate-500 font-medium mt-0.5">{time}</small>
      </div>
      <div>
        <div className="text-[13.5px] font-semibold text-slate-900">{nm}</div>
        <div className="text-[12px] text-slate-500 mt-0.5">{sub}</div>
      </div>
      <div className="text-[12.5px] text-slate-700 max-md:hidden">{loc}</div>
      <div className={"text-right text-[11.5px] font-bold max-md:hidden " + (status === "done" ? "text-emerald-700" : "text-blue-700")}>
        {statusLabel}
      </div>
    </div>
  );
}

function ChatMsg({
  who, time, body, last,
}: {
  who: string; time: string; body: string; last: boolean;
}) {
  return (
    <div className={"text-[13px] text-slate-800 leading-relaxed py-2 " + (last ? "" : "border-b border-slate-200")}>
      <span className="font-bold text-slate-900">{who}</span>
      <span className="text-slate-500 text-[11.5px] ml-1.5">{time}</span>
      <br />
      {body}
    </div>
  );
}

function NoteRow({ meta, body }: { meta: string; body: string }) {
  return (
    <div className="border border-slate-200 rounded-[10px] px-4 py-3.5 bg-white">
      <div className="text-[11.5px] text-slate-500 mb-1.5">{meta}</div>
      <div className="text-[13.5px] text-slate-900 leading-relaxed whitespace-pre-line">{body}</div>
    </div>
  );
}
