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

export async function cancelMyBooking(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("client_id, trainer_id, start_time, status")
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
  revalidatePath("/account");
  revalidatePath("/studio/bookings");

  // Tell the trainer.
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
}
