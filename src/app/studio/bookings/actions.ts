"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/server/notify";

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

type ChangeKind = "cancelled" | "completed" | "no_show" | "confirmed";

/**
 * Structured result so callers can surface a human-readable message.
 * Previously these actions returned `void`, which meant any failure
 * (auth, ownership, DB, notify) was silently swallowed and the trainer
 * saw the booking unchanged with no explanation.
 */
export type BookingActionResult = { ok: true } | { error: string };

const GENERIC_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const CHANGE_KINDS: ChangeKind[] = ["cancelled", "completed", "no_show", "confirmed"];

function isFormData(value: unknown): value is FormData {
  return value instanceof FormData;
}

function isChangeKind(value: unknown): value is ChangeKind {
  return typeof value === "string" && CHANGE_KINDS.includes(value as ChangeKind);
}

function parseBookingFormData(
  formData: unknown,
  { readReason = false }: { readReason?: boolean } = {},
): { data: { bookingId: string; reason?: string } } | { error: string } {
  if (!isFormData(formData)) return { error: "Nieprawidłowe dane formularza." };

  const rawBookingId = formData.get("booking_id");
  if (typeof rawBookingId !== "string" || !rawBookingId.trim() || rawBookingId.trim().length > 128) {
    return { error: "Brak identyfikatora rezerwacji." };
  }

  if (!readReason) return { data: { bookingId: rawBookingId.trim() } };

  const rawReason = formData.get("reason");
  if (rawReason === null) return { data: { bookingId: rawBookingId.trim() } };
  if (typeof rawReason !== "string") return { error: "Powód anulowania ma nieprawidłową wartość." };

  const reason = rawReason.trim();
  if (reason.length > 500) return { error: "Powód anulowania jest za długi." };

  return { data: { bookingId: rawBookingId.trim(), reason: reason || undefined } };
}

async function updateStatusAsTrainer(
  bookingId: string,
  newStatus: ChangeKind,
  reason?: string,
): Promise<BookingActionResult> {
  try {
    if (typeof bookingId !== "string" || !bookingId.trim()) {
      return { error: "Brak identyfikatora rezerwacji." };
    }
    if (!isChangeKind(newStatus)) {
      return { error: "Nieprawidłowy status rezerwacji." };
    }
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
      return { error: "Powód anulowania ma nieprawidłową wartość." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Musisz być zalogowany." };

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("trainer_id, client_id, status, start_time")
      .eq("id", bookingId.trim())
      .single();
    if (fetchErr || !booking) return { error: "Nie znaleziono rezerwacji." };
    if (booking.trainer_id !== user.id) {
      return { error: "Nie masz uprawnień do tej rezerwacji." };
    }

    // Sanity per action.
    if (newStatus === "cancelled" && booking.status === "cancelled") {
      return { error: "Ta rezerwacja jest już anulowana." };
    }
    if (newStatus === "completed" && new Date(booking.start_time) > new Date()) {
      return { error: "Nie można oznaczyć przyszłej sesji jako zakończonej." };
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", bookingId.trim());
    if (updateErr) {
      console.error("[studio/bookings] update status failed:", updateErr);
      return { error: "Nie udało się zaktualizować rezerwacji. Spróbuj ponownie." };
    }

    revalidatePath("/studio/bookings");
    revalidatePath("/account/bookings");
    revalidatePath("/account");

    // Notification failures are non-fatal; the status change already succeeded.
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const trainerName = profile?.display_name ?? "Trener";
      const whenLabel = fmtWhen(booking.start_time);

      if (newStatus === "confirmed") {
        await notify.bookingConfirmed({
          clientId: booking.client_id,
          trainerName,
          whenLabel,
          bookingId: bookingId.trim(),
        });
      } else if (newStatus === "cancelled") {
        // If the booking was still pending, treat the cancel as "trainer declined the request".
        if (booking.status === "pending") {
          await notify.bookingDeclined({
            clientId: booking.client_id,
            trainerName,
            whenLabel,
            bookingId: bookingId.trim(),
          });
        } else {
          await notify.bookingCancelled({
            to: booking.client_id,
            actorName: trainerName,
            whenLabel,
            bookingId: bookingId.trim(),
            reason,
            link: "/account/bookings",
          });
        }
      }
    } catch (notifyErr) {
      console.error("[studio/bookings] notify failed (non-fatal):", notifyErr);
    }

    return { ok: true };
  } catch (err) {
    console.error("[studio/bookings] updateStatusAsTrainer failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function cancelAsTrainer(formData: FormData): Promise<BookingActionResult> {
  try {
    const parsed = parseBookingFormData(formData, { readReason: true });
    if ("error" in parsed) return { error: parsed.error };

    return await updateStatusAsTrainer(parsed.data.bookingId, "cancelled", parsed.data.reason);
  } catch (err) {
    console.error("[studio/bookings] cancelAsTrainer failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function markCompleted(formData: FormData): Promise<BookingActionResult> {
  try {
    const parsed = parseBookingFormData(formData);
    if ("error" in parsed) return { error: parsed.error };

    return await updateStatusAsTrainer(parsed.data.bookingId, "completed");
  } catch (err) {
    console.error("[studio/bookings] markCompleted failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function markNoShow(formData: FormData): Promise<BookingActionResult> {
  try {
    const parsed = parseBookingFormData(formData);
    if ("error" in parsed) return { error: parsed.error };

    return await updateStatusAsTrainer(parsed.data.bookingId, "no_show");
  } catch (err) {
    console.error("[studio/bookings] markNoShow failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function confirmBooking(formData: FormData): Promise<BookingActionResult> {
  try {
    const parsed = parseBookingFormData(formData);
    if ("error" in parsed) return { error: parsed.error };

    return await updateStatusAsTrainer(parsed.data.bookingId, "confirmed");
  } catch (err) {
    console.error("[studio/bookings] confirmBooking failed:", err);
    return { error: GENERIC_ERROR };
  }
}
