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

  const [{ data: trainer }, { data: reviewsRaw }] = await Promise.all([
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
        author:profiles!reviews_author_id_fkey ( display_name, avatar_url )
        `,
      )
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  type Row = {
    id: string;
    rating: number;
    text: string;
    created_at: string;
    reply_text: string | null;
    reply_at: string | null;
    author: { display_name: string | null; avatar_url: string | null } | null;
  };
  const reviews: ReviewRow[] = ((reviewsRaw ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    createdAt: r.created_at,
    replyText: r.reply_text,
    replyAt: r.reply_at,
    authorName: r.author?.display_name ?? "Anonimowy klient",
    authorAvatar: r.author?.avatar_url ?? null,
  }));

  return (
    <OpinieClient
      mode={mode}
      reviews={reviews}
      headlineRating={Number(trainer?.rating ?? 0)}
      headlineCount={trainer?.review_count ?? 0}
      trainerSlug={(trainer?.slug as string | undefined) ?? null}
    />
  );
}
