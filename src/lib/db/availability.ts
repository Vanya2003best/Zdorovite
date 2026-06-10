import { createClient } from "@/lib/supabase/server";
import {
  timeToMinutes,
  warsawDayOfWeek,
  warsawLocalToIso,
  type Slot,
} from "@/lib/time";
import { getEffectiveAvailability } from "./availability-overrides";

const DEFAULT_SLOT_MINUTES = 60;

export type { Slot };

/**
 * Slots for a trainer on a specific Warsaw-local date.
 * Slots that overlap an existing non-cancelled booking are marked available=false.
 *
 * Resolution: per-date overrides (`availability_overrides`) take precedence
 * over the recurring weekly pattern. If the trainer marked a date closed,
 * we return [] regardless of what the recurring rule says.
 */
export async function getAvailableSlots(
  trainerId: string,
  date: string,
  slotMinutes: number = DEFAULT_SLOT_MINUTES,
): Promise<Slot[]> {
  const supabase = await createClient();

  // Effective availability merges per-date overrides on top of the weekly
  // pattern — single source of truth so booking-side and calendar render
  // can never disagree on "is this trainer free on YYYY-MM-DD?".
  const shifts = await getEffectiveAvailability(trainerId, date);
  if (shifts.length === 0) {
    // Defensive: still surface dow-based intent even on bare schemas where
    // overrides table doesn't exist. getEffectiveAvailability already does
    // that fallback, so [] here means "trainer truly closed this date".
    void warsawDayOfWeek; // keep import in scope; helper used elsewhere
    return [];
  }

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

  for (const shift of shifts) {
    const startMin = timeToMinutes(shift.start);
    const endMin = timeToMinutes(shift.end);
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
