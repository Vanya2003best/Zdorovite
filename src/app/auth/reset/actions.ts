"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";
import { getCurrentUser, roleHome } from "@/lib/auth";

export type ResetState = { error: string } | null;

export async function setNewPassword(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Hasło musi mieć co najmniej 8 znaków." };
  }
  if (password !== confirm) {
    return { error: "Hasła nie są takie same." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // The recovery session may have expired — send the user back for a fresh link.
      if (/session/i.test(error.message)) {
        redirect("/forgot-password");
      }
      return { error: translateAuthError(error) };
    }

    const cu = await getCurrentUser();
    // No session after the update (edge case) → login page with the green
    // "hasło zmienione" banner instead of a silent, unexplained login form.
    redirect(cu ? roleHome(cu.profile.role) : "/login?reset=1");
  } catch (err) {
    unstable_rethrow(err);
    console.error("[auth/reset] crashed:", err);
    return { error: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}
