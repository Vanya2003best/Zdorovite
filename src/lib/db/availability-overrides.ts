import { createClient } from "@/lib/supabase/server";

export type AvailabilityOverride = {
  /** YYYY-MM-DD (Warsaw-local calendar date the override applies to). */
  date: string;
  /** "HH:MM" — for closed-day rows the trainer never sees these. */
  start: string;
  end: string | null;
  /** True → the trainer is closed that date entirely. end is then null. */
  isClosed: boolean;
  /** Optional human-readable label ("Urlop", "Konferencja", etc.). */
  reason: string | null;
};

type RawRow = {
  date: string;
  start_time: string;
  end_time: string | null;
  is_closed: boolean;
  reason: string | null;
};

function mapRow(r: RawRow): AvailabilityOverride {
  return {
    date: r.date,
    start: String(r.start_time).slice(0, 5),
    end: r.end_time ? String(r.end_time).slice(0, 5) : null,
    isClosed: r.is_closed,
    reason: r.reason,
  };
}

/**
 * Fetch all overrides for a trainer in [fromDate, toDate). Both dates are
 * inclusive of `from` and exclusive of `to`, in Warsaw-local YYYY-MM-DD.
 * Used by the calendar week-view to overlay exceptions on top of the
 * recurring availability_rules.
 */
export async function getAvailabilityOverridesInRange(
  trainerId: string,
  fromDate: string,
  toDate: string,
): Promise<AvailabilityOverride[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("availability_overrides")
      .select("date, start_time, end_time, is_closed, reason")
      .eq("trainer_id", trainerId)
      .gte("date", fromDate)
      .lt("date", toDate)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    // Any error here (missing table, RLS rejection, etc.) → fall back to
    // empty so the calendar still renders the recurring schedule. This
    // is a soft feature: when migration 030 isn't applied yet the rest
    // of the app must keep working.
    if (error) return [];
    return ((data ?? []) as unknown as RawRow[]).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Pull all overrides for a single date. Empty array means "no exception
 * for this date — fall back to the recurring availability_rules row".
 */
export async function getAvailabilityOverridesForDate(
  trainerId: string,
  date: string,
): Promise<AvailabilityOverride[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("availability_overrides")
      .select("date, start_time, end_time, is_closed, reason")
      .eq("trainer_id", trainerId)
      .eq("date", date)
      .order("start_time", { ascending: true });
    if (error) return [];
    return ((data ?? []) as unknown as RawRow[]).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Resolves the EFFECTIVE working hours for a single date, applying overrides
 * on top of the recurring weekly pattern. Returns either:
 *   - [] when the trainer is unavailable (rule says nothing OR override
 *     marks the date closed)
 *   - one or more {start, end} shifts for the date
 *
 * This is the single source of truth callers should use when they need to
 * know "what hours does this trainer work on YYYY-MM-DD?".
 */
export async function getEffectiveAvailability(
  trainerId: string,
  date: string,
): Promise<{ start: string; end: string }[]> {
  // Override layer first — short-circuits the recurring rule when present.
  const overrides = await getAvailabilityOverridesForDate(trainerId, date);
  if (overrides.length > 0) {
    if (overrides.some((o) => o.isClosed)) return [];
    return overrides
      .filter((o) => !o.isClosed && o.end != null)
      .map((o) => ({ start: o.start, end: o.end as string }));
  }

  // Fall back to recurring weekly rule for this date's day-of-week.
  try {
    const supabase = await createClient();
    const dow = new Date(`${date}T00:00:00`).getDay();
    const { data: rules, error } = await supabase
      .from("availability_rules")
      .select("start_time, end_time")
      .eq("trainer_id", trainerId)
      .eq("day_of_week", dow);
    if (error) return [];
    return (rules ?? []).map((r) => ({
      start: String(r.start_time).slice(0, 5),
      end: String(r.end_time).slice(0, 5),
    }));
  } catch {
    return [];
  }
}
