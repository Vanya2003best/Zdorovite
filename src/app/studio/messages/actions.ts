"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true; data?: unknown } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

export async function sendMessage(formData: FormData): Promise<ActionResult> {
  try {
    if (!(formData instanceof FormData)) return { error: "Nieprawidłowe dane formularza." };

    const toId = String(formData.get("to_id") ?? "");
    const text = String(formData.get("text") ?? "").trim();
    if (!toId || !text) return { error: "Pusta wiadomość." };
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

    revalidatePath("/studio/messages");
    revalidatePath(`/studio/messages?with=${toId}`);
    return { ok: true };
  } catch (err) {
    console.error("sendMessage failed", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function markThreadRead(otherId: string): Promise<ActionResult> {
  try {
    if (typeof otherId !== "string" || otherId.trim().length === 0) {
      return { error: "Brak id rozmówcy." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Nie zalogowano." };

    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("to_id", user.id)
      .eq("from_id", otherId)
      .is("read_at", null);
    if (error) return { error: error.message };

    revalidatePath("/studio/messages");
    return { ok: true };
  } catch (err) {
    console.error("markThreadRead failed", err);
    return { error: DEFAULT_ERROR };
  }
}
