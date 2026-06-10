"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Starts the Google OAuth flow. Supabase redirects back to
// /auth/callback?code=…&next=…, which exchanges the code for a session.
// The provider must be enabled in Supabase (and NEXT_PUBLIC_AUTH_GOOGLE=1
// must be set for the button to render at all).
export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "").trim();
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    });

    if (error || !data.url) {
      console.error("[oauth] signInWithOAuth failed:", error);
      redirect("/login?error=oauth_failed");
    }
    redirect(data.url);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[oauth] google sign-in crashed:", err);
    redirect("/login?error=oauth_failed");
  }
}
