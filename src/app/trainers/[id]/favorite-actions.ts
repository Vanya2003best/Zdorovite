"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ToggleFavoriteResult = { isFavorite: boolean } | { error: string };

/**
 * Toggle the current user's favorite status for the given trainer (by slug).
 * Returns the NEW state on success — the client uses it to confirm the
 * optimistic update.
 *
 * Trainer accounts can't favorite (it's a client feature) — we let the
 * RLS policy reject the insert and surface the error if a trainer
 * somehow ends up calling this.
 */
export async function toggleFavorite(slug: string): Promise<ToggleFavoriteResult> {
  if (!slug) return { error: "Brak identyfikatora trenera." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany." };

  // Resolve slug → trainer.id (uuid). The trainers RLS lets anyone read
  // published rows, so this works for any logged-in user.
  const { data: trainer, error: trainerErr } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (trainerErr) return { error: trainerErr.message };
  if (!trainer) return { error: "Trener nie istnieje." };

  // Try to delete first; if a row was removed we know the user had it
  // favorited and we're done. If nothing was deleted, insert it.
  const { data: deleted, error: delErr } = await supabase
    .from("client_favorites")
    .delete()
    .eq("client_id", user.id)
    .eq("trainer_id", trainer.id)
    .select("trainer_id");
  if (delErr) return { error: delErr.message };

  let newState: boolean;
  if (deleted && deleted.length > 0) {
    newState = false;
  } else {
    const { error: insErr } = await supabase
      .from("client_favorites")
      .insert({ client_id: user.id, trainer_id: trainer.id });
    if (insErr) return { error: insErr.message };
    newState = true;
  }

  // Refresh anywhere the favorite state is rendered.
  revalidatePath(`/trainers/${slug}`);
  revalidatePath("/trainers");
  revalidatePath("/account");

  return { isFavorite: newState };
}
