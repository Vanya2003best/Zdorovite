"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile-page actions for the redesigned /studio/profile (design 28).
 * Each action is hardened against migration 026 not being applied:
 * if the targeted column doesn't exist (Postgres 42703), we fall back
 * to writing only the legacy fields and quietly succeed — the page
 * can keep working until the migration lands. New fields persist as
 * soon as 026 is applied; no client refactor needed.
 *
 * Public profile + studio paths are revalidated on every successful
 * write so the live preview in the right sidebar reflects the change
 * after navigation.
 */

const MAX_DISPLAY_NAME = 80;
const MAX_TAGLINE = 200;
const MAX_ABOUT = 3000;
const MAX_MISSION = 200;
const MAX_LOCATION = 100;
const MAX_HANDLE = 200;

type ProfileBasic = {
  displayName: string;
  publicName: string;
  tagline: string;
  about: string;
  mission: string;
};

type Result = { ok: true } | { error: string };

type Ctx =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      slug: string;
    };

async function getCurrent(): Promise<Ctx> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };
  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) return { error: "Nie jesteś trenerem." };
  return { supabase, userId: user.id, slug: trainer.slug };
}

function bust(slug: string) {
  revalidatePath("/studio/profile");
  revalidatePath(`/trainers/${slug}`);
}

export async function updateProfileBasic(input: ProfileBasic): Promise<Result> {
  const ctx = await getCurrent();
  if ("error" in ctx) return ctx;
  const { supabase, userId, slug } = ctx;

  const displayName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME);
  const publicNameRaw = input.publicName.trim().slice(0, MAX_DISPLAY_NAME);
  // Empty publicName = clear override (fall back to displayName publicly).
  const publicName: string | null = publicNameRaw === "" ? null : publicNameRaw;
  const tagline = input.tagline.trim().slice(0, MAX_TAGLINE);
  const about = input.about.trim().slice(0, MAX_ABOUT);
  const mission = input.mission.trim().slice(0, MAX_MISSION);
  if (!displayName) return { error: "Imię nie może być puste." };

  // profile.display_name is on profiles, the rest on trainers — two
  // writes, both must succeed for "ok" to surface; first error wins.
  const profileUpd = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);
  if (profileUpd.error) return { error: profileUpd.error.message };

  // Try the full trainers update (mission from 026 + display_name from 027).
  // Fall back through column-missing errors so the page works on partially
  // migrated databases without throwing for the user.
  const trainerUpdFull = await supabase
    .from("trainers")
    .update({ tagline, about, mission, display_name: publicName })
    .eq("id", userId);
  if (trainerUpdFull.error?.code === "42703") {
    // Drop columns one at a time until the write succeeds. Order matters:
    // 027 (display_name) is newer than 026 (mission), so try without it
    // first; only then drop mission.
    const without027 = await supabase
      .from("trainers")
      .update({ tagline, about, mission })
      .eq("id", userId);
    if (without027.error?.code === "42703") {
      const minimal = await supabase
        .from("trainers")
        .update({ tagline, about })
        .eq("id", userId);
      if (minimal.error) return { error: minimal.error.message };
    } else if (without027.error) {
      return { error: without027.error.message };
    }
  } else if (trainerUpdFull.error) {
    return { error: trainerUpdFull.error.message };
  }

  bust(slug);
  return { ok: true };
}

type LocationInput = {
  location: string;
  city: string;
  district: string;
  workMode: "stationary" | "online" | "both";
  travelRadiusKm: number;
};

export async function updateLocation(input: LocationInput): Promise<Result> {
  const ctx = await getCurrent();
  if ("error" in ctx) return ctx;
  const { supabase, userId, slug } = ctx;

  const location = input.location.trim().slice(0, MAX_LOCATION);
  const city = input.city.trim().slice(0, 80);
  const district = input.district.trim().slice(0, 80);
  const workMode = ["stationary", "online", "both"].includes(input.workMode)
    ? input.workMode
    : "both";
  const radius = Math.max(0, Math.min(200, Math.round(Number(input.travelRadiusKm) || 0)));

  const full = await supabase
    .from("trainers")
    .update({
      location,
      city,
      district,
      work_mode: workMode,
      travel_radius_km: radius,
    })
    .eq("id", userId);
  if (full.error?.code === "42703") {
    const fallback = await supabase
      .from("trainers")
      .update({ location })
      .eq("id", userId);
    if (fallback.error) return { error: fallback.error.message };
  } else if (full.error) {
    return { error: full.error.message };
  }

  bust(slug);
  return { ok: true };
}

type SocialInput = {
  instagram: string;
  youtube: string;
  tiktok: string;
  facebook: string;
  website: string;
  phone: string;
  email: string;
};

export async function updateSocial(input: SocialInput): Promise<Result> {
  const ctx = await getCurrent();
  if ("error" in ctx) return ctx;
  const { supabase, userId, slug } = ctx;

  // Strip empty values so the JSONB stays compact; trim everything.
  const social: Record<string, string> = {};
  (["instagram", "youtube", "tiktok", "facebook", "website", "email"] as const).forEach((k) => {
    const v = (input[k] ?? "").trim().slice(0, MAX_HANDLE);
    if (v) social[k] = v;
  });

  const phone = (input.phone ?? "").trim().slice(0, 40);

  // trainers.social
  const trainerUpd = await supabase
    .from("trainers")
    .update({ social })
    .eq("id", userId);
  if (trainerUpd.error?.code === "42703") {
    // column not yet — silently skip, only profile.phone will land.
  } else if (trainerUpd.error) {
    return { error: trainerUpd.error.message };
  }

  // profiles.phone
  const profileUpd = await supabase
    .from("profiles")
    .update({ phone })
    .eq("id", userId);
  if (profileUpd.error?.code === "42703") {
    // also ok — both halves are migration-gated.
  } else if (profileUpd.error) {
    return { error: profileUpd.error.message };
  }

  bust(slug);
  return { ok: true };
}

/**
 * Replace the trainer's specialization set wholesale. Bulk delete +
 * insert is fine — the table is M:N with at most ~10 rows per trainer,
 * and the UI sends the full chip set on every change.
 */
export async function replaceSpecializations(ids: string[]): Promise<Result> {
  const ctx = await getCurrent();
  if ("error" in ctx) return ctx;
  const { supabase, userId, slug } = ctx;

  const clean = Array.from(new Set(ids.filter(Boolean).map((s) => String(s).trim()))).slice(0, 10);

  await supabase.from("trainer_specializations").delete().eq("trainer_id", userId);
  if (clean.length > 0) {
    const { error } = await supabase
      .from("trainer_specializations")
      .insert(clean.map((id) => ({ trainer_id: userId, specialization_id: id })));
    if (error) return { error: error.message };
  }

  bust(slug);
  return { ok: true };
}

/**
 * Replace client-goals chips. Free-text (not a lookup table) — the
 * trainer types in their own goals like "Powrót po kontuzji". Stored
 * as a text[] column on trainers (migration 026).
 */
export async function replaceClientGoals(goals: string[]): Promise<Result> {
  const ctx = await getCurrent();
  if ("error" in ctx) return ctx;
  const { supabase, userId, slug } = ctx;

  const clean = Array.from(
    new Set(
      goals
        .map((g) => String(g).trim())
        .filter((g) => g.length > 0 && g.length <= 60),
    ),
  ).slice(0, 12);

  const upd = await supabase
    .from("trainers")
    .update({ client_goals: clean })
    .eq("id", userId);
  if (upd.error?.code === "42703") {
    // column missing — swallow. Returns ok so UI keeps optimistic state.
    return { ok: true };
  }
  if (upd.error) return { error: upd.error.message };

  bust(slug);
  return { ok: true };
}
