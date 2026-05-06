"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type TrainerSignupState = { error?: string; info?: string } | null;

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

export async function registerTrainer(
  _prev: TrainerSignupState,
  formData: FormData,
): Promise<TrainerSignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const experience = Math.max(0, Math.min(60, Number(formData.get("experience") ?? 1)));
  const priceFrom = Math.max(0, Math.min(10000, Number(formData.get("price_from") ?? 100)));
  const specializations = formData.getAll("specializations").map(String);
  const languages = LANGS.filter((l) => formData.get(`lang_${l}`) === "on");
  const slug = slugify(slugRaw || displayName);

  // Validation
  if (!email || !password) return { error: "Email i hasło są wymagane." };
  if (password.length < 8) return { error: "Hasło min. 8 znaków." };
  if (!displayName) return { error: "Podaj imię i nazwisko." };
  if (slug.length < 3) return { error: "Adres profilu min. 3 znaki." };
  if (!tagline) return { error: "Krótki opis (tagline) jest wymagany." };
  if (specializations.length === 0) return { error: "Wybierz co najmniej jedną specjalizację." };
  if (!location) return { error: "Podaj miasto." };
  if (languages.length === 0) return { error: "Wybierz co najmniej jeden język." };

  const supabase = await createClient();

  // Check slug uniqueness BEFORE creating user
  const { data: slugTaken } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugTaken) return { error: `Adres profilu „${slug}" jest już zajęty — wybierz inny.` };

  // Build redirect for email confirmation (if enabled in Supabase)
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  // Sign up
  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=/studio`,
    },
  });
  if (signUpErr) return { error: signUpErr.message };

  // If email confirmation is on, no session yet — user must confirm. Save trainer onboarding for callback flow.
  if (!signUp.session) {
    return {
      info: "Sprawdź skrzynkę — wysłaliśmy link aktywacyjny. Po potwierdzeniu zaloguj się i dokończ profil.",
    };
  }

  // We have a session — finish onboarding now
  const userId = signUp.user!.id;

  // The handle_new_user trigger created profile row; bring is_trainer=true
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ role: "trainer", display_name: displayName })
    .eq("id", userId);
  if (profErr) return { error: profErr.message };

  // Insert trainers row
  const { error: tErr } = await supabase.from("trainers").upsert(
    {
      id: userId,
      slug,
      tagline,
      about: "",
      experience,
      price_from: priceFrom,
      location,
      languages,
      published: true,
    },
    { onConflict: "id" },
  );
  if (tErr) return { error: tErr.message };

  // Specializations
  await supabase.from("trainer_specializations").delete().eq("trainer_id", userId);
  await supabase.from("trainer_specializations").insert(
    specializations.map((s) => ({ trainer_id: userId, specialization_id: s })),
  );

  // Default availability Mon-Fri 09:00-18:00
  const { data: existingAvail } = await supabase
    .from("availability_rules")
    .select("id")
    .eq("trainer_id", userId)
    .limit(1);
  if (!existingAvail || existingAvail.length === 0) {
    await supabase.from("availability_rules").insert(
      [1, 2, 3, 4, 5].map((dow) => ({
        trainer_id: userId,
        day_of_week: dow,
        start_time: "09:00",
        end_time: "18:00",
      })),
    );
  }

  // New trainers land on the onboarding wizard so they don't drown in
  // the empty /studio with no guidance. The wizard collapses naturally
  // as they fill in fields and disappears once they hit 100%.
  redirect("/studio/start?welcome=1");
}
