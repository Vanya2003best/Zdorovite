"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * /account/plan — Mój plan (design 38).
 *
 * Five modes via top switcher: Bieżący tydzień / Cały plan / Dieta /
 * Suplementy / Historia. The training-plan domain (16-week periodization,
 * exercise library, meal plans, supplement tracking) needs its own schema
 * stack (training_plans, plan_sessions, exercises, diet_plans, meals,
 * supplements) before we can populate it for real. Until that ships:
 *
 *  - "Bieżący tydzień" uses the real `bookings` data the client already
 *    has — confirmed sessions get rendered into the 7-day grid.
 *  - The other modes render honest empty states explaining what they
 *    will show once the trainer's plan-builder is live, plus a link to
 *    "Napisz do trenera" so the client can request one.
 */

export type WeekDayPlan = {
  iso: string;
  /** "PN".."ND" Polish short. */
  shortName: string;
  dayNum: number;
  isToday: boolean;
  isPast: boolean;
  sessions: PlanSession[];
};

export type PlanSession = {
  id: string;
  /** "train" | "cardio" | "mob" | "rest" — drives the colour band. */
  kind: "train" | "cardio" | "mob" | "rest";
  name: string;
  detail: string;
  done: boolean;
  startTime: string | null;
  trainerSlug?: string | null;
  trainerId?: string | null;
};

export type ActivePlanHeader = {
  /** "Plan personalny", "Pakiet 8 sesji", or fallback. */
  name: string;
  description: string;
  status: string;
  /** Progress fraction 0..100 — sessions completed / total. */
  pct: number;
  weekNum: number | null;
  weekTotal: number | null;
  /** Next upcoming session (Booking) — drives the "Następna sesja" stat tile. */
  nextSessionLabel: string | null;
  nextSessionDetail: string | null;
};

export type MojPlanData = {
  primaryTrainerName: string | null;
  primaryTrainerId: string | null;
  weekStartLabel: string;
  weekDays: WeekDayPlan[];
  /** Today's first session — drives the bottom expanded card. */
  todaySession: PlanSession | null;
  activePlan: ActivePlanHeader | null;
  /** Real client goals (from /account/progress getGoals) for the "Cele planu" panel. */
  goals: { title: string; pct: number; progressLabel: string | null }[];
};

type Mode = "week" | "full" | "diet" | "supps" | "history";

export default function MojPlan({ data }: { data: MojPlanData }) {
  const [mode, setMode] = useState<Mode>("week");

  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
        <div>
          <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Mój plan</h1>
          <div className="text-[12.5px] text-slate-500 mt-1">{subtitleFor(mode, data)}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Eksport PDF — wkrótce"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Eksport PDF
          </button>
          {data.primaryTrainerId && (
            <Link
              href={`/account/messages?with=${data.primaryTrainerId}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
            >
              Pytanie do trenera
            </Link>
          )}
        </div>
      </div>

      {/* Plan header card — emerald gradient, always visible */}
      <PlanHeader plan={data.activePlan} primaryTrainerName={data.primaryTrainerName} />

      {/* Mode switcher */}
      <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
        <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium">
          {(
            [
              { id: "week", label: "Bieżący tydzień", badge: "" },
              { id: "full", label: "Cały plan", badge: data.activePlan?.weekTotal ? `${data.activePlan.weekTotal} tyg.` : "" },
              { id: "diet", label: "Dieta", badge: "" },
              { id: "supps", label: "Suplementy", badge: "" },
              { id: "history", label: "Historia", badge: "" },
            ] as { id: Mode; label: string; badge: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
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

      <ModeBanner mode={mode} data={data} />

      {/* Panels */}
      {mode === "week" && <WeekPanel data={data} />}
      {mode === "full" && <FullPlanPanel data={data} />}
      {mode === "diet" && <DietPanel trainerId={data.primaryTrainerId} />}
      {mode === "supps" && <SuppsPanel trainerId={data.primaryTrainerId} />}
      {mode === "history" && <HistoryPanel plan={data.activePlan} />}
    </div>
  );
}

/* ====================== PLAN HEADER ====================== */

function PlanHeader({ plan, primaryTrainerName }: { plan: ActivePlanHeader | null; primaryTrainerName: string | null }) {
  if (!plan) {
    return (
      <div className="rounded-[14px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 mb-4">
        <div className="text-[18px] font-bold tracking-[-0.015em] mb-1.5">Brak aktywnego planu</div>
        <p className="text-[13px] opacity-85 leading-[1.5] max-w-[480px]">
          Plan treningowy układa trener na konsultacji wstępnej. Po zarezerwowaniu kilku sesji ten panel ożywie i pokaże Twoje treningi tydzień po tygodniu.
        </p>
        <Link
          href="/"
          className="inline-flex items-center mt-3 h-9 px-3.5 rounded-[8px] bg-white text-emerald-700 text-[12.5px] font-semibold hover:bg-white/95"
        >
          Znajdź trenera →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 sm:px-6 sm:py-5 mb-4 grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-5 items-center">
      <div>
        <div className="text-[18px] font-bold tracking-[-0.015em] mb-1 flex items-center gap-2.5 flex-wrap">
          {plan.name}
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/25 font-semibold uppercase tracking-[0.04em]">
            {plan.status}
          </span>
        </div>
        <div className="text-[12.5px] opacity-85 leading-[1.5]">{plan.description}</div>
      </div>

      <PlanStat label="Postęp" value={`${plan.pct}`} unit="%" detail={plan.weekNum && plan.weekTotal ? `Tydz. ${plan.weekNum} z ${plan.weekTotal}` : ""} />
      <PlanStat
        label="Następna sesja"
        value={plan.nextSessionLabel ?? "—"}
        unit=""
        detail={plan.nextSessionDetail ?? "Brak rezerwacji"}
      />
      <PlanStat
        label="Trener"
        value={primaryTrainerName ?? "—"}
        unit=""
        detail={primaryTrainerName ? "wspierający plan" : "wybierz trenera"}
      />
    </div>
  );
}

function PlanStat({ label, value, unit, detail }: { label: string; value: string; unit: string; detail: string }) {
  return (
    <div className="border-l border-white/20 pl-4">
      <div className="text-[10px] uppercase tracking-[0.08em] opacity-80 font-semibold mb-1">{label}</div>
      <div className="text-[22px] font-bold tracking-[-0.02em] tabular-nums leading-none">
        {value}
        {unit && <span className="text-[12px] font-medium opacity-80 ml-1">{unit}</span>}
      </div>
      {detail && <div className="text-[11px] opacity-85 mt-1">{detail}</div>}
    </div>
  );
}

/* ====================== WEEK PANEL ====================== */

function WeekPanel({ data }: { data: MojPlanData }) {
  const sessionCount = data.weekDays.reduce((acc, d) => acc + d.sessions.filter((s) => s.kind !== "rest").length, 0);

  return (
    <>
      <div className="flex justify-between items-baseline mb-3 px-0.5">
        <h3 className="text-[15px] font-bold m-0">Tydzień · {data.weekStartLabel}</h3>
        <span className="text-[11px] text-slate-500 font-medium">
          {sessionCount} {plural(sessionCount, "sesja", "sesje", "sesji")}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-4">
        {data.weekDays.map((d) => (
          <div
            key={d.iso}
            className={
              "rounded-[11px] border bg-white overflow-hidden flex flex-col min-h-[200px] " +
              (d.isToday
                ? "border-emerald-500 shadow-[0_0_0_2px_#d1fae5]"
                : "border-slate-200") +
              (d.isPast ? " opacity-60" : "")
            }
          >
            <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center">
              <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${d.isToday ? "text-emerald-600" : "text-slate-500"}`}>
                {d.shortName}
                {d.isToday ? " · DZIŚ" : ""}
              </span>
              <span className={`text-[16px] font-bold tracking-[-0.02em] ${d.isToday ? "text-emerald-600" : "text-slate-900"}`}>
                {d.dayNum}
              </span>
            </div>
            <div className="p-2.5 flex-1 flex flex-col gap-1.5">
              {d.sessions.length === 0 ? (
                <div className="px-2.5 py-2 rounded-[8px] text-[11px] text-slate-400 italic bg-slate-50/60">
                  brak sesji
                </div>
              ) : (
                d.sessions.map((s) => <SessionPill key={s.id} session={s} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {data.todaySession && <TodayCard session={data.todaySession} />}
    </>
  );
}

function SessionPill({ session }: { session: PlanSession }) {
  const tone =
    session.kind === "train"
      ? "bg-emerald-50 border-l-emerald-500"
      : session.kind === "cardio"
        ? "bg-fuchsia-50 border-l-fuchsia-500"
        : session.kind === "mob"
          ? "bg-sky-50 border-l-sky-500"
          : "bg-slate-100 border-l-slate-400";
  const isRest = session.kind === "rest";
  return (
    <div className={`px-2.5 py-2 rounded-[8px] border-l-[3px] ${tone}`}>
      <div className={`text-[11.5px] font-semibold leading-[1.35] ${isRest ? "text-slate-500" : "text-slate-900"}`}>
        {session.done && <span className="text-emerald-700 mr-1">✓</span>}
        {session.name}
      </div>
      {session.detail && (
        <div className="text-[10.5px] text-slate-500 mt-0.5 leading-[1.3]">{session.detail}</div>
      )}
    </div>
  );
}

function TodayCard({ session }: { session: PlanSession }) {
  return (
    <div className="rounded-[14px] border-2 border-emerald-500 bg-white overflow-hidden mb-4">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-5 py-4 flex justify-between items-center flex-wrap gap-2">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.08em] opacity-80 font-bold">
            Dziś{session.startTime ? ` · ${session.startTime}` : ""}
          </div>
          <div className="text-[18px] font-bold tracking-[-0.015em] mt-0.5">{session.name}</div>
        </div>
        <div className="flex gap-2">
          {session.trainerSlug && (
            <Link
              href={`/trainers/${session.trainerSlug}`}
              className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-[8px] text-[12.5px] font-semibold transition"
            >
              Profil trenera
            </Link>
          )}
          {session.trainerId && (
            <Link
              href={`/account/messages?with=${session.trainerId}`}
              className="bg-white text-emerald-700 px-3 py-2 rounded-[8px] text-[12.5px] font-semibold hover:bg-white/95"
            >
              Napisz
            </Link>
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="text-[12.5px] text-slate-700 leading-[1.5] mb-2.5">{session.detail || "Brak szczegółów."}</p>
        <div className="rounded-[10px] bg-slate-50 border border-dashed border-slate-200 px-4 py-3 text-[11.5px] text-slate-500 leading-[1.5]">
          Lista ćwiczeń (sety, powtórzenia, ciężary) i wideo demonstracji pojawią się tu, gdy trener
          uruchomi moduł treningowy w Studio.
        </div>
      </div>
    </div>
  );
}

/* ====================== FULL PLAN PANEL ====================== */

function FullPlanPanel({ data }: { data: MojPlanData }) {
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card>
          <CardHeader title="Periodyzacja" sub="planowanie cykli treningowych" />
          <PlaceholderEmpty
            text="Wykres periodyzacji (akumulacja → intensyfikacja → realizacja → deload) pojawi się, gdy trener wprowadzi długoterminowy plan w Studio."
          />
        </Card>
        <Card>
          <CardHeader title="Cele planu" sub={`${data.goals.length} aktywnych`} />
          {data.goals.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              Brak celów. Ustaw je z trenerem na konsultacji.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.goals.slice(0, 4).map((g, i) => {
                const done = g.pct >= 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-baseline text-[12.5px] mb-1.5">
                      <span className="font-semibold text-slate-900 truncate flex-1 mr-2">
                        {g.title} — {g.pct}%{done ? " ✓" : ""}
                      </span>
                      {g.progressLabel && (
                        <span className={"text-[11.5px] " + (done ? "text-emerald-700 font-semibold" : "text-slate-500")}>
                          {g.progressLabel}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                        style={{ width: `${Math.min(100, g.pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Tydzień po tygodniu" sub="oś czasu planu" />
        <PlaceholderEmpty
          text="Tydzień po tygodniu będzie tu prowadzić Cię od pierwszego treningu do ostatniego — z fazami i kamieniami milowymi. Dostępne po wprowadzeniu planu przez trenera."
        />
      </Card>
    </>
  );
}

/* ====================== DIET PANEL ====================== */

function DietPanel({ trainerId }: { trainerId: string | null }) {
  return (
    <Card>
      <CardHeader title="Dieta" sub="moduł żywieniowy w przygotowaniu" />
      <PlaceholderEmpty
        text="Plan posiłków, makroskładniki dzienne i lista zakupów pojawią się, gdy trener (lub współpracujący dietetyk) ustali Twój plan żywieniowy. Dieta jest opcjonalnym dodatkiem do planu treningowego."
        cta={trainerId ? { label: "Zapytaj o dietę", href: `/account/messages?with=${trainerId}` } : { label: "Znajdź trenera", href: "/" }}
      />
    </Card>
  );
}

/* ====================== SUPPS PANEL ====================== */

function SuppsPanel({ trainerId }: { trainerId: string | null }) {
  return (
    <>
      <Card>
        <CardHeader title="Suplementy" sub="tracking konsystencji w przygotowaniu" />
        <PlaceholderEmpty
          text="Tutaj zobaczysz suplementy zarekomendowane przez trenera, dawki, pory dnia i konsystencję z ostatnich 30 dni. Funkcja zostanie odblokowana po włączeniu modułu suplementacyjnego."
          cta={trainerId ? { label: "Zapytaj o suplementację", href: `/account/messages?with=${trainerId}` } : null}
        />
      </Card>

      <div className="mt-4 px-5 py-4 bg-amber-50 border border-amber-200 rounded-[11px] text-[12px] text-amber-900 leading-[1.5]">
        <b>⚠ Disclaimer:</b> Suplementy są zawsze <b>rekomendacją</b>, nie obowiązkiem. Konsultacja z lekarzem jest zalecana przed rozpoczęciem suplementacji, szczególnie w przypadku schorzeń, ciąży lub przyjmowania leków. NaZdrow! nie zastępuje porady medycznej.
      </div>
    </>
  );
}

/* ====================== HISTORY PANEL ====================== */

function HistoryPanel({ plan }: { plan: ActivePlanHeader | null }) {
  return (
    <Card>
      <CardHeader title="Wszystkie plany" sub="historia współpracy" />
      {plan ? (
        <div className="rounded-[12px] border border-emerald-300 bg-gradient-to-b from-emerald-50/50 to-white px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
              {plan.name}
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold uppercase tracking-[0.06em]">
                {plan.status}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {plan.weekNum && plan.weekTotal ? `Tydz. ${plan.weekNum} / ${plan.weekTotal}` : "obecny"}
              {plan.description ? ` · ${plan.description.slice(0, 80)}${plan.description.length > 80 ? "…" : ""}` : ""}
            </div>
          </div>
          <div className="text-[13px] font-bold text-emerald-700 tabular-nums">{plan.pct}%</div>
        </div>
      ) : (
        <PlaceholderEmpty text="Brak historii planów. Po zakończeniu pierwszego planu pojawi się on tutaj jako PDF do pobrania." />
      )}
    </Card>
  );
}

/* ====================== SHARED ====================== */

function ModeBanner({ mode, data }: { mode: Mode; data: MojPlanData }) {
  const cls = "flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 border ";
  const sessionCount = data.weekDays.reduce((acc, d) => acc + d.sessions.filter((s) => s.kind !== "rest").length, 0);
  if (mode === "week") {
    return (
      <div className={cls + "bg-emerald-50 border-emerald-200 text-emerald-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {sessionCount > 0
              ? `${data.weekStartLabel} · ${sessionCount} ${plural(sessionCount, "zaplanowana sesja", "zaplanowane sesje", "zaplanowanych sesji")}`
              : `${data.weekStartLabel} · brak zaplanowanych sesji`}
          </b>
          <div className="text-emerald-800/80 mt-0.5">
            Sesje pochodzą z Twoich rezerwacji. Zaplanuj kolejne w katalogu trenerów.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "full") {
    return (
      <div className={cls + "bg-sky-50 border-sky-200 text-sky-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-sky-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12" /></svg>
        </span>
        <div>
          <b className="font-semibold">Cały plan · widok długoterminowy</b>
          <div className="text-sky-800/80 mt-0.5">
            Wykres periodyzacji i tygodnie po tygodniu pojawią się, gdy trener wprowadzi plan w Studio.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "diet") {
    return (
      <div className={cls + "bg-amber-50 border-amber-200 text-amber-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-amber-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12c0-5 4-9 9-9" /></svg>
        </span>
        <div>
          <b className="font-semibold">Plan żywieniowy</b>
          <div className="text-amber-800/80 mt-0.5">
            Makroskładniki, posiłki dnia i lista zakupów — wkrótce, po wprowadzeniu modułu żywieniowego.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "supps") {
    return (
      <div className={cls + "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-fuchsia-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
        </span>
        <div>
          <b className="font-semibold">Suplementy &amp; konsystencja</b>
          <div className="text-fuchsia-800/80 mt-0.5">
            Pamiętaj: suplementy są zawsze rekomendacją, nie obowiązkiem. Skonsultuj się z lekarzem.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cls + "bg-slate-100 border-slate-200 text-slate-700"}>
      <span className="w-7 h-7 rounded-[8px] bg-slate-500 text-white inline-flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1015 6" /></svg>
      </span>
      <div>
        <b className="font-semibold">Historia planów</b>
        <div className="text-slate-500 mt-0.5">
          Po zakończeniu cyklu plan trafi tutaj jako archiwum (PDF do pobrania).
        </div>
      </div>
    </div>
  );
}

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

function PlaceholderEmpty({ text, cta }: { text: string; cta?: { label: string; href: string } | null }) {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-slate-200 py-10 px-6 text-center">
      <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[480px] mx-auto">{text}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center mt-3 h-9 px-3.5 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

function ModeIcon({ id }: { id: Mode }) {
  if (id === "week")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" />
      </svg>
    );
  if (id === "full")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      </svg>
    );
  if (id === "diet")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 3v18" />
      </svg>
    );
  if (id === "supps")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1015 6" /><path d="M3 6v6h6" />
    </svg>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function subtitleFor(mode: Mode, data: MojPlanData): string {
  if (mode === "week") {
    return `${data.weekStartLabel} · ${data.weekDays.reduce((acc, d) => acc + d.sessions.length, 0)} sesje zaplanowane`;
  }
  if (mode === "full") {
    return data.activePlan
      ? `${data.activePlan.name} · ${data.activePlan.pct}% postępu`
      : "Plan długoterminowy — wymaga aktywnego planu";
  }
  if (mode === "diet") return "Plan żywieniowy · w przygotowaniu";
  if (mode === "supps") return "Suplementacja · w przygotowaniu";
  return data.activePlan ? `${data.activePlan.name} · 1 plan w historii` : "Brak historii planów";
}
