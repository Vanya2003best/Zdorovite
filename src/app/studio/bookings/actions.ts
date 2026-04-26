"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function updateStatusAsTrainer(
  bookingId: string,
  newStatus: "cancelled" | "completed" | "no_show" | "confirmed",
): Promise<void> {
  if (!bookingId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("trainer_id, status, start_time")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.trainer_id !== user.id) return;

  // sanity per action
  if (newStatus === "cancelled" && booking.status === "cancelled") return;
  if (newStatus === "completed" && new Date(booking.start_time) > new Date()) return;

  await supabase.from("bookings").update({ status: newStatus }).eq("id", bookingId);
  revalidatePath("/studio/bookings");
}

export async function cancelAsTrainer(formData: FormData): Promise<void> {
  await updateStatusAsTrainer(String(formData.get("booking_id") ?? ""), "cancelled");
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
