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

export type PackageBookingState =
  | { error: string }
  | { success: true; bookingId: string }
  | null;

/**
 * Books the FIRST session of a package. Distinct from the per-service
 * createBooking action because the bookings table has a check constraint
 * "(service_id is null) <> (package_id is null)" — exactly one of the two
 * must be set. Sharing one action that sets both fails that constraint.
 *
 * Subsequent sessions in the same package are booked from /studio/calendar
 * by the trainer (or via /account/package self-service later).
 */
export async function createPackageBooking(
  _prev: PackageBookingState,
  formData: FormData,
): Promise<PackageBookingState> {
  const trainerSlug = String(formData.get("trainer_slug") ?? "");
  const packageId = String(formData.get("package_id") ?? "");
  const startIso = String(formData.get("start_iso") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!trainerSlug || !packageId || !startIso) {
    return { error: "Wybierz termin pierwszej sesji." };
  }
  if (Number.isNaN(new Date(startIso).getTime())) {
    return { error: "Nieprawidłowy termin." };
  }

  try {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/trainers/${trainerSlug}/book-package/${packageId}`);
  }

  const { data: trainer, error: trErr } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", trainerSlug)
    .single();
  if (trErr || !trainer) return { error: "Nie znaleziono trenera." };

  const { data: pkg, error: pkgErr } = await supabase
    .from("packages")
    .select("id, name, description, price, period")
    .eq("id", packageId)
    .eq("trainer_id", trainer.id)
    .maybeSingle();
  if (pkgErr || !pkg) return { error: "Nie znaleziono pakietu." };

  const startDate = new Date(startIso);
  // Packages don't store per-session duration in 001_initial_schema. We
  // default to a 60-min session for the first booking; the trainer can
  // adjust subsequent sessions individually from the studio calendar.
  const durationMin = 60;
  const endDate = new Date(startDate.getTime() + durationMin * 60_000);

  // Per-session price = package total / number of sessions if known.
  // Falls back to 0 (paid as part of the package up front).
  // Note: 001 packages table has no `sessions_total` column directly;
  // newer schema may. We read it defensively from the row if present.
  type PkgWithMaybeSessions = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    period: string | null;
    sessions_total?: number | null;
  };
  const pkgWithSessions = pkg as PkgWithMaybeSessions;
  const sessionsTotal = pkgWithSessions.sessions_total ?? null;
  const pricePerSession =
    sessionsTotal && sessionsTotal > 0 ? Math.round(pkg.price / sessionsTotal) : 0;

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      client_id: user.id,
      trainer_id: trainer.id,
      // CRITICAL: service_id MUST be null when package_id is set — the
      // bookings table has a check constraint enforcing exactly-one.
      service_id: null,
      service_name: null,
      service_description: null,
      service_duration: durationMin,
      service_price: null,
      package_id: pkg.id,
      package_name: pkg.name,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed",
      price: pricePerSession,
      note,
    })
    .select("id")
    .single();

  if (bookErr) {
    if (bookErr.code === "23P01") {
      return { error: "Ten termin został właśnie zajęty. Wybierz inny." };
    }
    console.error("[book-package] booking insert failed:", bookErr);
    return { error: "Nie udało się utworzyć rezerwacji. Spróbuj ponownie." };
  }

  revalidatePath(`/trainers/${trainerSlug}`);
  revalidatePath("/account/bookings");
  revalidatePath("/studio/bookings");

  // Notification is non-fatal — the booking already exists.
  try {
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user!.id)
      .maybeSingle();
    await notify.bookingRequested({
      trainerId: trainer.id,
      clientName: clientProfile?.display_name ?? "Klient",
      whenLabel: `${pkg.name} · ${fmtWhen(startDate.toISOString())}`,
      bookingId: booking!.id,
    });
  } catch (notifyErr) {
    console.error("[book-package] notify failed (non-fatal):", notifyErr);
  }

  redirect(`/trainers/${trainerSlug}/book/success?id=${booking!.id}`);
  } catch (err) {
    // redirect() throws a control-flow error — let Next handle it.
    unstable_rethrow(err);
    console.error("[book-package] createPackageBooking crashed:", err);
    return { error: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}
