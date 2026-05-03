"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pushDeleteTombstone } from "@/lib/db/page-customization";

const TEXT_FIELDS = new Set(["tagline", "about", "location"] as const);
const NUM_FIELDS = new Set(["experience", "price_from"] as const);

/** Updates a trainer text or number field. Only the owner. */
export async function updateTrainerField(
  field: string,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id, slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) return { error: "Nie jesteś trenerem." };

  let patch: Record<string, string | number>;

  if (TEXT_FIELDS.has(field as "tagline" | "about" | "location")) {
    const trimmed = value.trim();
    if (field === "tagline" && trimmed.length > 200) return { error: "Tagline zbyt długi (max 200)." };
    if (field === "about" && trimmed.length > 3000) return { error: "Opis zbyt długi (max 3000)." };
    if (field === "location" && trimmed.length > 100) return { error: "Lokalizacja zbyt długa." };
    patch = { [field]: trimmed };
  } else if (NUM_FIELDS.has(field as "experience" | "price_from")) {
    const num = Number(value);
    if (!Number.isFinite(num)) return { error: "Podaj liczbę." };
    if (field === "experience" && (num < 0 || num > 60)) return { error: "Zakres: 0–60 lat." };
    if (field === "price_from" && (num < 0 || num > 10000)) return { error: "Zakres: 0–10 000 zł." };
    patch = { [field]: Math.round(num) };
  } else {
    return { error: "Invalid field." };
  }

  // Snapshot the column we're about to overwrite so undo can revert it.
  const { data: before } = await supabase
    .from("trainers")
    .select(field)
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("trainers").update(patch).eq("id", user.id);
  if (error) return { error: error.message };

  if (before) {
    await pushDeleteTombstone(user.id, {
      kind: "trainerUpdated",
      before: before as Record<string, unknown>,
      after: patch,
    });
  }

  revalidatePath(`/trainers/${trainer.slug}`);
  revalidatePath("/studio/profile");
  return { ok: true };
}

/**
 * Toggle published flag — trainer self only.
 *
 * Going LIVE: blocked unless the profile is personalised. We require:
 *   - tagline + about (text fields the trainer wrote themselves)
 *   - at least 1 real (non-placeholder) service
 *   - at least 1 certification
 *
 * Placeholder rows from `seed_trainer_placeholders()` don't count — the
 * trainer must have edited at least one service for it to flip
 * `is_placeholder=false`. This stops fresh accounts from publishing
 * "Trening personalny 1:1 — 200 zł" verbatim.
 *
 * Going OFFLINE (unpublish): always allowed, no checks. Returned shape
 * is the same — caller doesn't need to special-case.
 */
export async function togglePublished(): Promise<{ ok: true; published: boolean } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("published, slug, tagline, about")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) return { error: "Nie jesteś trenerem." };

  // Going from published=true → false: unpublish always allowed.
  if (trainer.published) {
    await supabase.from("trainers").update({ published: false }).eq("id", user.id);
    revalidatePath(`/trainers/${trainer.slug}`);
    revalidatePath("/studio/profile");
    revalidatePath("/trainers");
    return { ok: true, published: false };
  }

  // Going offline → live: enforce personalisation gate.
  const missing: string[] = [];
  if (!trainer.tagline || trainer.tagline.trim().length < 10) missing.push("tagline");
  if (!trainer.about || trainer.about.trim().length < 80) missing.push("opis O mnie (min. 80 znaków)");

  const { count: realServiceCount } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", user.id)
    .eq("is_placeholder", false);
  if ((realServiceCount ?? 0) < 1) missing.push("co najmniej 1 spersonalizowana usługa");

  const { count: certCount } = await supabase
    .from("certifications")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", user.id);
  if ((certCount ?? 0) < 1) missing.push("co najmniej 1 certyfikat");

  if (missing.length > 0) {
    return {
      error: `Spersonalizuj profil przed publikacją — brakuje: ${missing.join(", ")}.`,
    };
  }

  await supabase.from("trainers").update({ published: true }).eq("id", user.id);
  revalidatePath(`/trainers/${trainer.slug}`);
  revalidatePath("/studio/profile");
  revalidatePath("/trainers");
  return { ok: true, published: true };
}
