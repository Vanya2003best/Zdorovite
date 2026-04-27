"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

function paths() {
  revalidatePath("/account");
  revalidatePath("/account/progress");
}

export async function createGoal(input: {
  title: string;
  unit?: string;
  startValue: number;
  currentValue?: number;
  targetValue: number;
  targetDate?: string;
  note?: string;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { error: "Tytuł celu jest wymagany." };
  if (!Number.isFinite(input.startValue) || !Number.isFinite(input.targetValue)) {
    return { error: "Wartości startowa i docelowa muszą być liczbami." };
  }
  if (input.startValue === input.targetValue) {
    return { error: "Wartość docelowa musi się różnić od startowej." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { error } = await supabase.from("client_goals").insert({
    client_id: user.id,
    title,
    unit: input.unit?.trim() || null,
    start_value: input.startValue,
    current_value: input.currentValue ?? input.startValue,
    target_value: input.targetValue,
    target_date: input.targetDate || null,
    note: input.note?.trim() || null,
  });
  if (error) return { error: error.message };

  paths();
  return { ok: true };
}

/** Bump or set the current value on a goal. RLS prevents touching someone else's row. */
export async function updateGoalCurrent(goalId: string, currentValue: number): Promise<ActionResult> {
  if (!goalId) return { error: "Brak identyfikatora celu." };
  if (!Number.isFinite(currentValue)) return { error: "Wartość musi być liczbą." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { error } = await supabase
    .from("client_goals")
    .update({ current_value: currentValue })
    .eq("id", goalId)
    .eq("client_id", user.id);
  if (error) return { error: error.message };

  paths();
  return { ok: true };
}

export async function archiveGoal(goalId: string): Promise<ActionResult> {
  if (!goalId) return { error: "Brak identyfikatora celu." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { error } = await supabase
    .from("client_goals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("client_id", user.id);
  if (error) return { error: error.message };

  paths();
  return { ok: true };
}
