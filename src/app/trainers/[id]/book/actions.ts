"use server";

import { redirect, unstable_rethrow } from "next/navigation";
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
  const packageIdRaw = String(formData.get("package_id") ?? "").trim();
  const packageId = packageIdRaw === "" ? null : packageIdRaw;

  if (!trainerSlug || !serviceId || !startIso) {
    return { error: "Wybierz usługę i termin." };
  }
  if (Number.isNaN(new Date(startIso).getTime())) {
    return { error: "Nieprawidłowy termin." };
  }

  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const nextPath = `/trainers/${encodeURIComponent(trainerSlug)}/book${packageId ? `?package=${encodeURIComponent(packageId)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
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

  // Optional package — verifies ownership and lets us snapshot the package
  // name + per-session price onto the booking. When set, this session counts
  // toward the package and the client doesn't owe the per-session price
  // separately (paid as part of the package up front).
  let pkg: { id: string; name: string; price: number; sessions_total: number | null } | null = null;
  if (packageId) {
    const { data: pkgRow } = await supabase
      .from("packages")
      .select("id, name, price, sessions_total")
      .eq("id", packageId)
      .eq("trainer_id", trainer.id)
      .maybeSingle();
    pkg = pkgRow ?? null;
  }

  const startDate = new Date(startIso);
  const durationMin = service.duration > 0 ? service.duration : 60;
  const endDate = new Date(startDate.getTime() + durationMin * 60_000);

  // Snapshot the service fields onto the booking row so the booking
  // survives later edits / deletion of the service. Trainer and client
  // both see the original booked service even after the source row is
  // gone (see migration 018_booking_snapshot.sql).
  const pricePerSession = pkg && pkg.sessions_total && pkg.sessions_total > 0
    ? Math.round(pkg.price / pkg.sessions_total)
    : service.price;

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
      package_id: pkg?.id ?? null,
      package_name: pkg?.name ?? null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed", // no payment yet → auto-confirm; switch to 'pending' when Stripe is wired
      price: pricePerSession,
      note,
    })
    .select("id")
    .single();

  if (bookErr) {
    // exclusion constraint 23P01 → slot taken
    if (bookErr.code === "23P01") {
      return { error: "Ten termin został właśnie zajęty. Wybierz inny." };
    }
    console.error("[book] booking insert failed:", bookErr);
    return { error: "Nie udało się utworzyć rezerwacji. Spróbuj ponownie." };
  }

  revalidatePath(`/trainers/${trainerSlug}`);
  revalidatePath("/account/bookings");
  revalidatePath("/studio/bookings");

  // Notify the trainer about the new booking. Non-fatal — the booking exists.
  try {
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
  } catch (notifyErr) {
    console.error("[book] notify failed (non-fatal):", notifyErr);
  }

  redirect(`/trainers/${trainerSlug}/book/success?id=${booking!.id}`);
  } catch (err) {
    // redirect() throws a control-flow error — let Next handle it.
    unstable_rethrow(err);
    console.error("[book] createBooking crashed:", err);
    return { error: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}
