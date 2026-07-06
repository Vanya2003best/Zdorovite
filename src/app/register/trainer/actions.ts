"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";
import {
  completeTrainerOnboarding,
  sanitizeBranchParam,
  type TrainerOnboardingData,
} from "./onboarding";

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
  // Zdrofit funnel: branch landing links here with ?branch=<chain>-<branch>,
  // the form carries it through as a hidden field.
  const branch = sanitizeBranchParam(formData.get("branch"));

  // Validation
  if (!email || !password) return { error: "Email i hasło są wymagane." };
  if (password.length < 8) return { error: "Hasło min. 8 znaków." };
  if (!displayName) return { error: "Podaj imię i nazwisko." };
  if (slug.length < 3) return { error: "Adres profilu min. 3 znaki." };
  if (!tagline) return { error: "Krótki opis (tagline) jest wymagany." };
  if (specializations.length === 0) return { error: "Wybierz co najmniej jedną specjalizację." };
  if (!location) return { error: "Podaj miasto." };
  if (languages.length === 0) return { error: "Wybierz co najmniej jeden język." };

  const onboarding: TrainerOnboardingData = {
    display_name: displayName,
    slug,
    tagline,
    location,
    experience,
    price_from: priceFrom,
    specializations,
    languages,
    ...(branch ? { branch } : {}),
  };

  try {
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

    // Sign up. The full onboarding payload rides in user_metadata so that
    // when "Confirm email" is ON (no session here), /auth/callback can
    // finish the trainer profile after the user clicks the link — nothing
    // the wizard collected gets lost.
    const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, trainer_onboarding: onboarding },
        emailRedirectTo: `${origin}/auth/callback?next=/studio`,
      },
    });
    if (signUpErr) return { error: translateAuthError(signUpErr) };

    // Email confirmation ON → no session yet. The metadata path takes over
    // in /auth/callback once the user confirms.
    if (!signUp.session) {
      return {
        info: "Sprawdź skrzynkę — wysłaliśmy link aktywacyjny. Po kliknięciu Twój profil trenera będzie gotowy i wylądujesz w Studio.",
      };
    }

    // We have a session — finish onboarding now.
    const userId = signUp.user!.id;
    const result = await completeTrainerOnboarding(supabase, userId, onboarding);
    if (result.error) return { error: result.error };

    // Profile is in the DB — drop the metadata copy so callback/logins
    // never re-run onboarding from stale data.
    await supabase.auth.updateUser({ data: { trainer_onboarding: null } });

    // New trainers land on the onboarding wizard so they don't drown in
    // the empty /studio with no guidance. The wizard collapses naturally
    // as they fill in fields and disappears once they hit 100%.
    redirect("/studio/start?welcome=1");
  } catch (err) {
    // redirect() throws NEXT_REDIRECT — let Next handle it, don't swallow it.
    unstable_rethrow(err);
    console.error("[register-trainer] registerTrainer crashed:", err);
    return { error: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}
