"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { error: string };

/**
 * Auto-save session notes — fires on textarea blur. Trainer types live
 * at the gym between sets; cap at 4000 chars to keep the row reasonably
 * sized in the bookings table.
 *
 * Tolerant of migration 025 not being applied — soft-fail with a
 * recognisable error so the UI can show "wkrótce" instead of crashing.
 */
export async function saveSessionNotes(
  bookingId: string,
  notes: string,
): Promise<ActionResult> {
  const trimmed = String(notes ?? "").slice(0, 4000);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error } = await supabase
    .from("bookings")
    .update({ session_notes: trimmed || null })
    .eq("id", bookingId)
    .eq("trainer_id", user.id);
  if (error) {
    if (error.code === "42703") return { error: "Funkcja wymaga migracji 025." };
    return { error: error.message };
  }

  revalidatePath(`/studio/sesja/${bookingId}`);
  return { ok: true };
}

/**
 * Mark a session as completed — flips bookings.status to 'completed'.
 * Doesn't touch payment — the UI immediately surfaces the mark-paid
 * picker after this fires, so trainer can finish the whole flow in
 * 2 clicks (Zakończ → BLIK / Gotówka / …).
 */
export async function markSessionCompleted(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/studio/sesja/${bookingId}`);
  revalidatePath("/studio");
  revalidatePath("/studio/finanse");
  return { ok: true };
}
