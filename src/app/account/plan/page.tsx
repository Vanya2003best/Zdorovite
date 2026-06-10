import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/db/goals";
import MojPlan, { type MojPlanData, type WeekDayPlan, type PlanSession } from "./MojPlan";

const PL_DAY_SHORT = ["NIE", "PON", "WT", "ŚR", "CZW", "PT", "SOB"];
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
 * /account/plan — Mój plan (design 38).
 *
 * The plan domain (16-week periodization, exercise library, diet plans,
 * supplements) needs its own schema stack. Until that ships, the page
 * pulls real bookings to populate the "Bieżący tydzień" grid + builds a
 * minimal plan-header from the most-frequent trainer's name + the active
 * package count. Other modes show honest empty states.
 */
export default async function PlanPage() {
  const { user } = await requireClient("/account/plan");
  const supabase = await createClient();

  const now = new Date();
  const weekStart = mondayOf(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [{ data: bookingsRaw }, goalsRaw] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `
        id, trainer_id, start_time, end_time, status,
        service_name, package_id, package_name,
        service:services ( name, duration ),
        package:packages ( name, sessions_total ),
        trainer:trainers ( slug, profile:profiles!id ( display_name ) )
      `,
      )
      .eq("client_id", user.id)
      .order("start_time", { ascending: true }),
    getGoals(user.id),
  ]);

  const bookings = (bookingsRaw ?? []) as unknown as Array<{
    id: string;
    trainer_id: string;
    start_time: string;
    end_time: string;
    status: string;
    service_name: string | null;
    package_id: string | null;
    package_name: string | null;
    service: { name: string; duration: number } | null;
    package: { name: string; sessions_total: number | null } | null;
    trainer: { slug: string; profile: { display_name: string | null } | null } | null;
  }>;

  // 7-day grid with sessions mapped to days.
  const weekDays: WeekDayPlan[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 86_400_000);
    const same = (b: { start_time: string }) => {
      const t = new Date(b.start_time);
      return (
        t.getFullYear() === d.getFullYear() &&
        t.getMonth() === d.getMonth() &&
        t.getDate() === d.getDate()
      );
    };
    const sessions: PlanSession[] = bookings
      .filter((b) => same(b) && b.status !== "cancelled")
      .map((b) => mapBookingToSession(b));
    return {
      iso: d.toISOString(),
      shortName: PL_DAY_SHORT[d.getDay()],
      dayNum: d.getDate(),
      isToday:
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate(),
      isPast: d < new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      sessions,
    };
  });

  const todayDay = weekDays.find((d) => d.isToday) ?? null;
  const todaySession = todayDay?.sessions[0] ?? null;

  // Plan header — synthesize from active package (if any) and overall
  // session counts. When the trainer-side plan-builder ships, this will
  // be replaced with a real `training_plans` row.
  const activePackage = (() => {
    const groups = new Map<string, { name: string; done: number; total: number | null }>();
    for (const b of bookings) {
      if (!b.package_id || !b.package) continue;
      const existing = groups.get(b.package_id);
      if (existing) {
        if (DONE_STATUSES.includes(b.status)) existing.done += 1;
      } else {
        groups.set(b.package_id, {
          name: b.package.name,
          done: DONE_STATUSES.includes(b.status) ? 1 : 0,
          total: b.package.sessions_total,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.done - a.done)[0] ?? null;
  })();

  // Find next upcoming session for the header tile.
  const nextRow = bookings.find(
    (b) => new Date(b.start_time) > now && b.status !== "cancelled",
  );

  const trainerCount = new Map<string, number>();
  for (const b of bookings) trainerCount.set(b.trainer_id, (trainerCount.get(b.trainer_id) ?? 0) + 1);
  const primaryTrainerId = Array.from(trainerCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const primaryRow = primaryTrainerId ? bookings.find((b) => b.trainer_id === primaryTrainerId) : null;
  const primaryTrainerName = primaryRow?.trainer?.profile?.display_name?.split(" ")[0] ?? null;

  const data: MojPlanData = {
    primaryTrainerName,
    primaryTrainerId,
    weekStartLabel: `${weekStart.getDate()}–${new Date(weekEnd.getTime() - 86_400_000).getDate()} ${PL_MONTHS[weekStart.getMonth()]}`,
    weekDays,
    todaySession,
    activePlan: activePackage
      ? {
          name: activePackage.name,
          description: activePackage.total
            ? `Pakiet ${activePackage.total}-sesyjny${primaryTrainerName ? ` z trenerem ${primaryTrainerName}` : ""}. Pełny plan treningowy (periodyzacja, ćwiczenia, dieta) wkrótce.`
            : "Aktywna współpraca z trenerem. Pełny plan treningowy wkrótce.",
          status: "aktywny",
          pct: activePackage.total ? Math.round((activePackage.done / activePackage.total) * 100) : 0,
          weekNum: activePackage.done > 0 ? activePackage.done : null,
          weekTotal: activePackage.total,
          nextSessionLabel: nextRow ? relativeDayLabel(nextRow.start_time) : null,
          nextSessionDetail: nextRow
            ? `${formatTime(nextRow.start_time)} · ${nextRow.service_name ?? nextRow.service?.name ?? "Sesja"}`
            : null,
        }
      : null,
    goals: goalsRaw.map((g) => ({
      title: g.title,
      pct: Math.max(0, Math.min(100, Math.round(g.pct * 100))),
      progressLabel:
        Number.isFinite(g.currentValue) && Number.isFinite(g.targetValue)
          ? `${g.currentValue}${g.unit ? ` ${g.unit}` : ""} / ${g.targetValue}${g.unit ? ` ${g.unit}` : ""}`
          : null,
    })),
  };

  return <MojPlan data={data} />;
}

function mapBookingToSession(b: {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  service_name: string | null;
  service: { name: string; duration: number } | null;
  trainer: { slug: string; profile: { display_name: string | null } | null } | null;
}): PlanSession {
  const name = b.service_name ?? b.service?.name ?? "Sesja";
  const lower = name.toLowerCase();
  let kind: PlanSession["kind"] = "train";
  if (/cardio|outdoor|bieg|rower|run/.test(lower)) kind = "cardio";
  else if (/mobil|stretch|joga|rolka/.test(lower)) kind = "mob";
  else if (/odpoczynek|rest|wolne/.test(lower)) kind = "rest";

  const dur = b.service?.duration ?? 60;
  return {
    id: b.id,
    kind,
    name,
    detail: `${formatTime(b.start_time)} · ${dur} min`,
    done: DONE_STATUSES.includes(b.status) || (b.status === "confirmed" && new Date(b.end_time) < new Date()),
    startTime: formatTime(b.start_time),
    trainerSlug: b.trainer?.slug ?? null,
    trainerId: b.trainer_id,
  };
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  const offset = (dow + 6) % 7;
  r.setDate(r.getDate() - offset);
  return r;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function relativeDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);
  if (diffDays === 0) return "Dziś";
  if (diffDays === 1) return "Jutro";
  if (diffDays > 0 && diffDays < 7) {
    const wd = d.toLocaleDateString("pl-PL", { weekday: "long" });
    return wd.charAt(0).toUpperCase() + wd.slice(1);
  }
  return `${d.getDate()} ${PL_MONTHS[d.getMonth()].slice(0, 3)}`;
}
