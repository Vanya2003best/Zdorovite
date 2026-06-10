"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/server/notify";

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Structured result so the client can be told why a cancellation failed.
 * Previously this returned `void`, so a booking that couldn't be cancelled
 * (e.g. already started, not owned, DB error) failed silently.
 */
export type CancelBookingResult = { ok: true } | { error: string };

export async function cancelMyBooking(formData: FormData): Promise<CancelBookingResult> {
  try {
    if (!(formData instanceof FormData)) {
      return { error: "Nieprawidłowe dane formularza." };
    }

    const bookingId = String(formData.get("booking_id") ?? "").trim();
    if (!bookingId) return { error: "Brak identyfikatora rezerwacji." };
    if (!UUID_RE.test(bookingId)) return { error: "Nieprawidłowy identyfikator rezerwacji." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Musisz być zalogowany." };

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("client_id, trainer_id, start_time, status")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) return { error: "Nie znaleziono rezerwacji." };
    if (booking.client_id !== user.id) {
      return { error: "Nie masz uprawnień do tej rezerwacji." };
    }
    if (booking.status === "cancelled") {
      return { error: "Ta rezerwacja jest już anulowana." };
    }
    if (new Date(booking.start_time) <= new Date()) {
      return { error: "Nie można anulować sesji, która już się rozpoczęła." };
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);
    if (updateErr) {
      console.error("[account/bookings] cancel failed:", updateErr);
      return { error: "Nie udało się anulować rezerwacji. Spróbuj ponownie." };
    }

    revalidatePath("/account/bookings");
    revalidatePath("/account");
    revalidatePath("/studio/bookings");

    // Tell the trainer. Notification failures are non-fatal: the booking
    // is already cancelled.
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      await notify.bookingCancelled({
        to: booking.trainer_id,
        actorName: profile?.display_name ?? "Klient",
        whenLabel: fmtWhen(booking.start_time),
        bookingId,
        link: "/studio/bookings",
      });
    } catch (notifyErr) {
      console.error("[account/bookings] notify failed (non-fatal):", notifyErr);
    }

    return { ok: true };
  } catch (err) {
    console.error("[account/bookings] cancelMyBooking failed:", err);
    return { error: DEFAULT_ERROR };
  }
}
