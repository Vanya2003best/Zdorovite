"use server";

import { unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: string; info?: string } | null;

export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Podaj adres email." };
  }

  // Same response whether the account exists or not — no email enumeration.
  const sent = {
    info: "Jeśli konto istnieje, wysłaliśmy link do zmiany hasła. Sprawdź skrzynkę (też spam).",
  };

  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset`,
    });
    if (error) {
      // Rate limits etc. — log for ops, stay generic for the user.
      console.error("[forgot-password] resetPasswordForEmail:", error.message);
    }
    return sent;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[forgot-password] crashed:", err);
    return sent;
  }
}
