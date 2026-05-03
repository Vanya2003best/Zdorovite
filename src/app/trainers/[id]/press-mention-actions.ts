"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * CRUD for SignatureProfile press_mentions — the curated "what publications
 * have written about me" cards. Same shape as membership-tier-actions but
 * without the featured-toggle (all press cards are equal — order is the
 * editorial signal, not "featured").
 */

export type ActionResult = { ok: true } | { error: string };

export async function addPressMention(): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const { data: existing } = await supabase
    .from("press_mentions")
    .select("position")
    .eq("trainer_id", user.id);
  const nextPos = existing?.length ?? 0;

  const { data, error } = await supabase
    .from("press_mentions")
    .insert({
      trainer_id: user.id,
      position: nextPos,
      publication: "PUBLIKACJA",
      quote: `„Tu wstaw cytat z artykułu, który Cię opisał..."`,
      meta: "Wydanie · Recenzja",
      publication_style: "bold",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true, id: data.id };
}

export async function removePressMention(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const { error } = await supabase
    .from("press_mentions")
    .delete()
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

type PressField = "publication" | "quote" | "meta";

export async function updatePressMentionField(
  id: string,
  field: PressField,
  value: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const { error } = await supabase
    .from("press_mentions")
    .update({ [field]: value })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

/** Switch publication name styling between editorial-italic-serif (Vogue,
 *  Elle, Glamour) and bold-uppercase-wordmark (FORBES, WOMEN'S HEALTH). */
export async function setPressMentionStyle(
  id: string,
  style: "serif" | "bold",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const { error } = await supabase
    .from("press_mentions")
    .update({ publication_style: style })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}
