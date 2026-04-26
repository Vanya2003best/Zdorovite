"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BecomeTrainerState = { error?: string } | null;

const LANGS = ["Polski", "Angielski", "Niemiecki", "Ukraiński", "Rosyjski", "Hiszpański"];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function becomeTrainer(
  _prev: BecomeTrainerState,
  formData: FormData,
): Promise<BecomeTrainerState> {
  const slug = slugify(String(formData.get("slug") ?? ""));
  const tagline = String(formData.get("tagline") ?? "").trim();
  const about = String(formData.get("about") ?? "").trim();
  const experienceRaw = Number(formData.get("experience") ?? 0);
  const priceFromRaw = Number(formData.get("price_from") ?? 0);
  const location = String(formData.get("location") ?? "").trim();
  const specializations = formData.getAll("specializations").map(String);
  const languages = LANGS.filter((l) => formData.get(`lang_${l}`) === "on");

  if (!slug || slug.length < 3) return { error: "Slug musi mieć co najmniej 3 znaki (a-z, 0-9, '-')." };
  if (!tagline) return { error: "Krótki opis (tagline) jest wymagany." };
  if (specializations.length === 0) return { error: "Wybierz co najmniej jedną specjalizację." };
  if (!location) return { error: "Podaj miasto / dzielnicę." };
  if (priceFromRaw < 0 || priceFromRaw > 10000) return { error: "Cena od 0 do 10 000 zł." };
  if (experienceRaw < 0 || experienceRaw > 60) return { error: "Doświadczenie w latach (0–60)." };
  if (languages.length === 0) return { error: "Wybierz co najmniej jeden język." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/become-trainer");

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing && existing.id !== user.id) {
    return { error: `Slug "${slug}" jest już zajęty — wybierz inny.` };
  }

  // Insert/update trainer row
  const { error: trainerErr } = await supabase.from("trainers").upsert(
    {
      id: user.id,
      slug,
      tagline,
      about,
      experience: experienceRaw,
      price_from: priceFromRaw,
      location,
      languages,
      published: true,
    },
    { onConflict: "id" },
  );
  if (trainerErr) return { error: trainerErr.message };

  // Update profile.is_trainer
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ role: "trainer" })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  // Replace trainer_specializations
  await supabase.from("trainer_specializations").delete().eq("trainer_id", user.id);
  const { error: specErr } = await supabase.from("trainer_specializations").insert(
    specializations.map((s) => ({ trainer_id: user.id, specialization_id: s })),
  );
  if (specErr) return { error: specErr.message };

  // Default availability: Mon-Fri 09:00-18:00 (if not already set)
  const { data: existingRules } = await supabase
    .from("availability_rules")
    .select("id")
    .eq("trainer_id", user.id)
    .limit(1);
  if (!existingRules || existingRules.length === 0) {
    await supabase.from("availability_rules").insert(
      [1, 2, 3, 4, 5].map((dow) => ({
        trainer_id: user.id,
        day_of_week: dow,
        start_time: "09:00",
        end_time: "18:00",
      })),
    );
  }

  revalidatePath("/studio/bookings");
  revalidatePath(`/trainers/${slug}`);
  revalidatePath("/trainers");
  redirect("/studio/bookings?welcome=1");
}
