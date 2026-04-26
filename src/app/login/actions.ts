"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome, isPathAllowedForRole, type UserRole } from "@/lib/auth";

export type AuthState = { error: string } | null;

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();

  if (!email || !password) {
    return { error: "Podaj email i hasło." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Resolve role (with fallback to is_trainer if migration 004 not yet applied)
  let role: UserRole = "client";
  const userId = data.user?.id;
  if (userId) {
    const { data: roleRow } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (roleRow?.role) {
      role = roleRow.role as UserRole;
    } else {
      const { data: legacy } = await supabase
        .from("profiles")
        .select("is_trainer")
        .eq("id", userId)
        .maybeSingle();
      role = legacy?.is_trainer ? "trainer" : "client";
    }
  }

  // Honor ?next= only if the path is appropriate for the user's role.
  // Otherwise route to role's home (trainer → /studio, client → /account).
  if (next && next.startsWith("/") && !next.startsWith("//") && isPathAllowedForRole(next, role)) {
    redirect(next);
  }
  redirect(roleHome(role));
}
