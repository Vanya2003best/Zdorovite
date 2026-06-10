import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/db/goals";
import { getWeightLog } from "@/lib/db/weight";
import Postepy, {
  type PostepyData,
  type Goal as ViewGoal,
  type TrainerNote,
} from "./Postepy";

const PL_MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

const DONE_STATUSES = ["completed", "paid"];

/**
 * /account/progress — Postępy (design 37).
 *
 * Server orchestrator: pulls weight log, goals, and bookings to compute
 * the streak / sessions all-time / months-coaching headlines. Pushes
 * everything to <Postepy/>, which handles the 5-mode UI. Modes that
 * need data we don't have yet (strength tracking, cardio integration,
 * body measurements, photos, trainer notes shared with client) render
 * honest empty states inside the client component.
 */
export default async function ProgressPage() {
  const { user } = await requireClient("/account/progress");
  const supabase = await createClient();

  const [goalsRaw, weightLog, { data: bookingsRaw }] = await Promise.all([
    getGoals(user.id),
    getWeightLog(user.id, 200),
    supabase
      .from("bookings")
      .select(
        `
        id, trainer_id, start_time, end_time, status, service_duration,
        service:services ( duration ),
        trainer:trainers ( profile:profiles!id ( display_name ) )
      `,
      )
      .eq("client_id", user.id)
      .order("start_time", { ascending: true }),
  ]);

  const bookings = (bookingsRaw ?? []) as unknown as Array<{
    id: string;
    trainer_id: string;
    start_time: string;
    end_time: string;
    status: string;
    service_duration: number | null;
    service: { duration: number } | null;
    trainer: { profile: { display_name: string | null } | null } | null;
  }>;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);

  // Weight series + 6-month-ago anchor.
  const weightSeries = weightLog.map((p) => ({ iso: p.recordedAt, kg: p.weightKg }));
  const latestWeightKg = weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].kg : null;
  const weightSixMonthsAgoKg = (() => {
    if (weightSeries.length < 2) return null;
    const earlier = weightSeries.find((p) => new Date(p.iso) >= sixMonthsAgo);
    if (earlier && earlier !== weightSeries[weightSeries.length - 1]) return earlier.kg;
    // Fallback to the oldest point if none past 6mo cutoff.
    return weightSeries[0].kg !== latestWeightKg ? weightSeries[0].kg : null;
  })();

  // Try to detect a weight target (e.g. "Schudnąć 5 kg") so we can
  // render the dashed target line on the chart.
  let weightTargetKg: number | null = null;
  for (const g of goalsRaw) {
    const m = g.title.match(/(?:schud|cel|target).{0,20}?(\d{1,3}(?:[.,]\d)?)\s*kg/i);
    if (m && latestWeightKg) {
      const lose = parseFloat(m[1].replace(",", "."));
      // Only treat it as a "loss target" if the goal title clearly indicates loss.
      if (/schud|odchud|lose/i.test(g.title)) {
        weightTargetKg = Math.max(40, latestWeightKg - lose + lose * (1 - g.pct / 100));
      }
    }
  }

  // Sessions all-time + months coaching.
  const completed = bookings.filter((b) => DONE_STATUSES.includes(b.status) || (b.status === "confirmed" && new Date(b.end_time) < now));
  const sessionsAllTime = completed.length;
  const firstBookingDate = bookings[0] ? new Date(bookings[0].start_time) : null;
  const monthsCoaching = firstBookingDate
    ? Math.max(0, Math.round(((now.getTime() - firstBookingDate.getTime()) / 86_400_000) / 30))
    : 0;

  // Streak — consecutive past weeks with at least one completed session.
  const weekStart = mondayOf(now);
  let streakWeeks = 0;
  for (let i = 0; i < 26; i++) {
    const ws = mondayOf(new Date(weekStart.getTime() - i * 7 * 86_400_000));
    const we = new Date(ws.getTime() + 7 * 86_400_000);
    const has = completed.some((b) => {
      const t = new Date(b.start_time).getTime();
      return t >= ws.getTime() && t < we.getTime();
    });
    if (has) streakWeeks += 1;
    else break;
  }

  // This-week metrics — sessions done + minutes done.
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const weekDayCounts = Array.from({ length: 7 }, () => 0);
  let weekSessionsDone = 0;
  let weekMinutesDone = 0;
  for (const b of completed) {
    const t = new Date(b.start_time);
    if (t >= weekStart && t < weekEnd) {
      const dayIdx = (t.getDay() + 6) % 7;
      weekDayCounts[dayIdx] += 1;
      weekSessionsDone += 1;
      weekMinutesDone += b.service_duration ?? b.service?.duration ?? 60;
    }
  }
  // Targets — heuristic. Pick the target as max(this-week, average of last
  // 4 weeks) clamped to 2..6 sessions and 60..360 minutes. This keeps the
  // ring "achievable but not trivial" without a separate goal column.
  const last4WeeksSessions = (() => {
    let count = 0;
    for (const b of completed) {
      const t = new Date(b.start_time).getTime();
      if (t >= now.getTime() - 28 * 86_400_000) count += 1;
    }
    return count;
  })();
  const avgWeek = Math.round(last4WeeksSessions / 4) || 2;
  const weekSessionsTarget = Math.min(6, Math.max(2, Math.max(avgWeek, weekSessionsDone)));
  const weekMinutesTarget = Math.min(360, Math.max(60, weekSessionsTarget * 60));

  // Primary trainer.
  const trainerCount = new Map<string, number>();
  for (const b of bookings) trainerCount.set(b.trainer_id, (trainerCount.get(b.trainer_id) ?? 0) + 1);
  const primaryTrainerId = Array.from(trainerCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const primaryRow = primaryTrainerId ? bookings.find((b) => b.trainer_id === primaryTrainerId) : null;
  const primaryTrainerName = primaryRow?.trainer?.profile?.display_name?.split(" ")[0] ?? null;

  // Goals — split active vs achieved, format progress label + target date.
  // getGoals returns pct as 0..1 (direction-agnostic); convert to 0..100.
  const allGoals: ViewGoal[] = goalsRaw.map((g) => ({
    id: g.id,
    title: g.title,
    pct: Math.max(0, Math.min(100, Math.round(g.pct * 100))),
    targetDate: g.targetDate ? formatGoalDate(g.targetDate) : null,
    progressLabel: buildProgressLabel(g),
  }));
  const activeGoals = allGoals.filter((g) => g.pct < 100);
  const achievedGoals = allGoals.filter((g) => g.pct >= 100);

  // Trainer notes shared with client — currently we don't have a
  // "share with client" flag on bookings.session_notes (it's marked
  // trainer-private in migration 025). Leave empty until that feature
  // ships. UI shows an honest empty state.
  const trainerNotes: TrainerNote[] = [];

  const data: PostepyData = {
    latestWeightKg,
    weightSixMonthsAgoKg,
    weightSeries,
    weightTargetKg,
    weekDayCounts,
    weekSessionsDone,
    weekSessionsTarget,
    weekMinutesDone,
    weekMinutesTarget,
    goals: activeGoals.concat(achievedGoals),
    achievedGoals,
    trainerNotes,
    streakWeeks,
    monthsCoaching,
    sessionsAllTime,
    primaryTrainerName,
  };

  return <Postepy data={data} />;
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  const offset = (dow + 6) % 7;
  r.setDate(r.getDate() - offset);
  return r;
}

function formatGoalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${PL_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function buildProgressLabel(g: {
  currentValue: number;
  targetValue: number;
  startValue: number;
  unit: string | null;
  pct: number;
}): string | null {
  if (g.pct >= 1) return "✓ Osiągnięty";
  if (Number.isFinite(g.currentValue) && Number.isFinite(g.targetValue)) {
    const cur = Number(g.currentValue);
    const tgt = Number(g.targetValue);
    const u = g.unit ? ` ${g.unit}` : "";
    return `${cur}${u} / ${tgt}${u}`;
  }
  return null;
}
