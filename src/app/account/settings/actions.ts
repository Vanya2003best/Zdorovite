"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateProfileResult = { ok: true } | { error: string };
type SignOutResult = { ok: true } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

/**
 * Updates the client's basic profile fields (display_name, phone). Avatars
 * have their own upload flow elsewhere. This action handles the inline
 * /account/settings form only.
 */
export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  try {
    if (!(formData instanceof FormData)) {
      return { error: "Nieprawidłowe dane formularza." };
    }

    const displayName = String(formData.get("display_name") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const phone = phoneRaw === "" ? null : phoneRaw;

    if (displayName.length < 2 || displayName.length > 80) {
      return { error: "Imię i nazwisko: 2-80 znaków." };
    }
    if (phone && !/^[+\d\s\-()]{6,24}$/.test(phone)) {
      return { error: "Numer telefonu wygląda nieprawidłowo." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Brak sesji." };

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, phone })
      .eq("id", user.id);
    if (error) return { error: error.message };

    revalidatePath("/account");
    revalidatePath("/account/settings");
    return { ok: true };
  } catch (err) {
    console.error("[account/settings] updateProfile failed:", err);
    return { error: DEFAULT_ERROR };
  }
}

/** Sign-out: server-side, redirect handled by the caller. */
export async function signOut(): Promise<SignOutResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };

    return { ok: true };
  } catch (err) {
    console.error("[account/settings] signOut failed:", err);
    return { error: DEFAULT_ERROR };
  }
}
