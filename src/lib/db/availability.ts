import { createClient } from "@/lib/supabase/server";
import {
  timeToMinutes,
  warsawDayOfWeek,
  warsawLocalToIso,
  type Slot,
} from "@/lib/time";

const DEFAULT_SLOT_MINUTES = 60;

export type { Slot };

/**
 * Slots for a trainer on a specific Warsaw-local date.
 * Slots that overlap an existing non-cancelled booking are marked available=false.
 */
export async function getAvailableSlots(
  trainerId: string,
  date: string,
  slotMinutes: number = DEFAULT_SLOT_MINUTES,
): Promise<Slot[]> {
  const supabase = await createClient();
  const dow = warsawDayOfWeek(date);

  const { data: rules, error: rulesErr } = await supabase
    .from("availability_rules")
    .select("start_time, end_time")
    .eq("trainer_id", trainerId)
    .eq("day_of_week", dow);
  if (rulesErr) throw rulesErr;
  if (!rules || rules.length === 0) return [];

  const dayStartIso = warsawLocalToIso(date, 0);
  const dayEndIso = warsawLocalToIso(date, 24 * 60);
  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select("start_time, end_time, status")
    .eq("trainer_id", trainerId)
    .in("status", ["pending", "paid", "confirmed"])
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);
  if (bookErr) throw bookErr;

  const slots: Slot[] = [];
  const overlaps = (startMin: number, endMin: number) => {
    const startIso = warsawLocalToIso(date, startMin);
    const endIso = warsawLocalToIso(date, endMin);
    return (bookings ?? []).some((b) => b.start_time < endIso && b.end_time > startIso);
  };

  for (const rule of rules) {
    const startMin = timeToMinutes(rule.start_time);
    const endMin = timeToMinutes(rule.end_time);
    for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push({
        startIso: warsawLocalToIso(date, m),
        label: `${hh}:${mm}`,
        available: !overlaps(m, m + slotMinutes),
      });
    }
  }

  // Drop slots that start in the past (e.g. browsing today at 15:00 — hide 08-15 slots)
  const nowIso = new Date().toISOString();
  return slots.filter((s) => s.startIso > nowIso);
}
