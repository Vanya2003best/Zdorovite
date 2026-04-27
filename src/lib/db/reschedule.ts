import { createClient } from "@/lib/supabase/server";

export type RescheduleStatus = "pending" | "accepted" | "declined" | "cancelled";

export type RescheduleRequest = {
  id: string;
  bookingId: string;
  requestedBy: string;
  proposedStart: string;
  proposedEnd: string;
  reason: string | null;
  status: RescheduleStatus;
  respondedAt: string | null;
  respondedBy: string | null;
  createdAt: string;
  /** Snapshot of the booking's current start_time, for "było 15:00" copy in the card. */
  previousStart: string;
  serviceName: string | null;
  packageName: string | null;
};

type RawRow = {
  id: string;
  booking_id: string;
  requested_by: string;
  proposed_start: string;
  proposed_end: string;
  reason: string | null;
  status: RescheduleStatus;
  responded_at: string | null;
  responded_by: string | null;
  created_at: string;
  booking: {
    start_time: string;
    service: { name: string } | null;
    package: { name: string } | null;
  } | null;
};

const SELECT = `
  id, booking_id, requested_by, proposed_start, proposed_end, reason,
  status, responded_at, responded_by, created_at,
  booking:bookings!booking_id (
    start_time,
    service:services ( name ),
    package:packages ( name )
  )
`;

function mapRow(row: RawRow): RescheduleRequest {
  return {
    id: row.id,
    bookingId: row.booking_id,
    requestedBy: row.requested_by,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    reason: row.reason,
    status: row.status,
    respondedAt: row.responded_at,
    respondedBy: row.responded_by,
    createdAt: row.created_at,
    previousStart: row.booking?.start_time ?? row.proposed_start,
    serviceName: row.booking?.service?.name ?? null,
    packageName: row.booking?.package?.name ?? null,
  };
}

/** Fetch reschedule requests by id (for chat message rendering). Filters to only the ids the caller can see via RLS. */
export async function getRescheduleRequestsByIds(ids: string[]): Promise<RescheduleRequest[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reschedule_requests")
    .select(SELECT)
    .in("id", ids);
  if (error) throw error;
  return ((data ?? []) as unknown as RawRow[]).map(mapRow);
}

/** Most recent pending request for a given booking, if any. Used to decorate session cards with a "Czeka na zmianę" badge. */
export async function getPendingRescheduleForBooking(bookingId: string): Promise<RescheduleRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reschedule_requests")
    .select(SELECT)
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as unknown as RawRow);
}

/** Pending requests for a set of bookings — bulk variant for list pages. */
export async function getPendingRescheduleMap(bookingIds: string[]): Promise<Map<string, RescheduleRequest>> {
  if (bookingIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reschedule_requests")
    .select(SELECT)
    .in("booking_id", bookingIds)
    .eq("status", "pending");
  if (error) throw error;
  const map = new Map<string, RescheduleRequest>();
  for (const row of (data ?? []) as unknown as RawRow[]) {
    // First-write-wins is fine — at most one pending per booking is enforced by app code.
    if (!map.has(row.booking_id)) map.set(row.booking_id, mapRow(row));
  }
  return map;
}
