"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sendMessage(formData: FormData): Promise<ActionResult> {
  try {
    if (!(formData instanceof FormData)) {
      return { error: "Nieprawidłowe dane formularza." };
    }

    const toId = String(formData.get("to_id") ?? "").trim();
    const text = String(formData.get("text") ?? "").trim();
    if (!toId || !text) return { error: "Pusta wiadomość." };
    if (!UUID_RE.test(toId)) return { error: "Nieprawidłowy odbiorca." };
    if (text.length > 4000) return { error: "Wiadomość zbyt długa (max 4000 znaków)." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Nie zalogowano." };
    if (user.id === toId) return { error: "Nie możesz wysłać wiadomości do siebie." };

    const { error } = await supabase.from("messages").insert({
      from_id: user.id,
      to_id: toId,
      text,
    });
    if (error) return { error: error.message };

    revalidatePath("/account/messages");
    revalidatePath(`/account/messages?with=${toId}`);
    return { ok: true };
  } catch (err) {
    console.error("[account/messages] sendMessage failed:", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function markThreadRead(otherId: string): Promise<ActionResult> {
  try {
    if (typeof otherId !== "string" || !otherId.trim()) {
      return { error: "Brak identyfikatora rozmówcy." };
    }

    const normalizedOtherId = otherId.trim();
    if (!UUID_RE.test(normalizedOtherId)) return { error: "Nieprawidłowy rozmówca." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Nie zalogowano." };

    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("to_id", user.id)
      .eq("from_id", normalizedOtherId)
      .is("read_at", null);
    if (error) return { error: error.message };

    // No revalidatePath here: markThreadRead is invoked during server-
    // component render of /account/messages/page.tsx (right after we fetch
    // the active thread). Next.js disallows revalidatePath in that context.
    // The MessagesBadge uses realtime, so the unread counter updates client-
    // side without needing a cache bust.
    return { ok: true };
  } catch (err) {
    console.error("[account/messages] markThreadRead failed:", err);
    return { error: DEFAULT_ERROR };
  }
}
