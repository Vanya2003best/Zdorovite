"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

/**
 * Helper — turn the new proposed_start (a Warsaw-local "YYYY-MM-DDTHH:mm" string
 * coming from the client picker) plus a duration into UTC ISO strings.
 *
 * The picker already builds slot ISOs via warsawLocalToIso in lib/time, so by
 * the time it gets here both `proposed_start` and `proposed_end` are full ISO
 * strings. We only validate them.
 */
function ensureIso(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error("Niepoprawna data.");
  return d.toISOString();
}

async function paths(bookingId: string) {
  // Revalidate every surface that renders a session card or chat
  // message for this booking. Cheap — they're all dynamic routes.
  revalidatePath("/account");
  revalidatePath("/account/bookings");
  revalidatePath("/account/messages");
  revalidatePath("/studio");
  revalidatePath("/studio/bookings");
  revalidatePath("/studio/messages");
  // Best-effort: the booking detail isn't a dedicated route, but revalidating
  // the messages thread is what users actually see.
  void bookingId;
}

/**
 * Client OR trainer proposes a new time for a booking.
 *
 * Side-effects:
 *  1. Inserts a reschedule_requests row (status=pending).
 *  2. Inserts a chat message (message_type='reschedule_proposal') from the
 *     requester to the other party, linking back via reschedule_request_id.
 *     The text is a fallback for clients that don't render booking-cards.
 */
export async function requestReschedule(input: {
  bookingId: string;
  proposedStart: string;
  proposedEnd: string;
  reason?: string;
}): Promise<ActionResult> {
  const { bookingId } = input;
  const proposedStart = ensureIso(input.proposedStart);
  const proposedEnd = ensureIso(input.proposedEnd);
  const reason = input.reason?.trim() || null;

  if (!bookingId) return { error: "Brak rezerwacji." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, client_id, trainer_id, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr) return { error: bErr.message };
  if (!booking) return { error: "Nie znaleziono rezerwacji." };
  if (![booking.client_id, booking.trainer_id].includes(user.id)) {
    return { error: "Brak uprawnień do tej rezerwacji." };
  }
  if (["cancelled", "no_show", "completed"].includes(booking.status)) {
    return { error: "Tej rezerwacji nie można już zmienić." };
  }

  // Check there's no pending request already — keep one open at a time.
  const { data: existing } = await supabase
    .from("reschedule_requests")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .limit(1);
  if (existing && existing.length > 0) {
    return { error: "Istnieje już aktywna propozycja zmiany dla tej rezerwacji." };
  }

  const { data: created, error: insErr } = await supabase
    .from("reschedule_requests")
    .insert({
      booking_id: bookingId,
      requested_by: user.id,
      proposed_start: proposedStart,
      proposed_end: proposedEnd,
      reason,
    })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };

  const otherId = booking.client_id === user.id ? booking.trainer_id : booking.client_id;

  // Linked chat message for the booking-card render. Text is a fallback only.
  const { error: msgErr } = await supabase.from("messages").insert({
    from_id: user.id,
    to_id: otherId,
    text: "📅 Propozycja zmiany terminu sesji",
    message_type: "reschedule_proposal",
    reschedule_request_id: created.id,
  });
  if (msgErr) {
    // Roll back the request so the user can try again. Best-effort.
    await supabase.from("reschedule_requests").delete().eq("id", created.id);
    return { error: msgErr.message };
  }

  await paths(bookingId);
  return { ok: true };
}

/**
 * Other-party accepts a pending reschedule_request.
 *
 * Atomic intent (best-effort without a server-side function):
 *  1. UPDATE bookings start_time/end_time. If this conflicts with another
 *     non-cancelled booking on the same trainer, the EXCLUDE constraint in
 *     migration 001 rejects it — we surface the message to the user.
 *  2. UPDATE reschedule_requests status='accepted'.
 *  3. INSERT ack message ('reschedule_response').
 *
 * If step 2 fails after step 1 succeeded the booking time is already moved;
 * we attempt to roll back. If even that fails the user will see an error and
 * can still see the proposal status manually.
 */
export async function acceptReschedule(requestId: string): Promise<ActionResult> {
  if (!requestId) return { error: "Brak identyfikatora propozycji." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { data: req, error: reqErr } = await supabase
    .from("reschedule_requests")
    .select("id, booking_id, requested_by, proposed_start, proposed_end, status")
    .eq("id", requestId)
    .maybeSingle();
  if (reqErr) return { error: reqErr.message };
  if (!req) return { error: "Propozycja nie istnieje." };
  if (req.status !== "pending") {
    return { error: "Ta propozycja nie jest już aktywna." };
  }
  if (req.requested_by === user.id) {
    return { error: "Nie możesz zaakceptować własnej propozycji." };
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, client_id, trainer_id, start_time, end_time")
    .eq("id", req.booking_id)
    .maybeSingle();
  if (bErr) return { error: bErr.message };
  if (!booking) return { error: "Rezerwacja zniknęła." };

  const previousStart = booking.start_time;
  const previousEnd = booking.end_time;

  // 1. Move the booking. The exclude constraint catches overlaps.
  const { error: updBookErr } = await supabase
    .from("bookings")
    .update({ start_time: req.proposed_start, end_time: req.proposed_end })
    .eq("id", req.booking_id);
  if (updBookErr) {
    if (updBookErr.message.includes("bookings_no_overlap")) {
      return { error: "Ten termin nakłada się na inną Twoją rezerwację." };
    }
    return { error: updBookErr.message };
  }

  // 2. Mark the request accepted.
  const { error: updReqErr } = await supabase
    .from("reschedule_requests")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq("id", req.id);
  if (updReqErr) {
    // Best-effort rollback of the booking time so the system stays consistent.
    await supabase
      .from("bookings")
      .update({ start_time: previousStart, end_time: previousEnd })
      .eq("id", req.booking_id);
    return { error: updReqErr.message };
  }

  // 3. Ack message in the chat — visible to both sides via realtime INSERT.
  const otherId = booking.client_id === user.id ? booking.trainer_id : booking.client_id;
  await supabase.from("messages").insert({
    from_id: user.id,
    to_id: otherId,
    text: "✓ Zmiana terminu zaakceptowana",
    message_type: "reschedule_response",
    reschedule_request_id: req.id,
  });

  await paths(req.booking_id);
  return { ok: true };
}

/** Other-party declines a pending request. Booking stays as-is. */
export async function declineReschedule(requestId: string): Promise<ActionResult> {
  if (!requestId) return { error: "Brak identyfikatora propozycji." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { data: req } = await supabase
    .from("reschedule_requests")
    .select("id, booking_id, requested_by, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { error: "Propozycja nie istnieje." };
  if (req.status !== "pending") return { error: "Ta propozycja nie jest już aktywna." };
  if (req.requested_by === user.id) return { error: "Nie możesz odrzucić własnej propozycji." };

  const { data: booking } = await supabase
    .from("bookings")
    .select("client_id, trainer_id")
    .eq("id", req.booking_id)
    .maybeSingle();

  const { error: updErr } = await supabase
    .from("reschedule_requests")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq("id", req.id);
  if (updErr) return { error: updErr.message };

  if (booking) {
    const otherId = booking.client_id === user.id ? booking.trainer_id : booking.client_id;
    await supabase.from("messages").insert({
      from_id: user.id,
      to_id: otherId,
      text: "✗ Propozycja zmiany terminu odrzucona",
      message_type: "reschedule_response",
      reschedule_request_id: req.id,
    });
  }

  await paths(req.booking_id);
  return { ok: true };
}

/** Requester cancels their own pending request. */
export async function cancelReschedule(requestId: string): Promise<ActionResult> {
  if (!requestId) return { error: "Brak identyfikatora propozycji." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { data: req } = await supabase
    .from("reschedule_requests")
    .select("id, booking_id, requested_by, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { error: "Propozycja nie istnieje." };
  if (req.status !== "pending") return { error: "Ta propozycja nie jest już aktywna." };
  if (req.requested_by !== user.id) return { error: "Tylko autor propozycji może ją wycofać." };

  const { error: updErr } = await supabase
    .from("reschedule_requests")
    .update({ status: "cancelled" })
    .eq("id", req.id);
  if (updErr) return { error: updErr.message };

  await paths(req.booking_id);
  return { ok: true };
}
