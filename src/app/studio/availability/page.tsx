import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AvailabilityClient from "./AvailabilityClient";

export type DayRule = { start: string; end: string };

/**
 * /studio/availability — design 31 implementation. Status bar +
 * weekly pattern + visual timeline preview + booking-rules grid +
 * side rail (mini-cal / tip / locations / notifications). Multi-
 * window per day is a future enhancement (current schema:
 * availability_rules, one rule per dow); the UI is shaped so it
 * can carry multiple windows once a migration adds row position.
 *
 * Scope of what's wired vs visual:
 *   WIRED — weekly pattern rows save via existing
 *           saveAvailabilityRules action; status-bar 'hours/week'
 *           and 'fill rate' come from real data.
 *   VISUAL — exceptions list, booking rules grid, locations,
 *            notifications & auto, mini-calendar markers, sticky
 *            save bar. These need their own migrations + actions
 *            in a follow-up; the UI is rendered with seed values.
 */
export default async function AvailabilityDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/availability");

  const [{ data: rules }, { data: trainer }, { count: weekBookings }, { count: monthBookings }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time")
      .eq("trainer_id", user.id),
    supabase.from("trainers").select("published, slug").eq("id", user.id).maybeSingle(),
    // Week & month bookings as a quick fill-rate proxy. RLS-safe
    // because trainer_id filter is enforced.
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .gte("start_time", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .gte("start_time", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  // Map dow → first rule. Multi-window goes through this same shape
  // once schema supports it (would become DayRule[] per dow).
  const byDow: Record<number, DayRule | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  };
  (rules ?? []).forEach((r) => {
    byDow[r.day_of_week] = {
      start: String(r.start_time).slice(0, 5),
      end: String(r.end_time).slice(0, 5),
    };
  });

  // Total weekly hours from active rules — KPI in the status bar.
  const weeklyHours = Object.values(byDow).reduce((acc, r) => {
    if (!r) return acc;
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    return acc + Math.max(0, eh + em / 60 - (sh + sm / 60));
  }, 0);

  // Active days that aren't Sunday — matches the design's "pn–sb"
  // copy so the user knows which set of days the hours cover.
  const activeDays = Object.entries(byDow)
    .filter(([, r]) => r !== null)
    .map(([d]) => Number(d));
  const dayShortNames = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
  const daysSpan =
    activeDays.length === 0
      ? "—"
      : `${dayShortNames[Math.min(...activeDays)]}–${dayShortNames[Math.max(...activeDays)]}`;

  // Crude free-slot estimate: weekly hours × 2 (assuming 30-min
  // grid) × 2 weeks − bookings in last 7 days. Just a directional
  // KPI; real wiring would query availability + bookings overlap.
  const estimatedSlots14d = Math.max(0, Math.round(weeklyHours * 2 * 2 - (weekBookings ?? 0)));

  // Rough fill-rate proxy: monthly bookings vs. theoretical
  // monthly slot capacity. Cap at 99% so a trainer with hardly any
  // hours doesn't read 200%.
  const monthlyCapacity = Math.max(1, weeklyHours * 4);
  const fillRate = Math.min(99, Math.round(((monthBookings ?? 0) / monthlyCapacity) * 100));

  return (
    <AvailabilityClient
      initialByDow={byDow}
      published={!!trainer?.published}
      weeklyHours={weeklyHours}
      daysSpan={daysSpan}
      estimatedSlots14d={estimatedSlots14d}
      fillRate={fillRate}
      slug={trainer?.slug ?? null}
    />
  );
}
