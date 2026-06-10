"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error?: string; info?: string } | null;

export async function register(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  // Validate inputs before any I/O — fail fast with a precise message.
  if (!email || !password || !displayName) {
    return { error: "Wypełnij wszystkie pola." };
  }
  if (password.length < 8) {
    return { error: "Hasło musi mieć co najmniej 8 znaków." };
  }

  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${origin}/auth/callback?next=/account`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    // If email confirmation is ON in Supabase, session will be null and user must confirm.
    // If OFF, session is present and user is logged in.
    if (!data.session) {
      return {
        info: "Sprawdź skrzynkę — wysłaliśmy link aktywacyjny. Po potwierdzeniu zaloguj się.",
      };
    }

    redirect("/account");
  } catch (err) {
    // redirect() throws NEXT_REDIRECT — let Next handle it, don't swallow it.
    unstable_rethrow(err);
    console.error("[register] register crashed:", err);
    return { error: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}
