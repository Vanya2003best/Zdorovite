"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

const REPLY_MAX = 2000;

/**
 * Set or clear the trainer's public reply on a single review. RLS allows
 * UPDATE only when `auth.uid() = reviews.trainer_id`, so a malicious user
 * can't reply to someone else's reviews even if they craft the request by
 * hand. The `touch_review_reply_at` trigger keeps `reply_at` in sync —
 * we only have to send `reply_text` from here.
 *
 * Pass an empty string (or whitespace-only) to clear the reply.
 */
export async function setReviewReply(
  reviewId: string,
  text: string,
): Promise<ActionResult> {
  if (!reviewId) return { error: "Brak id opinii." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const trimmed = text.trim();
  if (trimmed.length > REPLY_MAX) {
    return { error: `Odpowiedź zbyt długa (max ${REPLY_MAX} znaków).` };
  }

  // Verify ownership client-side too — RLS would also block, but a precise
  // error message is friendlier than a generic 403.
  const { data: review } = await supabase
    .from("reviews")
    .select("id, trainer_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return { error: "Opinia nie istnieje." };
  if (review.trainer_id !== user.id) {
    return { error: "Nie należy do Ciebie." };
  }

  const { error } = await supabase
    .from("reviews")
    .update({ reply_text: trimmed.length === 0 ? null : trimmed })
    .eq("id", reviewId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  // Refresh the trainer-facing dashboard + the public profile (reply shows
  // under the original review on every template).
  revalidatePath("/studio/reviews");
  revalidatePath("/trainers/[id]", "page");
  revalidatePath("/trainers/[id]/[pageSlug]", "page");
  return { ok: true };
}
