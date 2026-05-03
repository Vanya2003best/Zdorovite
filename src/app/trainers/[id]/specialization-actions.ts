"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { specializations } from "@/data/specializations";
import { pushDeleteTombstone } from "@/lib/db/page-customization";

const VALID_IDS = new Set<string>(specializations.map((s) => s.id));

/**
 * Add a specialization to the current trainer's profile.
 * - Validates `specId` against the canonical list (no arbitrary inserts).
 * - Idempotent on duplicates: trainer_specializations has a composite PK, so a
 *   repeat insert just errors out — we swallow that and return ok.
 */
export async function addSpecialization(specId: string): Promise<{ ok: true } | { error: string }> {
  if (!VALID_IDS.has(specId)) return { error: "Nieprawidłowa specjalizacja" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const { error } = await supabase
    .from("trainer_specializations")
    .insert({ trainer_id: user.id, specialization_id: specId });

  // 23505 = unique_violation — already there, treat as success but DON'T
  // push a tombstone (nothing actually changed, so undo would no-op).
  if (error) {
    if (error.code === "23505") {
      revalidatePath("/studio/design");
      revalidatePath("/trainers/[id]", "page");
      return { ok: true };
    }
    return { error: error.message };
  }

  await pushDeleteTombstone(user.id, { kind: "specializationAdded", specId });

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

export async function removeSpecialization(specId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Verify the row was actually present so we don't push a tombstone for a
  // delete that didn't match anything (idempotency).
  const { data: existing } = await supabase
    .from("trainer_specializations")
    .select("specialization_id")
    .eq("trainer_id", user.id)
    .eq("specialization_id", specId)
    .maybeSingle();

  const { error } = await supabase
    .from("trainer_specializations")
    .delete()
    .eq("trainer_id", user.id)
    .eq("specialization_id", specId);

  if (error) return { error: error.message };

  if (existing) {
    await pushDeleteTombstone(user.id, { kind: "specializationRemoved", specId });
  }

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}
