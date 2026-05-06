import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SessionScreen from "./SessionScreen";

/**
 * Single-session screen — entry point for the trainer in the gym.
 * Pulls booking + client (from profiles + trainer_clients roster) +
 * past sessions with the same client (for the history collapsible).
 *
 * Hardened against missing migrations:
 *   - 018 (snapshot fields) — falls back to live JOIN if service_name etc. absent
 *   - 023 (trainer_clients) — falls back to no roster context
 *   - 024 (payment_status) — defaults to "pending"
 *   - 025 (session_notes) — soft-fails on save; on read it's just null
 */
export default async function SesjaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/studio/sesja/${id}`);

  // Try the rich SELECT first; fall back to basic shape on 42703 so the
  // page works on partially-migrated databases.
  type BookingShape = {
    id: string;
    start_time: string;
    end_time: string | null;
    status: string;
    price: number | null;
    service_id: string | null;
    client_id: string | null;
    service_name?: string | null;
    service_price?: number | null;
    payment_status?: string | null;
    session_notes?: string | null;
    service?: { name: string; price: number } | null;
    client?: { id: string; display_name: string | null; avatar_url: string | null; avatar_focal?: string | null } | null;
  };

  const fields = `
    id, start_time, end_time, status, price, service_id, client_id,
    service_name, service_price, payment_status, session_notes,
    service:services!service_id ( name, price ),
    client:profiles!client_id ( id, display_name, avatar_url, avatar_focal )
  `;

  let booking: BookingShape | null = null;
  const richRes = await supabase
    .from("bookings")
    .select(fields)
    .eq("id", id)
    .eq("trainer_id", user.id)
    .maybeSingle();

  if (richRes.error?.code === "42703") {
    // Strip migration-gated columns and retry with the basics.
    const { data: basicRes } = await supabase
      .from("bookings")
      .select(
        `
        id, start_time, end_time, status, price, service_id, client_id,
        service:services!service_id ( name, price ),
        client:profiles!client_id ( id, display_name, avatar_url )
        `,
      )
      .eq("id", id)
      .eq("trainer_id", user.id)
      .maybeSingle();
    booking = basicRes as unknown as BookingShape;
  } else {
    booking = richRes.data as unknown as BookingShape;
  }

  if (!booking) notFound();

  // Pull the trainer_clients roster row (if any) — gives us goal / tags /
  // client-level notes that the SessionScreen surfaces above the session
  // notes textarea. Tolerant of migration 023 missing.
  const profileId = booking.client?.id ?? booking.client_id;
  let roster: { id: string; goal: string | null; tags: string[]; notes: string | null } | null = null;
  if (profileId) {
    const rosterRes = await supabase
      .from("trainer_clients")
      .select("id, goal, tags, notes")
      .eq("trainer_id", user.id)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!rosterRes.error) {
      roster = rosterRes.data as { id: string; goal: string | null; tags: string[]; notes: string | null } | null;
    }
  }

  // Past sessions with the same client — last 5 completed.
  let pastSessions: { id: string; startTime: string; serviceName: string; sessionNotes: string | null }[] = [];
  if (profileId) {
    const pastRes = await supabase
      .from("bookings")
      .select("id, start_time, service_name, session_notes, service:services!service_id ( name )")
      .eq("trainer_id", user.id)
      .eq("client_id", profileId)
      .eq("status", "completed")
      .neq("id", booking.id)
      .order("start_time", { ascending: false })
      .limit(5);
    if (!pastRes.error && pastRes.data) {
      pastSessions = (pastRes.data as unknown as Array<{
        id: string;
        start_time: string;
        service_name?: string | null;
        session_notes?: string | null;
        service?: { name: string } | null;
      }>).map((p) => ({
        id: p.id,
        startTime: p.start_time,
        serviceName: p.service_name ?? p.service?.name ?? "Sesja",
        sessionNotes: p.session_notes ?? null,
      }));
    }
  }

  return (
    <SessionScreen
      session={{
        id: booking.id,
        startTime: booking.start_time,
        endTime: booking.end_time,
        status: booking.status,
        serviceName: booking.service_name ?? booking.service?.name ?? "Sesja",
        servicePrice: Number(booking.service_price ?? booking.price ?? booking.service?.price ?? 0),
        paymentStatus: booking.payment_status ?? "pending",
        sessionNotes: booking.session_notes ?? null,
        client: {
          profileId: profileId ?? null,
          displayName: booking.client?.display_name ?? "Klient",
          avatarUrl: booking.client?.avatar_url ?? null,
          avatarFocal: booking.client?.avatar_focal ?? null,
          rosterId: roster?.id ?? null,
          goal: roster?.goal ?? null,
          tags: roster?.tags ?? [],
          clientNotes: roster?.notes ?? null,
        },
        pastSessions,
      }}
    />
  );
}
