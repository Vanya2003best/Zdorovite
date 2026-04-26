"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cancelMyBooking(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("client_id, start_time, status")
    .eq("id", bookingId)
    .single();

  if (!booking) return;
  if (booking.client_id !== user.id) return;
  if (booking.status === "cancelled") return;
  if (new Date(booking.start_time) <= new Date()) return;

  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);

  revalidatePath("/account/bookings");
}
