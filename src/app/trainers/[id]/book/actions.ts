"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/server/notify";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type BookingState =
  | { error: string }
  | { success: true; bookingId: string }
  | null;

export async function createBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const trainerSlug = String(formData.get("trainer_slug") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const startIso = String(formData.get("start_iso") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!trainerSlug || !serviceId || !startIso) {
    return { error: "Wybierz usługę i termin." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/trainers/${trainerSlug}/book`);
  }

  // Look up trainer + service
  const { data: trainer, error: trErr } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", trainerSlug)
    .single();
  if (trErr || !trainer) return { error: "Nie znaleziono trenera." };

  const { data: service, error: svcErr } = await supabase
    .from("services")
    .select("id, name, description, duration, price")
    .eq("id", serviceId)
    .eq("trainer_id", trainer.id)
    .single();
  if (svcErr || !service) return { error: "Nie znaleziono usługi." };

  const startDate = new Date(startIso);
  const durationMin = service.duration > 0 ? service.duration : 60;
  const endDate = new Date(startDate.getTime() + durationMin * 60_000);

  // Snapshot the service fields onto the booking row so the booking
  // survives later edits / deletion of the service. Trainer and client
  // both see the original booked service even after the source row is
  // gone (see migration 018_booking_snapshot.sql).
  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      client_id: user.id,
      trainer_id: trainer.id,
      service_id: service.id,
      service_name: service.name,
      service_description: service.description,
      service_duration: service.duration,
      service_price: service.price,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed", // no payment yet → auto-confirm; switch to 'pending' when Stripe is wired
      price: service.price,
      note,
    })
    .select("id")
    .single();

  if (bookErr) {
    // exclusion constraint 23P01 → slot taken
    if (bookErr.code === "23P01") {
      return { error: "Ten termin został właśnie zajęty. Wybierz inny." };
    }
    return { error: bookErr.message };
  }

  revalidatePath(`/trainers/${trainerSlug}`);
  revalidatePath("/account/bookings");
  revalidatePath("/studio/bookings");

  // Notify the trainer about the new booking.
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();
  await notify.bookingRequested({
    trainerId: trainer.id,
    clientName: clientProfile?.display_name ?? "Klient",
    whenLabel: fmtWhen(startDate.toISOString()),
    bookingId: booking!.id,
  });

  redirect(`/trainers/${trainerSlug}/book/success?id=${booking!.id}`);
}
