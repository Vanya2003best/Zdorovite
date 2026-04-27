"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

/**
 * Upserts a single weight reading by (client_id, recorded_at). Logging again
 * for the same day overwrites the value — last-write-wins per day.
 */
export async function logWeight(input: {
  weightKg: number;
  recordedAt?: string; // YYYY-MM-DD; defaults to today
}): Promise<ActionResult> {
  if (!Number.isFinite(input.weightKg)) return { error: "Waga musi być liczbą." };
  if (input.weightKg <= 0 || input.weightKg >= 1000) return { error: "Niepoprawna waga." };

  const recordedAt = input.recordedAt || new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { error } = await supabase
    .from("client_weight_log")
    .upsert(
      { client_id: user.id, recorded_at: recordedAt, weight_kg: input.weightKg },
      { onConflict: "client_id,recorded_at" },
    );
  if (error) return { error: error.message };

  revalidatePath("/account");
  revalidatePath("/account/progress");
  return { ok: true };
}
