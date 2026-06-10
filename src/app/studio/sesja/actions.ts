"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true; data?: unknown } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const NOTES_MAX = 4000;

/**
 * Auto-save session notes - fires on textarea blur. Trainer types live
 * at the gym between sets; cap at 4000 chars to keep the row reasonably
 * sized in the bookings table.
 *
 * Tolerant of migration 025 not being applied - soft-fail with a
 * recognisable error so the UI can show "wkrotce" instead of crashing.
 */
export async function saveSessionNotes(
  bookingId: string,
  notes: string,
): Promise<ActionResult> {
  try {
    if (typeof bookingId !== "string" || bookingId.trim().length === 0) {
      return { error: "Brak id rezerwacji." };
    }
    if (typeof notes !== "string") return { error: "Nieprawidłowe notatki." };
    if (notes.length > NOTES_MAX) {
      return { error: `Notatki są zbyt długie (max ${NOTES_MAX} znaków).` };
    }

    const trimmed = notes;

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
  } catch (err) {
    console.error("saveSessionNotes failed", err);
    return { error: DEFAULT_ERROR };
  }
}

/**
 * Mark a session as completed - flips bookings.status to 'completed'.
 * Doesn't touch payment - the UI immediately surfaces the mark-paid
 * picker after this fires, so trainer can finish the whole flow in
 * 2 clicks (Zakoncz -> BLIK / Gotowka / ...).
 */
export async function markSessionCompleted(bookingId: string): Promise<ActionResult> {
  try {
    if (typeof bookingId !== "string" || bookingId.trim().length === 0) {
      return { error: "Brak id rezerwacji." };
    }

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
  } catch (err) {
    console.error("markSessionCompleted failed", err);
    return { error: DEFAULT_ERROR };
  }
}
