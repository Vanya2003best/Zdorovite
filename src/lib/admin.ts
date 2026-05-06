import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin auth — MVP version. Compares the logged-in user's email
 * against a comma-separated whitelist in `ADMIN_EMAILS` (env var,
 * not exposed to the client). Migrating to a DB-backed roles table
 * later is straightforward: only the body of `isAdminEmail` and the
 * `requireAdmin` lookup changes.
 */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminEmails();
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
}

/**
 * Resolve the current user and verify they're on the admin allowlist.
 * Returns `null` for non-admins (caller decides — redirect, 404, etc.).
 */
export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  if (!isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}

/**
 * Service-role Supabase client for admin server actions. Bypasses
 * RLS so we can read/update any trainer's certifications without
 * adding a "admin can read all" RLS policy. The caller MUST have
 * verified admin access via `getAdminUser()` first — this helper
 * doesn't double-check.
 */
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — admin actions require service-role.",
    );
  }
  return createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
