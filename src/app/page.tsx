import { redirect } from "next/navigation";
import { getTrainers, type TrainerFilters } from "@/lib/db/trainers";
import { getFavoriteTrainerIds } from "@/lib/db/favorites";
import { createClient } from "@/lib/supabase/server";
import CatalogClient, { type CatalogFilters } from "@/app/trainers/CatalogClient";
import type { Specialization } from "@/types";

/**
 * `/` — merged landing + search results.
 *
 * Per user direction: the homepage IS the search page (OLX model).
 * /trainers/page.tsx redirects here, and every internal listing link
 * points to `/` instead of `/trainers`. Individual trainer profiles
 * (/trainers/[slug]/*) stay on their own routes.
 *
 * URL params drive the filter set; CatalogClient initializes its UI
 * from them and renders an active-chip per param so the user always
 * sees what's narrowing the results.
 */

// All URL params surfaced to the catalog. Optional — none required.
type SP = Promise<{
  q?: string;
  city?: string;
  spec?: string;
  price?: string;     // "80-200" | "0-80" | "200-" | "0-100" | …
  sort?: string;      // "top" | "rating" | "price-asc" | "price-desc"
  fav?: string;       // "1"
  // Surfaced but not yet applied — see CatalogFilters.unsupported in
  // CatalogClient for the schema dependency per chip.
  promo?: string;
  since?: string;     // "30d"
  format?: string;    // "online" | "onsite"
  time?: string;      // "morning" | …
  gender?: string;    // "f" | "m"
  pro?: string;       // "1"
  freeconsult?: string;
  radius?: string;    // "5" | "10" | …
}>;

const VALID_SPECS: ReadonlyArray<Specialization> = [
  "weight-loss", "muscle-gain", "rehabilitation", "flexibility",
  "cardio", "strength", "crossfit", "yoga", "martial-arts", "nutrition",
];

function parsePriceRange(raw: string | undefined): { min?: number; max?: number } {
  if (!raw) return {};
  // Accepts "80-200", "0-80", "200-" (open high), "-50" (open low).
  const m = /^(\d*)-(\d*)$/.exec(raw.trim());
  if (!m) return {};
  const min = m[1] ? parseInt(m[1], 10) : undefined;
  const max = m[2] ? parseInt(m[2], 10) : undefined;
  return {
    min: Number.isFinite(min) ? min : undefined,
    max: Number.isFinite(max) ? max : undefined,
  };
}

function parseSort(raw: string | undefined): TrainerFilters["sort"] {
  if (raw === "price-asc" || raw === "price-desc" || raw === "rating" || raw === "top") {
    return raw;
  }
  return undefined;
}

export default async function Home(props: { searchParams: SP }) {
  const sp = await props.searchParams;
  const wantsFavOnly = sp?.fav === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Favorites filter requires login — bounce to /login with a next= that
  // returns the user to the favourites view on `/`.
  if (wantsFavOnly && !user) {
    redirect("/login?next=/?fav=1");
  }

  const spec = sp.spec && (VALID_SPECS as readonly string[]).includes(sp.spec)
    ? (sp.spec as Specialization)
    : undefined;
  const { min: priceMin, max: priceMax } = parsePriceRange(sp.price);

  const filters: TrainerFilters = {
    spec,
    city: sp.city,
    q: sp.q,
    priceMin,
    priceMax,
    sort: parseSort(sp.sort),
  };

  let trainers = await getTrainers(filters);

  if (wantsFavOnly && user) {
    const favIds = new Set(await getFavoriteTrainerIds(user.id));
    // trainer.id from the mapper is the slug — re-query the DB uuids
    // for the trainers we have so we can filter against favorites.
    const { data: idRows } = await supabase
      .from("trainers")
      .select("id, slug")
      .in("slug", trainers.map((t) => t.id));
    const slugToDbId = new Map((idRows ?? []).map((r) => [r.slug as string, r.id as string]));
    trainers = trainers.filter((t) => {
      const dbId = slugToDbId.get(t.id);
      return dbId !== undefined && favIds.has(dbId);
    });
  }

  const catalogFilters: CatalogFilters = {
    q: sp.q,
    city: sp.city,
    spec,
    price: sp.price,
    sort: sp.sort,
    fav: wantsFavOnly,
    promo: sp.promo === "1",
    since: sp.since,
    format: sp.format,
    time: sp.time,
    gender: sp.gender,
    pro: sp.pro === "1",
    freeconsult: sp.freeconsult === "1",
    radius: sp.radius,
  };

  return (
    <CatalogClient
      trainers={trainers}
      isLoggedIn={!!user}
      favActive={wantsFavOnly}
      filters={catalogFilters}
    />
  );
}
