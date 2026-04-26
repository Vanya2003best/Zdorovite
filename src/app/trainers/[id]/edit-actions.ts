"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("trainers").update(patch).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/trainers/${trainer.slug}`);
  revalidatePath("/studio/profile");
  return { ok: true };
}

/** Toggle published flag — trainer self only. */
export async function togglePublished(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: trainer } = await supabase
    .from("trainers")
    .select("published, slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) return;

  await supabase
    .from("trainers")
    .update({ published: !trainer.published })
    .eq("id", user.id);

  revalidatePath(`/trainers/${trainer.slug}`);
  revalidatePath("/studio/profile");
  revalidatePath("/trainers");
}
