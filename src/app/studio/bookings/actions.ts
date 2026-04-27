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

async function updateStatusAsTrainer(bookingId: string, newStatus: ChangeKind, reason?: string): Promise<void> {
  if (!bookingId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("trainer_id, client_id, status, start_time")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.trainer_id !== user.id) return;

  // sanity per action
  if (newStatus === "cancelled" && booking.status === "cancelled") return;
  if (newStatus === "completed" && new Date(booking.start_time) > new Date()) return;

  await supabase.from("bookings").update({ status: newStatus }).eq("id", bookingId);
  revalidatePath("/studio/bookings");
  revalidatePath("/account/bookings");
  revalidatePath("/account");

  // Notify the client about decisions they care about. Trainer's name is needed
  // for the title; pulled from profiles via the trainer's own id.
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
      bookingId,
    });
  } else if (newStatus === "cancelled") {
    // If the booking was still pending, treat the cancel as "trainer declined the request".
    if (booking.status === "pending") {
      await notify.bookingDeclined({
        clientId: booking.client_id,
        trainerName,
        whenLabel,
        bookingId,
      });
    } else {
      await notify.bookingCancelled({
        to: booking.client_id,
        actorName: trainerName,
        whenLabel,
        bookingId,
        reason,
        link: "/account/bookings",
      });
    }
  }
}

export async function cancelAsTrainer(formData: FormData): Promise<void> {
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  await updateStatusAsTrainer(String(formData.get("booking_id") ?? ""), "cancelled", reason);
}

export async function markCompleted(formData: FormData): Promise<void> {
  await updateStatusAsTrainer(String(formData.get("booking_id") ?? ""), "completed");
}

export async function markNoShow(formData: FormData): Promise<void> {
  await updateStatusAsTrainer(String(formData.get("booking_id") ?? ""), "no_show");
}

export async function confirmBooking(formData: FormData): Promise<void> {
  await updateStatusAsTrainer(String(formData.get("booking_id") ?? ""), "confirmed");
}
