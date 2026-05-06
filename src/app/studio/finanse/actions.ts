"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PaymentMethod = "blik" | "cash" | "transfer" | "package" | "platform";

export type ActionResult = { ok: true } | { error: string };

const VALID_METHODS: ReadonlySet<PaymentMethod> = new Set([
  "blik",
  "cash",
  "transfer",
  "package",
  "platform",
]);

/**
 * Mark a booking as paid. Trainer-initiated for off-platform methods
 * (BLIK / cash / pakiet); the 'platform' method will be auto-set by
 * the Stripe webhook in P7 — manual marking is allowed there too as
 * a fallback if the webhook lags.
 *
 * Amount defaults to the booking's stored price (snapshot if available,
 * else live service price). For 'platform' method the trainer mental
 * model still says "I got the price" — the +1 zł lives only on the
 * client side, doesn't show up here.
 */
export async function markBookingPaid(
  bookingId: string,
  method: PaymentMethod,
): Promise<ActionResult> {
  if (!VALID_METHODS.has(method)) return { error: "Nieprawidłowa metoda płatności." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  // Pull the booking to determine amount. Snapshot fields (migration 018)
  // preferred — service may have been deleted by the time we mark paid.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, trainer_id, price, service_price")
    .eq("id", bookingId)
    .eq("trainer_id", user.id)
    .maybeSingle();

  if (!booking) return { error: "Rezerwacja nie istnieje." };

  // Reconcile price columns — older bookings have only `price`, newer
  // ones have snapshot `service_price` from migration 018.
  type BookingShape = { price?: number; service_price?: number };
  const b = booking as unknown as BookingShape;
  const amount = b.service_price ?? b.price ?? 0;

  const { error } = await supabase
    .from("bookings")
    .update({
      payment_status: "paid",
      payment_method: method,
      paid_at: new Date().toISOString(),
      payment_amount: amount,
    })
    .eq("id", bookingId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/finanse");
  revalidatePath("/studio");
  revalidatePath("/studio/bookings");
  return { ok: true };
}

/**
 * Reverse a paid mark — useful if trainer clicked the wrong method or
 * the client charged back. Resets to pending; admin can later upgrade
 * to 'refunded' if money actually flowed and went back.
 */
export async function unmarkBookingPaid(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error } = await supabase
    .from("bookings")
    .update({
      payment_status: "pending",
      payment_method: null,
      paid_at: null,
      payment_amount: null,
    })
    .eq("id", bookingId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/finanse");
  revalidatePath("/studio");
  return { ok: true };
}
