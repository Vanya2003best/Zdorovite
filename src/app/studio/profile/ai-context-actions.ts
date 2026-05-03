"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * AI prompt context — the answers a trainer fills out once under
 * /studio/profile so every AI generator on /studio/design has rich,
 * structured input instead of guessing from a stale `about` blurb.
 *
 * Each field is a free-text textarea; max ~1000 chars apiece. The shape
 * is deliberately small and stable — adding a new field is a matter of
 * extending FIELDS below; the JSONB column tolerates schema evolution.
 */
const FIELDS = [
  "background",
  "targetAudience",
  "methodology",
  "differentiators",
  "tonePreference",
] as const;

type Field = (typeof FIELDS)[number];

export type AiContext = Partial<Record<Field, string>>;

const MAX_LEN = 1500;

export async function updateAiContextField(
  field: string,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  if (!FIELDS.includes(field as Field)) {
    return { error: "Nieznane pole" };
  }
  const trimmed = String(value ?? "").trim().slice(0, MAX_LEN);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Read-modify-write the JSONB. Cheap because the column is small.
  const { data: trainer } = await supabase
    .from("trainers")
    .select("ai_context, slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) return { error: "Nie jesteś trenerem" };

  const current = (trainer.ai_context ?? {}) as AiContext;
  const next: AiContext = { ...current };
  if (trimmed === "") {
    delete next[field as Field];
  } else {
    next[field as Field] = trimmed;
  }

  const { error } = await supabase
    .from("trainers")
    .update({ ai_context: next })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // The AI generators read this on /studio/design, so revalidating that
  // route is the only thing strictly needed. We also bust the public
  // profile in case the trainer triggers a regen immediately after.
  revalidatePath("/studio/profile");
  revalidatePath("/studio/design");
  if (trainer.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true };
}
