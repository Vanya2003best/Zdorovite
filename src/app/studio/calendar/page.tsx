import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingRescheduleMap } from "@/lib/db/reschedule";
import CalendarClient, { type BookingEvent, type WorkingHourRule } from "./CalendarClient";

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
    return {
      id: row.id,
      start: row.start_time,
      end: row.end_time,
      status: row.status as BookingEvent["status"],
      price: row.price,
      note: row.note,
      // Snapshot first, JOIN as legacy fallback.
      title: row.service_name ?? row.package_name ?? svc?.name ?? pkg?.name ?? "Sesja",
      clientName: cli?.display_name ?? "Klient",
      clientAvatar: cli?.avatar_url ?? null,
    };
  });

  // Pending reschedule requests across these bookings — used to flag events
  // that have an outstanding "tu zaproponowano przeniesienie" badge.
  const pendingResMap = await getPendingRescheduleMap(bookings.map((b) => b.id));
  const pendingRescheduleIds = Object.keys(pendingResMap);

  return (
    <CalendarClient
      rules={rules}
      bookings={bookings}
      trainerId={user.id}
      pendingRescheduleIds={pendingRescheduleIds}
    />
  );
}
