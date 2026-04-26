"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(formData: FormData): Promise<{ ok: true } | { error: string }> {
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
}

export async function markThreadRead(otherId: string): Promise<void> {
  if (!otherId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("to_id", user.id)
    .eq("from_id", otherId)
    .is("read_at", null);

  revalidatePath("/studio/messages");
}
