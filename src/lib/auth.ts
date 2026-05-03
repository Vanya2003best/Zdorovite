import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type UserRole = "client" | "trainer" | "admin";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  /** CSS object-position for the avatar (e.g. "30% 45%"). Set via drag-pan
   *  on /studio/profile. Null = default centering. Lives behind migration
   *  020; absent column → falls back to null and centering. */
  avatar_focal: string | null;
  role: UserRole;
  is_trainer: boolean; // legacy mirror, kept while migrating
};

export type CurrentUser = {
  user: User;
  profile: Profile;
};

/**
 * Returns auth user + profile, or null if not signed in.
 * Use this when you need to handle BOTH guest and signed-in cases (e.g. Header).
 *
 * Falls back to legacy is_trainer column if the role column doesn't exist yet
 * (i.e. migration 004 hasn't been applied).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Preferred: role column from migration 004 + avatar_focal from migration 020
  const withFocal = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, avatar_focal, role, is_trainer")
    .eq("id", user.id)
    .maybeSingle();

  if (!withFocal.error && withFocal.data) {
    return { user, profile: withFocal.data as Profile };
  }

  // Fallback when migration 020 isn't applied (avatar_focal column missing):
  // retry without it. We still try the `role` column from migration 004.
  if (withFocal.error?.code === "42703") {
    const { data: withRole, error: roleErr } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role, is_trainer")
      .eq("id", user.id)
      .maybeSingle();
    if (!roleErr && withRole) {
      return {
        user,
        profile: { ...withRole, avatar_focal: null } as Profile,
      };
    }
  }

  // Final fallback: legacy schema (no role column yet) — synthesize role from is_trainer
  const { data: legacy } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, is_trainer")
    .eq("id", user.id)
    .maybeSingle();
  if (!legacy) return null;
  return {
    user,
    profile: {
      id: legacy.id,
      display_name: legacy.display_name,
      avatar_url: legacy.avatar_url,
      avatar_focal: null,
      role: legacy.is_trainer ? "trainer" : "client",
      is_trainer: legacy.is_trainer ?? false,
    },
  };
}

/**
 * Throws redirect to /login if not signed in.
 * Use this at the top of any page or server action that requires auth.
 *
 * @param next  Path to return to after login (defaults to current — pass it manually).
 */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const cu = await getCurrentUser();
  if (!cu) {
    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/login${q}`);
  }
  return cu;
}

/**
 * Throws redirect if user is not signed in OR if their role is not in the allowed list.
 * Mirrors education-platform's RoleChecker dependency.
 *
 *   const me = await requireRole(["trainer", "admin"], "/studio");
 *
 * If the user is signed in but with a different role, they're sent to their natural home:
 *   - client → /account
 *   - trainer/admin → /studio
 *   - guest → /login?next=...
 */
export async function requireRole(
  allowed: UserRole[],
  next?: string,
): Promise<CurrentUser> {
  const cu = await requireUser(next);
  if (!allowed.includes(cu.profile.role)) {
    redirect(roleHome(cu.profile.role));
  }
  return cu;
}

/** Trainer or admin. */
export async function requireTrainer(next?: string): Promise<CurrentUser> {
  return requireRole(["trainer", "admin"], next);
}

/** Admin only. */
export async function requireAdmin(next?: string): Promise<CurrentUser> {
  return requireRole(["admin"], next);
}

/** Client (regular user). */
export async function requireClient(next?: string): Promise<CurrentUser> {
  return requireRole(["client", "admin"], next);
}

/** Where each role's "home" lives — used for post-login redirects + role mismatches. */
export function roleHome(role: UserRole): string {
  switch (role) {
    case "trainer":
    case "admin":
      return "/studio";
    case "client":
    default:
      return "/account";
  }
}

/**
 * Returns true if a path is appropriate for the given role.
 * Used by login `?next=` so trainers don't get pushed to /account paths and vice versa.
 *
 * Public paths (catalog, trainer profiles, login itself) are always allowed.
 */
export function isPathAllowedForRole(path: string, role: UserRole): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("/studio")) return role === "trainer" || role === "admin";
  if (path.startsWith("/account")) return role === "client" || role === "admin";
  // Anything else (/, /trainers, /trainers/[slug], /trainers/[slug]/book, /login, /register/*) is public
  return true;
}

/** Convenience boolean checks for conditional UI in server components. */
export function isTrainer(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === "trainer" || profile.role === "admin";
}

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin";
}
