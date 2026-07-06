"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWeight } from "@/lib/actions/weight";

/**
 * /account/progress — Postępy (design 37).
 *
 * Five modes via top switcher: Przegląd / Sylwetka / Siła / Cardio / Cele.
 * Server orchestrator (page.tsx) supplies real data from the existing
 * tables (weight_log, goals, bookings); modes without
 * a backing dataset (body measurements, strength tracking, Garmin)
 * render an honest empty state pointing to what's needed to enable them.
 */

export type PostepyData = {
  /** Latest weight in kg, or null if user hasn't logged any. */
  latestWeightKg: number | null;
  /** Weight 6 mo ago — drives the −X kg headline. Null when single datapoint. */
  weightSixMonthsAgoKg: number | null;
  /** Series for the trend chart — newest at the end. */
  weightSeries: { iso: string; kg: number }[];
  /** Optional weight target from goals (auto-detected by title regex). */
  weightTargetKg: number | null;
  /** Sessions this week (rings + summary) — array indexed Mon..Sun. */
  weekDayCounts: number[];
  /** Sessions this week + minutes total + cap (target). */
  weekSessionsDone: number;
  weekSessionsTarget: number;
  weekMinutesDone: number;
  weekMinutesTarget: number;
  /** Active goals — full list from goals table. */
  goals: Goal[];
  /** Achieved goals (pct >= 100), capped at 6 for the history strip. */
  achievedGoals: Goal[];
  /** Streak — consecutive weeks with at least one completed session. */
  streakWeeks: number;
  /** Total months coaching — first booking → today. */
  monthsCoaching: number;
  /** Sessions completed all-time. */
  sessionsAllTime: number;
  /** First name of the most-frequent trainer (for headlines). */
  primaryTrainerName: string | null;
};

export type Goal = {
  id: string;
  title: string;
  pct: number;
  /** Target date label like "10 czerwca 2026", or null. */
  targetDate: string | null;
  /** Optional human-friendly progress string ("−3.4 / −5 kg"). */
  progressLabel: string | null;
};

type Mode = "overview" | "body" | "strength" | "cardio" | "goals";
type Period = "week" | "month" | "3m" | "6m" | "year" | "all";

export default function Postepy({ data }: { data: PostepyData }) {
  const [mode, setMode] = useState<Mode>("overview");
  const [period, setPeriod] = useState<Period>("3m");

  const weightDelta =
    data.latestWeightKg && data.weightSixMonthsAgoKg
      ? Number((data.latestWeightKg - data.weightSixMonthsAgoKg).toFixed(1))
      : null;

  const subtitle = subtitleFor(mode, data, weightDelta);

  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
        <div>
          <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Postępy</h1>
          <div className="text-[12.5px] text-slate-500 mt-1">{subtitle}</div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <PeriodSwitcher value={period} onChange={setPeriod} />
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
          <LogWeightButton latest={data.latestWeightKg} />
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
        <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium">
          {(
            [
              { id: "overview", label: "Przegląd", badge: "" },
              { id: "body", label: "Sylwetka", badge: "" },
              { id: "strength", label: "Siła", badge: "" },
              { id: "cardio", label: "Cardio", badge: "" },
              {
                id: "goals",
                label: "Cele",
                badge: data.goals.filter((g) => g.pct < 100).length > 0 ? String(data.goals.filter((g) => g.pct < 100).length) : "",
              },
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

      {/* Banner */}
      <ModeBanner mode={mode} data={data} weightDelta={weightDelta} />

      {/* Panels */}
      {mode === "overview" && <OverviewPanel data={data} weightDelta={weightDelta} />}
      {mode === "body" && <BodyPanel data={data} weightDelta={weightDelta} />}
      {mode === "strength" && <StrengthPanel />}
      {mode === "cardio" && <CardioPanel />}
      {mode === "goals" && <GoalsPanel data={data} />}
    </div>
  );
}

/* ================== OVERVIEW ================== */

function OverviewPanel({ data, weightDelta }: { data: PostepyData; weightDelta: number | null }) {
  const topGoal = data.goals[0] ?? null;
  return (
    <>
      <SummaryStrip
        cards={[
          data.latestWeightKg
            ? {
                label: "Waga",
                value: data.latestWeightKg.toFixed(1),
                unit: "kg",
                detail:
                  weightDelta !== null
                    ? `${weightDelta < 0 ? "↓" : weightDelta > 0 ? "↑" : "→"} ${Math.abs(weightDelta).toFixed(1)} kg / 6 mies.`
                    : "pierwszy pomiar",
                up: weightDelta !== null && weightDelta < 0,
                down: weightDelta !== null && weightDelta > 0,
              }
            : { label: "Waga", value: "—", unit: "", detail: "Zapisz pomiar" },
          { label: "Sesje all-time", value: String(data.sessionsAllTime), unit: "", detail: data.monthsCoaching ? `${data.monthsCoaching} mies. trening.` : "" },
          { label: "Pasmo", value: String(data.streakWeeks), unit: "tyg.", detail: data.streakWeeks > 0 ? "aktualne" : "rozpocznij!", up: data.streakWeeks > 0 },
          {
            label: "Aktywne cele",
            value: String(data.goals.filter((g) => g.pct < 100).length),
            unit: "",
            detail: data.goals.length > 0 ? `${data.goals.filter((g) => g.pct >= 100).length} osiągnięte` : "Ustaw pierwszy",
          },
          topGoal
            ? {
                label: `Cel: ${topGoal.title.slice(0, 22)}`,
                value: String(topGoal.pct),
                unit: "%",
                detail: topGoal.progressLabel ?? topGoal.targetDate ?? "",
              }
            : { label: "Cel", value: "—", unit: "", detail: "Ustaw cel" },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card>
          <CardHeader title="Trend wagi" sub={data.weightSeries.length >= 2 ? "ostatnie pomiary" : "potrzeba ≥2 pomiarów"} />
          {data.weightSeries.length >= 2 ? (
            <WeightChart series={data.weightSeries} target={data.weightTargetKg} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] text-slate-500 max-w-[280px]">
                Zapisz drugi pomiar (innego dnia), by zobaczyć trend wagi.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Aktywność · ten tydzień" />
          <ActivityRings data={data} />
        </Card>
      </div>

      {/* Trainer-notes card removed: session_notes are trainer-private by
          design (migration 025), so the section could never show data. */}
      <div className="mb-4">
        <Card>
          <CardHeader
            title="Postęp celów"
            sub={`${data.goals.filter((g) => g.pct < 100).length} aktywne`}
          />
          {data.goals.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              Brak celów. Ustaw je z trenerem na konsultacji.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.goals.slice(0, 4).map((g) => (
                <GoalRow key={g.id} g={g} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Osiągnięcia" sub={`${achievementCount(data)} odblokowanych`} />
        <Achievements data={data} />
      </Card>
    </>
  );
}

/* ================== BODY ================== */

function BodyPanel({ data, weightDelta }: { data: PostepyData; weightDelta: number | null }) {
  return (
    <>
      <SummaryStrip
        cards={[
          data.latestWeightKg
            ? {
                label: "Waga",
                value: data.latestWeightKg.toFixed(1),
                unit: "kg",
                detail:
                  weightDelta !== null
                    ? `${weightDelta < 0 ? "↓" : "↑"} ${Math.abs(weightDelta).toFixed(1)} kg / 6 mies.`
                    : "pierwszy pomiar",
                up: weightDelta !== null && weightDelta < 0,
              }
            : { label: "Waga", value: "—", unit: "", detail: "" },
          { label: "Pas", value: "—", unit: "cm", detail: "Wkrótce" },
          { label: "Klatka", value: "—", unit: "cm", detail: "Wkrótce" },
          { label: "Tk. tłuszczowa", value: "—", unit: "%", detail: "Wkrótce" },
          { label: "BMI", value: "—", unit: "", detail: "Brak wzrostu" },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card>
          <CardHeader title="Pomiary · ostatnie 6 mies." sub="tylko waga (na razie)" />
          {data.weightSeries.length >= 2 ? (
            <WeightChart series={data.weightSeries} target={data.weightTargetKg} />
          ) : (
            <PlaceholderEmpty text="Potrzeba ≥2 pomiarów wagi, żeby zobaczyć trend." />
          )}
        </Card>

        <Card>
          <CardHeader title="Pełne pomiary" sub="wkrótce" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Pas", v: "—", u: "cm" },
              { l: "Biodra", v: "—", u: "cm" },
              { l: "Klatka", v: "—", u: "cm" },
              { l: "Ramię", v: "—", u: "cm" },
              { l: "Udo", v: "—", u: "cm" },
              { l: "Tk. tłuszczowa", v: "—", u: "%" },
            ].map((m) => (
              <div key={m.l} className="border border-slate-200 rounded-[11px] p-3.5">
                <div className="text-[11px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1.5">
                  {m.l}
                </div>
                <div className="text-[24px] font-bold text-slate-300 tabular-nums leading-none">
                  {m.v}
                  <span className="text-[12px] font-medium ml-1">{m.u}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-slate-500 mt-4 leading-[1.45]">
            Pomiary obwodów i analiza składu ciała pojawią się po wprowadzeniu sesji pomiarowych — możesz poprosić trenera o ustawienie cyklu co 2 tygodnie.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Zdjęcia przed/po" sub="prywatne · widzi tylko Ty + trener" />
        <PlaceholderEmpty text="Funkcja zdjęć przed/po wkrótce — pomoże wizualnie zobaczyć progres." />
      </Card>
    </>
  );
}

/* ================== STRENGTH ================== */

function StrengthPanel() {
  return (
    <Card>
      <CardHeader title="Siła" sub="moduł trackingu w przygotowaniu" />
      <PlaceholderEmpty
        text="Tracking ćwiczeń (1RM, sety, powtórzenia, Big 3 progress) zostanie odblokowany po włączeniu modułu treningowego przez trenera."
        cta={{ label: "Napisz do trenera", href: "/account/messages" }}
      />
    </Card>
  );
}

/* ================== CARDIO ================== */

function CardioPanel() {
  return (
    <Card>
      <CardHeader title="Cardio" sub="integracja z urządzeniami w przygotowaniu" />
      <PlaceholderEmpty
        text="Synchronizacja z Garmin / Apple Watch i analiza stref tętna pojawi się w jednej z najbliższych aktualizacji."
      />
    </Card>
  );
}

/* ================== GOALS ================== */

function GoalsPanel({ data }: { data: PostepyData }) {
  const active = data.goals.filter((g) => g.pct < 100);
  const achieved = data.goals.filter((g) => g.pct >= 100);
  const avgPct =
    active.length > 0
      ? Math.round(active.reduce((acc, g) => acc + g.pct, 0) / active.length)
      : 0;
  const closestToFinish = [...active].sort((a, b) => b.pct - a.pct)[0] ?? null;

  return (
    <>
      <SummaryStrip
        cards={[
          { label: "Cele aktywne", value: String(active.length), unit: "", detail: `${achieved.length} osiągnięte` },
          { label: "% średnio", value: String(avgPct), unit: "%", detail: avgPct >= 50 ? "na dobrej drodze" : "rozpędzaj się", up: avgPct >= 50 },
          closestToFinish
            ? {
                label: "Najbliższy do mety",
                value: String(closestToFinish.pct),
                unit: "%",
                detail: closestToFinish.title.slice(0, 26),
              }
            : { label: "Najbliższy do mety", value: "—", unit: "", detail: "" },
          { label: "Następna konsult.", value: "—", unit: "", detail: "ustaw z trenerem" },
          { label: "Cele osiągnięte", value: String(achieved.length), unit: "", detail: "od początku" },
        ]}
      />

      {active.length === 0 && achieved.length === 0 ? (
        <Card>
          <PlaceholderEmpty
            text="Nie masz jeszcze ustawionych celów. Najpierw umów konsultację, potem cele wpadną tutaj automatycznie."
            cta={{ label: "Znajdź trenera", href: "/" }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {active.map((g) => (
              <GoalCard key={g.id} g={g} />
            ))}
            <Link
              href="/account/messages"
              className="rounded-[14px] border-2 border-dashed border-slate-200 hover:border-emerald-300 bg-white flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-emerald-700 min-h-[160px] cursor-pointer transition"
            >
              <div className="text-[36px] font-light leading-none">+</div>
              <div className="text-[13px] font-semibold">Nowy cel</div>
              <div className="text-[11px] text-center leading-[1.4] px-4">
                Napisz do trenera, by ustalić cel.
              </div>
            </Link>
          </div>

          {achieved.length > 0 && (
            <Card>
              <CardHeader title="Osiągnięte cele · historia" sub={`${achieved.length} łącznie`} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {achieved.slice(0, 6).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-[10px]"
                  >
                    <span className="text-[22px]">🎯</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 truncate">{g.title}</div>
                      <div className="text-[11px] text-emerald-700">
                        {g.targetDate ? `do ${g.targetDate}` : ""}
                        {g.progressLabel ? ` · ${g.progressLabel}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}

/* ================== SHARED ================== */

function SummaryStrip({
  cards,
}: {
  cards: { label: string; value: string; unit?: string; detail?: string; up?: boolean; down?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3.5">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1">
            {c.label}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-bold tabular-nums tracking-[-0.02em] text-slate-900">{c.value}</span>
            {c.unit && <span className="text-[12px] font-medium text-slate-500">{c.unit}</span>}
          </div>
          {c.detail && (
            <div
              className={
                "text-[11px] mt-0.5 " +
                (c.up
                  ? "text-emerald-700 font-semibold"
                  : c.down
                    ? "text-red-700 font-semibold"
                    : "text-slate-500")
              }
            >
              {c.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModeBanner({ mode, data, weightDelta }: { mode: Mode; data: PostepyData; weightDelta: number | null }) {
  const cls =
    "flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 border ";
  if (mode === "overview") {
    return (
      <div className={cls + "bg-emerald-50 border-emerald-200 text-emerald-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {data.sessionsAllTime > 0
              ? `${data.sessionsAllTime} ${plural(data.sessionsAllTime, "sesja", "sesje", "sesji")} · ${data.streakWeeks > 0 ? `pasmo ${data.streakWeeks} tyg.` : "rozpocznij pasmo"}`
              : "Zarezerwuj pierwszą sesję, by zacząć śledzić postępy"}
          </b>
          <div className="text-emerald-800/80 mt-0.5">
            Wszystkie metryki + cele w jednym miejscu. Wybierz okres na górze, by zmienić zakres.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "body") {
    return (
      <div className={cls + "bg-sky-50 border-sky-200 text-sky-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-sky-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {data.latestWeightKg
              ? weightDelta !== null && weightDelta < 0
                ? `Sylwetka: −${Math.abs(weightDelta).toFixed(1)} kg / 6 mies.`
                : `Sylwetka: ${data.latestWeightKg.toFixed(1)} kg`
              : "Zapisz pierwszy pomiar wagi"}
          </b>
          <div className="text-sky-800/80 mt-0.5">
            Pomiary obwodów i zdjęcia przed/po włączymy w jednej z najbliższych aktualizacji.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "strength") {
    return (
      <div className={cls + "bg-amber-50 border-amber-200 text-amber-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-amber-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6h12" /></svg>
        </span>
        <div>
          <b className="font-semibold">Tracking siły wkrótce</b>
          <div className="text-amber-800/80 mt-0.5">
            Wymaga zaplanowania ćwiczeń przez trenera (1RM, sety, powtórzenia).
          </div>
        </div>
      </div>
    );
  }
  if (mode === "cardio") {
    return (
      <div className={cls + "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-fuchsia-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        </span>
        <div>
          <b className="font-semibold">Cardio &amp; integracja z zegarkami</b>
          <div className="text-fuchsia-800/80 mt-0.5">
            Garmin, Apple Watch, strefy tętna i historia biegów — wkrótce.
          </div>
        </div>
      </div>
    );
  }
  // goals
  const closestToFinish = [...data.goals.filter((g) => g.pct < 100)].sort((a, b) => b.pct - a.pct)[0] ?? null;
  return (
    <div className={cls + "bg-orange-50 border-orange-200 text-orange-900"}>
      <span className="w-7 h-7 rounded-[8px] bg-orange-500 text-white inline-flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
      </span>
      <div>
        <b className="font-semibold">
          {data.goals.length > 0
            ? `${data.goals.filter((g) => g.pct < 100).length} aktywnych${
                closestToFinish ? ` · najbliżej mety: ${closestToFinish.title.slice(0, 30)} (${closestToFinish.pct}%)` : ""
              }`
            : "Brak celów — ustaw pierwszy z trenerem"}
        </b>
        <div className="text-orange-800/80 mt-0.5">
          Cele aktualizują się automatycznie z pomiarów wagi i zakończonych sesji.
        </div>
      </div>
    </div>
  );
}

function PeriodSwitcher({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const items: { id: Period; label: string }[] = [
    { id: "week", label: "Tydz" },
    { id: "month", label: "Mies" },
    { id: "3m", label: "3 mies" },
    { id: "6m", label: "6 mies" },
    { id: "year", label: "Rok" },
    { id: "all", label: "Cały" },
  ];
  return (
    <div className="inline-flex p-[3px] bg-slate-100 rounded-[8px] gap-px text-[11.5px] font-medium">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onChange(i.id)}
          className={
            "px-2.5 py-[5px] rounded-[6px] " +
            (value === i.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-900")
          }
        >
          {i.label}
        </button>
      ))}
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

function GoalRow({ g }: { g: Goal }) {
  const done = g.pct >= 100;
  return (
    <div>
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
}

function GoalCard({ g }: { g: Goal }) {
  const done = g.pct >= 100;
  return (
    <div
      className={
        "rounded-[14px] border bg-white px-5 py-[18px] " +
        (done ? "border-emerald-300 bg-gradient-to-b from-emerald-50/70 to-white" : "border-slate-200")
      }
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <span className="w-[30px] h-[30px] rounded-[8px] bg-emerald-50 inline-flex items-center justify-center text-[16px] shrink-0">
              {emojiForGoal(g.title)}
            </span>
            <span className="truncate">{g.title}</span>
          </div>
          {g.targetDate && (
            <div className="text-[11.5px] text-slate-500 mt-1 pl-[38px]">do {g.targetDate}</div>
          )}
        </div>
        <div className="text-[28px] font-bold text-emerald-700 tabular-nums tracking-[-0.025em]">
          {g.pct}%{done && <span className="text-[14px] text-emerald-700"> ✓</span>}
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
          style={{ width: `${Math.min(100, g.pct)}%` }}
        />
      </div>
      {g.progressLabel && (
        <div className="text-[11.5px] text-slate-500">{g.progressLabel}</div>
      )}
    </div>
  );
}

function PlaceholderEmpty({ text, cta }: { text: string; cta?: { label: string; href: string } }) {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-slate-200 py-10 px-6 text-center">
      <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[420px] mx-auto">{text}</p>
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
  if (id === "overview")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
      </svg>
    );
  if (id === "body")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M5 8l7-6 7 6" />
      </svg>
    );
  if (id === "strength")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 6h12M3 12h18M6 18h12" />
      </svg>
    );
  if (id === "cardio")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/* ================== CHARTS ================== */

function WeightChart({ series, target }: { series: { iso: string; kg: number }[]; target: number | null }) {
  const W = 700, H = 240, INS = 40;
  const t0 = new Date(series[0].iso).getTime();
  const tN = new Date(series[series.length - 1].iso).getTime();
  const span = Math.max(1, tN - t0);
  const minK = Math.min(...series.map((p) => p.kg), target ?? Infinity);
  const maxK = Math.max(...series.map((p) => p.kg), target ?? -Infinity);
  const range = Math.max(0.5, maxK - minK);
  const yFor = (kg: number) => H - 40 - ((kg - minK) / range) * (H - 80);
  const xFor = (iso: string) => INS + ((new Date(iso).getTime() - t0) / span) * (W - INS - 20);

  const points = series.map((p) => `${xFor(p.iso).toFixed(1)},${yFor(p.kg).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const lastX = xFor(last.iso);
  const lastY = yFor(last.kg);
  const targetY = target != null ? yFor(target) : null;

  // Y-axis labels: top, middle, bottom of range.
  const ticks = [maxK, minK + range / 2, minK];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]" preserveAspectRatio="none">
      {ticks.map((tv, i) => {
        const y = yFor(tv);
        return (
          <g key={i}>
            <line x1={INS} x2={W - 20} y1={y} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
            <text x={20} y={y + 4} fontSize="9" fill="#94a3b8">
              {tv.toFixed(1)}
            </text>
          </g>
        );
      })}
      {targetY != null && (
        <>
          <line x1={INS} x2={W - 20} y1={targetY} y2={targetY} stroke="#0ea5e9" strokeDasharray="6 4" strokeWidth="1.5" />
          <text x={W - 24} y={targetY - 4} fontSize="10" fill="#0c4a6e" textAnchor="end" fontWeight="600">
            Cel: {target!.toFixed(1)} kg
          </text>
        </>
      )}
      <defs>
        <linearGradient id="weightGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {series.map((p) => (
        <circle key={p.iso} cx={xFor(p.iso)} cy={yFor(p.kg)} r="3" fill="#10b981" />
      ))}
      <circle cx={lastX} cy={lastY} r="4.5" stroke="white" strokeWidth="2" fill="#10b981" />
      <text x={lastX} y={lastY - 10} fontSize="11" fontWeight="700" fill="#047857" textAnchor="end">
        {last.kg.toFixed(1)} kg
      </text>
    </svg>
  );
}

function ActivityRings({ data }: { data: PostepyData }) {
  const sessPct = data.weekSessionsTarget > 0 ? Math.min(100, (data.weekSessionsDone / data.weekSessionsTarget) * 100) : 0;
  const minPct = data.weekMinutesTarget > 0 ? Math.min(100, (data.weekMinutesDone / data.weekMinutesTarget) * 100) : 0;
  // Calories — derived rough estimate: 8 kcal/min strength avg → use minutes × 8.
  const calDone = Math.round(data.weekMinutesDone * 8);
  const calTarget = data.weekMinutesTarget > 0 ? Math.round(data.weekMinutesTarget * 8) : 1500;
  const calPct = Math.min(100, (calDone / calTarget) * 100);

  const ring = (r: number, color: string, bg: string, pct: number) => {
    const C = 2 * Math.PI * r;
    return (
      <>
        <circle cx="60" cy="60" r={r} fill="none" stroke={bg} strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${C}`}
          strokeDashoffset={`${C - (C * pct) / 100}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </>
    );
  };

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-[200px] h-[200px] shrink-0">
        {ring(50, "#ef4444", "#fee2e2", calPct)}
        {ring(38, "#f59e0b", "#fef3c7", minPct)}
        {ring(26, "#10b981", "#d1fae5", sessPct)}
      </svg>
      <div className="flex-1 flex flex-col gap-3.5">
        <RingRow color="#10b981" bg="#10b981" label="Sesje" v={`${data.weekSessionsDone} / ${data.weekSessionsTarget}`} pct={sessPct} />
        <RingRow color="#f59e0b" bg="#f59e0b" label="Minuty" v={`${data.weekMinutesDone} / ${data.weekMinutesTarget}`} pct={minPct} />
        <RingRow color="#ef4444" bg="#ef4444" label="Kalorie (est)" v={`${calDone} / ${calTarget}`} pct={calPct} />
        <div className="pt-3 border-t border-dashed border-slate-200">
          <div className="flex justify-between items-baseline">
            <span className="text-[12.5px] text-slate-700 font-medium inline-flex items-center gap-2">
              🔥 Pasmo
            </span>
            <span className="text-[16px] font-bold text-slate-900">{data.streakWeeks} tyg.</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {data.streakWeeks > 0 ? `Aktualne pasmo: ${data.streakWeeks} ${plural(data.streakWeeks, "tydzień", "tygodnie", "tygodni")}` : "Zacznij dziś — i utrzymaj rytm."}
          </div>
        </div>
      </div>
    </div>
  );
}

function RingRow({ color, label, v, pct }: { color: string; bg: string; label: string; v: string; pct: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[12.5px] text-slate-700 font-medium inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
          {label}
        </span>
        <span className="text-[14px] font-bold text-slate-900 tabular-nums">{v}</span>
      </div>
      <div className="h-[5px] bg-slate-100 rounded-[3px] overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ================== ACHIEVEMENTS ================== */

function Achievements({ data }: { data: PostepyData }) {
  const list = computeAchievements(data);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {list.map((a) => (
        <div
          key={a.name}
          className={
            "px-3 py-3.5 rounded-[11px] border text-center bg-white " +
            (a.unlocked
              ? "border-amber-200 bg-gradient-to-b from-amber-50 to-white"
              : "border-slate-200 opacity-60")
          }
        >
          <div className="text-[32px] mb-1.5 leading-none">{a.icon}</div>
          <div className="text-[11.5px] font-bold text-slate-900">{a.name}</div>
          <div className="text-[10.5px] text-slate-500 mt-0.5">{a.detail}</div>
          {a.unlocked && a.when && (
            <div className="text-[10px] text-emerald-700 font-semibold mt-1">{a.when}</div>
          )}
        </div>
      ))}
    </div>
  );
}

type Achievement = { name: string; detail: string; icon: string; unlocked: boolean; when?: string };

function computeAchievements(data: PostepyData): Achievement[] {
  const list: Achievement[] = [
    {
      name: "Pierwsza sesja",
      detail: "Start przygody",
      icon: "🎬",
      unlocked: data.sessionsAllTime >= 1,
      when: data.sessionsAllTime >= 1 ? "ukończona" : undefined,
    },
    {
      name: "Pasmo 4 tyg.",
      detail: "4 tyg. z rzędu",
      icon: "🔥",
      unlocked: data.streakWeeks >= 4,
      when: data.streakWeeks >= 4 ? "aktualne" : undefined,
    },
    {
      name: "10 sesji",
      detail: "Konsystencja",
      icon: "💪",
      unlocked: data.sessionsAllTime >= 10,
    },
    {
      name: "25 sesji",
      detail: "Ćwierćwiecze",
      icon: "🏆",
      unlocked: data.sessionsAllTime >= 25,
    },
    {
      name: "Cel osiągnięty",
      detail: "Pierwsze 100%",
      icon: "🎯",
      unlocked: data.achievedGoals.length >= 1,
    },
    {
      name: "Pierwszy pomiar",
      detail: "Dziennik wagi",
      icon: "📈",
      unlocked: data.weightSeries.length >= 1,
    },
    {
      name: "Stały rytm",
      detail: "Pasmo 8 tyg.",
      icon: "⚡",
      unlocked: data.streakWeeks >= 8,
    },
    {
      name: "100 sesji",
      detail: "Stulecie",
      icon: "💎",
      unlocked: data.sessionsAllTime >= 100,
    },
  ];
  return list;
}

function achievementCount(data: PostepyData): string {
  const list = computeAchievements(data);
  const u = list.filter((a) => a.unlocked).length;
  return `${u} z ${list.length}`;
}

/* ================== HELPERS ================== */

function emojiForGoal(title: string): string {
  const t = title.toLowerCase();
  if (/schud|kilogram|kg|waga|odchudz/.test(t)) return "🎯";
  if (/squat|przysiad|martwy|deadlift|wyciska|bench|siła/.test(t)) return "💪";
  if (/bieg|km|cardio|run/.test(t)) return "🏃";
  if (/sesj|treningi/.test(t)) return "📅";
  if (/woda|hydratac/.test(t)) return "💧";
  return "🏁";
}

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function subtitleFor(mode: Mode, data: PostepyData, weightDelta: number | null): string {
  if (mode === "overview") {
    const parts: string[] = [];
    if (data.monthsCoaching) parts.push(`${data.monthsCoaching} mies. trening.`);
    if (data.primaryTrainerName) parts.push(`z ${data.primaryTrainerName}`);
    if (weightDelta !== null) parts.push(`${weightDelta < 0 ? "−" : "+"}${Math.abs(weightDelta).toFixed(1)} kg`);
    if (data.streakWeeks > 0) parts.push(`pasmo ${data.streakWeeks} tyg.`);
    parts.push(`${data.goals.filter((g) => g.pct < 100).length} cele aktywne`);
    return parts.join(" · ");
  }
  if (mode === "body") {
    if (!data.latestWeightKg) return "Zapisz pierwszy pomiar wagi, by zacząć śledzić sylwetkę.";
    return `Waga ${data.latestWeightKg.toFixed(1)} kg${weightDelta !== null ? ` (${weightDelta < 0 ? "−" : "+"}${Math.abs(weightDelta).toFixed(1)})` : ""}`;
  }
  if (mode === "strength") return "Tracking siły · wymaga włączenia przez trenera";
  if (mode === "cardio") return "Cardio · integracja z urządzeniami w przygotowaniu";
  return `${data.goals.filter((g) => g.pct < 100).length} cele aktywne · ${data.achievedGoals.length} osiągniętych`;
}

/* ================== LOG WEIGHT BUTTON ================== */

function LogWeightButton({ latest }: { latest: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(latest != null ? String(latest).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Niepoprawna waga.");
      return;
    }
    startTransition(async () => {
      const res = await logWeight({ weightKg: n });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
      >
        + Dodaj pomiar
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="inline-flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="np. 77,6"
        className="w-24 h-9 px-2.5 rounded-[8px] border border-slate-300 bg-white text-[13px] text-slate-900 outline-none focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10"
      />
      <span className="text-[11.5px] text-slate-500">kg</span>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-3 rounded-[8px] bg-emerald-500 text-white text-[12.5px] font-semibold hover:bg-emerald-600 disabled:opacity-60"
      >
        {pending ? "..." : "Zapisz"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="text-[11.5px] text-slate-500 hover:text-slate-700"
      >
        Anuluj
      </button>
      {error && <span className="text-[11.5px] text-rose-600 ml-1">{error}</span>}
    </form>
  );
}
