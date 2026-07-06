// Shared trainer-onboarding completion.
//
// Two entry points create a trainer profile from the signup wizard data:
//   1. register/trainer/actions.ts — "Confirm email" OFF in Supabase Auth:
//      signUp returns a session and the action completes onboarding at once.
//   2. auth/callback/route.ts — "Confirm email" ON: signUp has no session,
//      so the wizard data rides along in user_metadata
//      (options.data.trainer_onboarding). After the user clicks the
//      confirmation link, the callback finds the metadata and completes
//      onboarding with the fresh session.
//
// Both paths run with the USER's own session, so every write goes through
// RLS as the trainer themselves: profiles update-own (001), trainers
// insert/update-self (001), trainer_branches "insert self" with
// status='self_claimed' (021).

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TrainerOnboardingData = {
  display_name: string;
  slug: string;
  tagline: string;
  location: string;
  experience: number;
  price_from: number;
  specializations: string[];
  languages: string[];
  /** Composite "<chain-slug>-<branch-slug>" from the /sieci/[chain]/[branch]
   *  recruiting CTA (Zdrofit funnel). Optional. */
  branch?: string;
};

const BRANCH_PARAM_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

/** Validates a raw ?branch= query/form value; returns it or undefined. */
export function sanitizeBranchParam(raw: unknown): string | undefined {
  const value = typeof raw === "string" ? raw.trim() : "";
  return BRANCH_PARAM_RE.test(value) ? value : undefined;
}

/**
 * Extracts + validates trainer onboarding data from user_metadata.
 * Returns null when the metadata is absent or too incomplete to build a
 * profile (same required set the signup wizard enforces).
 */
export function parseTrainerOnboarding(
  meta: unknown,
): TrainerOnboardingData | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>).trainer_onboarding;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  const data: TrainerOnboardingData = {
    display_name: str(o.display_name),
    slug: str(o.slug),
    tagline: str(o.tagline),
    location: str(o.location),
    experience: Math.max(0, Math.min(60, num(o.experience, 1))),
    price_from: Math.max(0, Math.min(10000, num(o.price_from, 100))),
    specializations: strArr(o.specializations),
    languages: strArr(o.languages),
  };
  const branch = sanitizeBranchParam(o.branch);
  if (branch) data.branch = branch;

  if (
    !data.display_name ||
    data.slug.length < 3 ||
    !data.tagline ||
    !data.location ||
    data.specializations.length === 0 ||
    data.languages.length === 0
  ) {
    return null;
  }
  return data;
}

/**
 * Creates/completes the trainer profile: profiles.role → trainer, trainers
 * row, specializations, default availability, optional branch affiliation.
 * Idempotent — safe to call again for the same user (upserts/replaces).
 */
export async function completeTrainerOnboarding(
  supabase: Supabase,
  userId: string,
  data: TrainerOnboardingData,
): Promise<{ error?: string }> {
  // 1. The handle_new_user trigger already created the profiles row — flip role.
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ role: "trainer", display_name: data.display_name })
    .eq("id", userId);
  if (profErr) {
    console.error("[trainer-onboarding] profiles update failed:", profErr);
    return { error: "Coś poszło nie tak przy tworzeniu profilu. Spróbuj ponownie." };
  }

  // 2. The slug may have been claimed between signUp and email confirmation —
  //    fall back to a suffixed variant instead of dying on the unique index.
  let slug = data.slug;
  const { data: slugOwner } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugOwner && slugOwner.id !== userId) {
    slug = `${slug}-${userId.replace(/-/g, "").slice(0, 6)}`.slice(0, 48);
  }

  const { error: tErr } = await supabase.from("trainers").upsert(
    {
      id: userId,
      slug,
      tagline: data.tagline,
      about: "",
      experience: data.experience,
      price_from: data.price_from,
      location: data.location,
      languages: data.languages,
      published: true,
    },
    { onConflict: "id" },
  );
  if (tErr) {
    console.error("[trainer-onboarding] trainers upsert failed:", tErr);
    return { error: "Coś poszło nie tak przy tworzeniu profilu. Spróbuj ponownie." };
  }

  // 3. Specializations — replace wholesale (idempotent).
  await supabase.from("trainer_specializations").delete().eq("trainer_id", userId);
  if (data.specializations.length > 0) {
    const { error: specErr } = await supabase.from("trainer_specializations").insert(
      data.specializations.map((s) => ({ trainer_id: userId, specialization_id: s })),
    );
    if (specErr) {
      console.error("[trainer-onboarding] specializations insert failed:", specErr);
    }
  }

  // 4. Default availability Mon–Fri 09:00–18:00 (only when none exists yet).
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

  // 5. Zdrofit funnel: record the pending club affiliation. Best-effort —
  //    a broken/stale branch param must never block account creation.
  if (data.branch) {
    await linkTrainerToBranch(supabase, userId, data.branch);
  }

  return {};
}

/**
 * Resolves the composite "<chain-slug>-<branch-slug>" (both halves may
 * themselves contain hyphens, so every hyphen split point is tested) and
 * records a PENDING affiliation: trainer_branches.status='self_claimed' —
 * the schema's pre-verification state (migration 021), upgraded to
 * 'verified' by an admin later. RLS "trainer_branches insert self" allows
 * exactly this write for the trainer's own session; RLS on gym_branches
 * only exposes status='active' branches, so pending clubs can't be claimed.
 */
async function linkTrainerToBranch(
  supabase: Supabase,
  trainerId: string,
  composite: string,
): Promise<void> {
  try {
    // Candidate chain slugs = every hyphen-prefix of the composite param.
    const prefixes: string[] = [];
    for (let i = composite.indexOf("-"); i !== -1; i = composite.indexOf("-", i + 1)) {
      prefixes.push(composite.slice(0, i));
    }
    if (prefixes.length === 0) return;

    const { data: chains } = await supabase
      .from("gym_chains")
      .select("id, slug")
      .in("slug", prefixes);

    for (const chain of chains ?? []) {
      const branchSlug = composite.slice(chain.slug.length + 1);
      if (!branchSlug) continue;
      const { data: branch } = await supabase
        .from("gym_branches")
        .select("id")
        .eq("chain_id", chain.id)
        .eq("slug", branchSlug)
        .maybeSingle();
      if (!branch) continue;

      // ON CONFLICT DO NOTHING — re-running onboarding must not clobber an
      // affiliation an admin already verified (RLS forbids the update anyway).
      const { error } = await supabase.from("trainer_branches").upsert(
        { trainer_id: trainerId, branch_id: branch.id, status: "self_claimed" },
        { onConflict: "trainer_id,branch_id", ignoreDuplicates: true },
      );
      if (error) {
        console.error("[trainer-onboarding] branch affiliation insert failed:", error);
      }
      return;
    }

    console.warn(
      `[trainer-onboarding] branch param "${composite}" did not resolve to a known branch — skipping affiliation`,
    );
  } catch (err) {
    console.error("[trainer-onboarding] linkTrainerToBranch crashed:", err);
  }
}
