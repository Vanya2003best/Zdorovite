import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OpinieClient, { type ReviewRow } from "./OpinieClient";

/**
 * /studio/reviews — Opinie page (design 34). One screen, five
 * modes via tabs at the top:
 *   Wszystkie   — all reviews, masonry list + right rail
 *                 (distribution / categories / featured quotes)
 *   Skrzynka    — reviews still needing a reply (auto-filtered)
 *   Statystyki  — chart over time + keyword cloud (visual only)
 *   Prośby      — outgoing review requests (placeholder; needs schema)
 *   Spory       — flagged reviews (placeholder; needs schema)
 */
export default async function StudioReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/reviews");

  const params = (await searchParams) ?? {};
  const allowed = ["wszystkie", "skrzynka", "statystyki", "prosby", "spory"] as const;
  type Mode = (typeof allowed)[number];
  const mode: Mode = (allowed as readonly string[]).includes(params.mode ?? "")
    ? (params.mode as Mode)
    : "wszystkie";

  // Try the rich SELECT first (migration 029). On 42703 (column
  // doesn't exist yet) fall back to the legacy shape so the page
  // still works on partially-migrated DBs.
  const [{ data: trainer }, reviewsResult] = await Promise.all([
    supabase
      .from("trainers")
      .select("rating, review_count, slug")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select(
        `
        id, rating, text, created_at, reply_text, reply_at,
        pinned_at, booking_id, photos,
        cat_wiedza, cat_atmosfera, cat_punktualnosc, cat_efekty,
        author:profiles!reviews_author_id_fkey ( display_name, avatar_url ),
        booking:bookings!reviews_booking_id_fkey ( service_name, package_name )
        `,
      )
      .eq("trainer_id", user.id)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  let reviewsRaw: unknown[] | null = reviewsResult.data;
  if (reviewsResult.error?.code === "42703") {
    const fallback = await supabase
      .from("reviews")
      .select(
        `
        id, rating, text, created_at, reply_text, reply_at,
        author:profiles!reviews_author_id_fkey ( display_name, avatar_url )
        `,
      )
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false });
    reviewsRaw = fallback.data;
  }

  type Row = {
    id: string;
    rating: number;
    text: string;
    created_at: string;
    reply_text: string | null;
    reply_at: string | null;
    pinned_at?: string | null;
    booking_id?: string | null;
    photos?: string[] | null;
    cat_wiedza?: number | null;
    cat_atmosfera?: number | null;
    cat_punktualnosc?: number | null;
    cat_efekty?: number | null;
    author: { display_name: string | null; avatar_url: string | null } | null;
    booking?: { service_name: string | null; package_name: string | null } | null;
  };
  const reviews: ReviewRow[] = ((reviewsRaw ?? []) as Row[]).map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    createdAt: r.created_at,
    replyText: r.reply_text,
    replyAt: r.reply_at,
    pinnedAt: r.pinned_at ?? null,
    photos: r.photos ?? [],
    serviceContext: r.booking?.service_name ?? r.booking?.package_name ?? null,
    categories:
      r.cat_wiedza || r.cat_atmosfera || r.cat_punktualnosc || r.cat_efekty
        ? {
            wiedza: r.cat_wiedza ?? null,
            atmosfera: r.cat_atmosfera ?? null,
            punktualnosc: r.cat_punktualnosc ?? null,
            efekty: r.cat_efekty ?? null,
          }
        : null,
    authorName: r.author?.display_name ?? "Anonimowy klient",
    authorAvatar: r.author?.avatar_url ?? null,
  }));

  // Trainer rating percentile — for the 'Top X% trenerów' card on
  // the right rail. Compares published trainers with at least one
  // review, so a brand-new trainer with rating 0 isn't counted in
  // the denominator.
  const myRating = Number(trainer?.rating ?? 0);
  let topPercent: number | null = null;
  if (myRating > 0 && (trainer?.review_count ?? 0) > 0) {
    const [{ count: better }, { count: total }] = await Promise.all([
      supabase
        .from("trainers")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .gt("rating", myRating),
      supabase
        .from("trainers")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .gt("review_count", 0),
    ]);
    if (total && total > 0) {
      topPercent = Math.max(1, Math.round(((better ?? 0) / total) * 100));
    }
  }

  return (
    <OpinieClient
      mode={mode}
      reviews={reviews}
      headlineRating={myRating}
      headlineCount={trainer?.review_count ?? 0}
      trainerSlug={(trainer?.slug as string | undefined) ?? null}
      topPercent={topPercent}
    />
  );
}
