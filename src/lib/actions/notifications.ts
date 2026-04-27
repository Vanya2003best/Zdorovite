"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

/** Mark one notification as read. RLS enforces ownership. */
export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  if (!notificationId) return { error: "Brak identyfikatora powiadomienia." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { ok: true };
}

/** Mark every unread notification for the current user. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { ok: true };
}
