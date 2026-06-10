import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingRescheduleMap } from "@/lib/db/reschedule";
import { getAvailabilityOverridesInRange } from "@/lib/db/availability-overrides";
import CalendarClient, {
  type BookingEvent,
  type DateOverrideRow,
  type WorkingHourRule,
} from "./CalendarClient";

/**
 * /studio/calendar — read-only Google-Calendar-style view of the trainer's
 * schedule. Two layers:
 *   • Working hours (background fill) — derived from availability_rules,
 *     shown as a soft emerald wash on each day's open hours so trainer can
 *     visually verify their week.
 *   • Bookings (foreground events) — rows from `bookings` for this trainer,
 *     with status colour-coded.
 *
 * Phase 1 is read-only per user spec: no creation, no drag-reschedule, no
 * personal events. Those go into a follow-up pass.
 */
export default async function StudioCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/calendar");

  // Recurring weekly rules — supplies the "open hours" background overlay.
  const { data: rulesRaw } = await supabase
    .from("availability_rules")
    .select("day_of_week, start_time, end_time")
    .eq("trainer_id", user.id);
  const rules: WorkingHourRule[] = (rulesRaw ?? []).map((r) => ({
    dow: r.day_of_week,
    start: String(r.start_time).slice(0, 5),
    end: String(r.end_time).slice(0, 5),
  }));

  // Bookings — pull a wide range so user can navigate ±3 months without re-fetch.
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 1).toISOString();

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(`
      id, start_time, end_time, status, price, note,
      service_name, package_name,
      service:services(name),
      package:packages(name),
      client:profiles!bookings_client_id_fkey(display_name, avatar_url)
    `)
    .eq("trainer_id", user.id)
    .gte("start_time", rangeStart)
    .lt("start_time", rangeEnd)
    .order("start_time", { ascending: true });

  const bookings: BookingEvent[] = (bookingsRaw ?? []).map((b) => {
    type BookingRow = {
      id: string;
      start_time: string;
      end_time: string;
      status: string;
      price: number;
      note: string | null;
      // Snapshot fields preferred over the joins — survive deletion of
      // the underlying service/package row (migration 018).
      service_name: string | null;
      package_name: string | null;
      service: { name: string } | { name: string }[] | null;
      package: { name: string } | { name: string }[] | null;
      client: { display_name: string | null; avatar_url: string | null } | { display_name: string | null; avatar_url: string | null }[] | null;
    };
    const row = b as BookingRow;
    // Supabase joins return arrays for to-many but single-valued FK can come
    // back as either object or array depending on the join shape — normalise.
    const svc = Array.isArray(row.service) ? row.service[0] : row.service;
    const pkg = Array.isArray(row.package) ? row.package[0] : row.package;
    const cli = Array.isArray(row.client) ? row.client[0] : row.client;
    // Package presence drives a distinct calendar palette. Snapshot first,
    // JOIN fallback — same precedence rule as the existing title resolver.
    const packageName = row.package_name ?? pkg?.name ?? null;
    return {
      id: row.id,
      start: row.start_time,
      end: row.end_time,
      status: row.status as BookingEvent["status"],
      price: row.price,
      note: row.note,
      title: row.service_name ?? packageName ?? svc?.name ?? "Sesja",
      packageName,
      clientName: cli?.display_name ?? "Klient",
      clientAvatar: cli?.avatar_url ?? null,
    };
  });

  // Pending reschedule requests across these bookings — used to flag events
  // that have an outstanding "tu zaproponowano przeniesienie" badge.
  const pendingResMap = await getPendingRescheduleMap(bookings.map((b) => b.id));
  const pendingRescheduleIds = Object.keys(pendingResMap);

  // Per-date overrides for a window matching the bookings range — covers
  // any week the trainer can navigate to without an extra fetch on the
  // client. Falls back to [] silently if migration 030 isn't applied yet.
  const fromDate = rangeStart.slice(0, 10);
  const toDate = rangeEnd.slice(0, 10);
  const ovList = await getAvailabilityOverridesInRange(user.id, fromDate, toDate);
  // Collapse multi-shift dates into one row each — the calendar overlay
  // only needs (date, [{start,end}], isClosed). Keep map order stable.
  const overrideMap = new Map<string, DateOverrideRow>();
  for (const o of ovList) {
    const existing = overrideMap.get(o.date);
    if (o.isClosed) {
      overrideMap.set(o.date, { date: o.date, shifts: [], isClosed: true });
    } else if (existing && !existing.isClosed) {
      existing.shifts.push({ start: o.start, end: o.end ?? "23:59" });
    } else {
      overrideMap.set(o.date, {
        date: o.date,
        shifts: [{ start: o.start, end: o.end ?? "23:59" }],
        isClosed: false,
      });
    }
  }
  const overrides: DateOverrideRow[] = Array.from(overrideMap.values());

  return (
    <CalendarClient
      rules={rules}
      overrides={overrides}
      bookings={bookings}
      trainerId={user.id}
      pendingRescheduleIds={pendingRescheduleIds}
    />
  );
}
