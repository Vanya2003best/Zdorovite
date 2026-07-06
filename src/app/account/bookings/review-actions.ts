"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  isReviewCategoryKey,
} from "@/lib/db/reviews";

/**
 * Client-side review creation — the missing write half of the review
 * loop (client → /studio/reviews inbox → trainer reply → public
 * profile). Inserts run under the caller's session, so BOTH review
 * policies apply: 001's "insert author" (author_id = auth.uid())
 * AND 032's restrictive "insert completed booking only" (booking_id
 * must be the caller's own completed booking with that trainer).
 */

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreateReviewResult = { ok: true } | { error: string };

export async function createReview(input: {
  bookingId: string;
  rating: number;
  text: string;
  /** Optional chips — subset of REVIEW_CATEGORIES keys. */
  categories?: string[];
}): Promise<CreateReviewResult> {
  try {
    // ---- shape validation (server is the source of truth) ----
    if (!input || typeof input !== "object") {
      return { error: "Nieprawidłowe dane formularza." };
    }
    const bookingId = String(input.bookingId ?? "").trim();
    if (!UUID_RE.test(bookingId)) {
      return { error: "Nieprawidłowy identyfikator rezerwacji." };
    }
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: "Ocena musi być liczbą od 1 do 5." };
    }
    const text = String(input.text ?? "").trim();
    if (text.length < REVIEW_TEXT_MIN) {
      return { error: `Opinia musi mieć co najmniej ${REVIEW_TEXT_MIN} znaków.` };
    }
    if (text.length > REVIEW_TEXT_MAX) {
      return { error: `Opinia może mieć maksymalnie ${REVIEW_TEXT_MAX} znaków.` };
    }
    const categories = Array.from(
      new Set((Array.isArray(input.categories) ? input.categories : []).map(String)),
    ).filter(isReviewCategoryKey);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Musisz być zalogowany." };

    // ---- the booking must be the caller's own finished session ----
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, client_id, trainer_id, status, end_time")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingErr) {
      console.error("[account/bookings] createReview booking read failed:", bookingErr);
      return { error: DEFAULT_ERROR };
    }
    if (!booking) return { error: "Nie znaleziono rezerwacji." };
    if (booking.client_id !== user.id) {
      return { error: "Ta rezerwacja nie należy do Ciebie." };
    }
    if (booking.status === "cancelled") {
      return { error: "Nie można ocenić anulowanej sesji." };
    }

    if (booking.status !== "completed") {
      const ended = new Date(booking.end_time) <= new Date();
      const finishable = booking.status === "confirmed" || booking.status === "paid";
      if (!ended || !finishable) {
        return { error: "Opinię wystawisz po zakończeniu sesji." };
      }
      // History (and reality) treat past paid/confirmed sessions as done,
      // but 032's INSERT policy demands status='completed'. Promote the
      // booking first — the same transition /studio/sesja performs when
      // the trainer closes a session; "bookings update participant"
      // RLS allows the client to do it for their own row.
      const { error: promoteErr } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", bookingId)
        .eq("client_id", user.id);
      if (promoteErr) {
        console.error("[account/bookings] createReview promote failed:", promoteErr);
        return { error: DEFAULT_ERROR };
      }
    }

    // ---- friendly duplicate check (unique constraints would reject anyway:
    //      one review per booking + one per client-trainer pair) ----
    const { data: existing } = await supabase
      .from("reviews")
      .select("id, booking_id")
      .eq("author_id", user.id)
      .eq("trainer_id", booking.trainer_id)
      .maybeSingle();
    if (existing) {
      return {
        error:
          existing.booking_id === bookingId
            ? "Ta sesja ma już Twoją opinię."
            : "Masz już opinię u tego trenera — możesz wystawić jedną opinię na trenera.",
      };
    }

    const { error: insertErr } = await supabase.from("reviews").insert({
      trainer_id: booking.trainer_id,
      author_id: user.id,
      booking_id: bookingId,
      rating,
      text,
      // Selected chip = "this aspect stood out": store the overall rating
      // in that category column; NULL keeps the bar hidden in /studio/reviews.
      cat_wiedza: categories.includes("wiedza") ? rating : null,
      cat_atmosfera: categories.includes("atmosfera") ? rating : null,
      cat_punktualnosc: categories.includes("punktualnosc") ? rating : null,
      cat_efekty: categories.includes("efekty") ? rating : null,
    });
    if (insertErr) {
      if (insertErr.code === "23505") {
        return { error: "Opinia dla tej sesji już istnieje." };
      }
      if (insertErr.code === "42501") {
        // RLS veto — booking isn't a completed session of this client.
        return { error: "Opinię można wystawić tylko po ukończonej sesji u tego trenera." };
      }
      console.error("[account/bookings] createReview insert failed:", insertErr);
      return { error: DEFAULT_ERROR };
    }

    // The new review shows up in three places: the client's history cards,
    // the trainer's /studio/reviews inbox and the public profile (all six
    // templates read trainers→reviews through getTrainer).
    revalidatePath("/account/bookings");
    revalidatePath("/studio/reviews");
    revalidatePath("/trainers/[id]", "page");
    revalidatePath("/trainers/[id]/[pageSlug]", "page");

    return { ok: true };
  } catch (err) {
    console.error("[account/bookings] createReview failed:", err);
    return { error: DEFAULT_ERROR };
  }
}
