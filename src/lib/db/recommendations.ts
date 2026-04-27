import { createClient } from "@/lib/supabase/server";

export type RecommendedTrainer = {
  slug: string;
  name: string;
  avatar: string | null;
  rating: number;
  priceFrom: number;
  location: string;
  /** Specialization the recommendation is BASED on (if any) — drives the copy. */
  matchedSpec: string | null;
};

/**
 * Pick a single trainer to surface in the dashboard sidebar:
 *  1. Find specializations the client is already engaged with (favorited OR booked).
 *  2. Find a top-rated published trainer in those specs that the client has NOT
 *     favorited or booked yet.
 *  3. Fall back to the platform's top-rated trainer if the client has no history.
 *  4. Return null if the catalog is empty.
 *
 * Honest empty: returns null if there's nothing to recommend (no double-talk
 * about a trainer the client already knows).
 */
export async function getRecommendedTrainer(clientId: string): Promise<RecommendedTrainer | null> {
  const supabase = await createClient();

  // Step 1 — IDs we should EXCLUDE (favorites + already booked).
  const { data: favRows } = await supabase
    .from("client_favorites")
    .select("trainer_id")
    .eq("client_id", clientId);
  const favIds = new Set((favRows ?? []).map((r) => r.trainer_id as string));

  const { data: bookedRows } = await supabase
    .from("bookings")
    .select("trainer_id")
    .eq("client_id", clientId);
  const bookedIds = new Set((bookedRows ?? []).map((r) => r.trainer_id as string));

  const excludeIds = new Set([...favIds, ...bookedIds]);

  // Step 2 — preferred specializations = unique specs of all engaged trainers.
  const engagedIds = Array.from(excludeIds);
  let preferredSpecs: string[] = [];
  if (engagedIds.length > 0) {
    const { data: specRows } = await supabase
      .from("trainer_specializations")
      .select("specialization_id")
      .in("trainer_id", engagedIds);
    preferredSpecs = Array.from(
      new Set((specRows ?? []).map((r) => r.specialization_id as string)),
    );
  }

  // Step 3 — query candidates ordered by rating; filter exclusions in-app
  // (Postgrest can't easily express "id not in list" with empty list).
  const select = `
    id, slug, rating, price_from, location,
    profile:profiles!id ( display_name, avatar_url ),
    specs:trainer_specializations ( specialization_id )
  `;
  type Row = {
    id: string;
    slug: string;
    rating: number | string;
    price_from: number;
    location: string;
    profile: { display_name: string; avatar_url: string | null } | null;
    specs: { specialization_id: string }[];
  };

  // Pull a small page of top-rated trainers; we filter in-app.
  const { data: candidates, error } = await supabase
    .from("trainers")
    .select(select)
    .eq("published", true)
    .order("rating", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(20);
  if (error) throw error;

  const rows = (candidates ?? []) as unknown as Row[];

  // First try: a candidate in a preferred spec.
  if (preferredSpecs.length > 0) {
    for (const c of rows) {
      if (excludeIds.has(c.id)) continue;
      const cSpecs = c.specs.map((s) => s.specialization_id);
      const overlap = cSpecs.find((s) => preferredSpecs.includes(s));
      if (overlap) return mapRow(c, overlap);
    }
  }

  // Fallback: any top-rated trainer the client doesn't know.
  for (const c of rows) {
    if (excludeIds.has(c.id)) continue;
    return mapRow(c, c.specs[0]?.specialization_id ?? null);
  }

  return null;
}

function mapRow(
  c: {
    slug: string;
    rating: number | string;
    price_from: number;
    location: string;
    profile: { display_name: string; avatar_url: string | null } | null;
  },
  matchedSpec: string | null,
): RecommendedTrainer {
  return {
    slug: c.slug,
    name: c.profile?.display_name ?? "Trener",
    avatar: c.profile?.avatar_url ?? null,
    rating: Number(c.rating),
    priceFrom: c.price_from,
    location: c.location,
    matchedSpec,
  };
}
