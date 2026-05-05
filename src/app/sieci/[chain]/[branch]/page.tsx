import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Trainer } from "@/types";

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop";

type TrainerCardData = Pick<
  Trainer,
  "id" | "name" | "avatar" | "avatarFocal" | "tagline" | "rating" | "reviewCount" | "priceFrom" | "location"
>;

type TrainerRow = {
  slug: string;
  tagline: string | null;
  price_from: number | null;
  location: string | null;
  rating: number | string | null;
  review_count: number | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
    avatar_focal?: string | null;
  } | null;
};

function rowToCard(r: TrainerRow): TrainerCardData {
  return {
    id: r.slug,
    name: r.profile?.display_name ?? "",
    avatar: r.profile?.avatar_url ?? FALLBACK_AVATAR,
    avatarFocal: r.profile?.avatar_focal ?? null,
    tagline: r.tagline ?? "",
    rating: Number(r.rating ?? 0),
    reviewCount: r.review_count ?? 0,
    priceFrom: r.price_from ?? 0,
    location: r.location ?? "",
  };
}

/**
 * Branch landing page — /sieci/[chain]/[branch].
 *
 * Two audiences served by ONE page:
 *  1. Gym-goers (scanned standalone QR at the club): see the roster of
 *     trainers working here, click into a trainer to book.
 *  2. Trainers (scrolled past the recruiting badge or arrived via the
 *     "kluby z otwartą rekrutacją" filter): see "we're hiring" CTA, click
 *     to start their NaZdrow! signup with this branch pre-affiliated.
 *
 * Architecture-rule reminder: NO hardcoded brand strings. Logo, color,
 * website all come from gym_chains row. Pulling Zdrofit's chain row
 * cascades-cleans branches + affiliations + this page becomes 404.
 */
export default async function BranchLanding({
  params,
}: {
  params: Promise<{ chain: string; branch: string }>;
}) {
  const { chain: chainSlug, branch: branchSlug } = await params;
  const supabase = await createClient();

  // Single round-trip: branch row joined to chain.
  const { data: branch } = await supabase
    .from("gym_branches")
    .select(
      `
      id, name, slug, city, address,
      recruiting_open, recruiting_message,
      chain:gym_chains!chain_id ( id, name, slug, brand_color, logo_url, website )
      `,
    )
    .eq("slug", branchSlug)
    .single();

  if (!branch) notFound();
  // Filter the eq("slug") above isn't enough — different chains can have a
  // branch with the same slug (e.g. /sieci/calypso/wroclaw-aleja-pokoju).
  // Verify the chain matches.
  const chainObj = (branch.chain as unknown as {
    id: string;
    name: string;
    slug: string;
    brand_color: string | null;
    logo_url: string | null;
    website: string | null;
  }) ?? null;
  if (!chainObj || chainObj.slug !== chainSlug) notFound();

  // Pull verified-affiliated trainers + their public catalog data.
  // RLS handles published-or-self visibility on trainers; we add an
  // explicit published filter here so we don't show drafts to visitors.
  const { data: affiliations } = await supabase
    .from("trainer_branches")
    .select("trainer_id, status")
    .eq("branch_id", branch.id)
    .eq("status", "verified");

  const trainerIds = (affiliations ?? []).map((a) => a.trainer_id);
  let trainers: TrainerCardData[] = [];
  if (trainerIds.length > 0) {
    // Try with avatar_focal (migration 020); fall back on 42703 if missing.
    let rows: TrainerRow[] | null = null;
    const full = await supabase
      .from("trainers")
      .select(
        `
        slug, tagline, price_from, location, rating, review_count,
        profile:profiles!id ( display_name, avatar_url, avatar_focal )
        `,
      )
      .in("id", trainerIds)
      .eq("published", true);
    if (full.error?.code === "42703") {
      const fallback = await supabase
        .from("trainers")
        .select(
          `
          slug, tagline, price_from, location, rating, review_count,
          profile:profiles!id ( display_name, avatar_url )
          `,
        )
        .in("id", trainerIds)
        .eq("published", true);
      rows = fallback.data as unknown as TrainerRow[] | null;
    } else {
      rows = full.data as unknown as TrainerRow[] | null;
    }
    trainers = (rows ?? []).map(rowToCard);
  }

  const accent = chainObj.brand_color ?? "#10b981";

  return (
    <div className="min-h-screen bg-slate-50">
        {/* Hero — branded with the chain's accent color */}
        <section
          className="relative px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-14"
          style={{ background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)` }}
        >
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-center gap-3 mb-4 text-[12.5px] text-slate-500">
              <Link href="/sieci" className="hover:text-slate-800">Sieci</Link>
              <span>/</span>
              <Link href={`/sieci/${chainObj.slug}`} className="hover:text-slate-800">
                {chainObj.name}
              </Link>
              <span>/</span>
              <span className="text-slate-700">{branch.name}</span>
            </div>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase mb-4"
                  style={{ background: accent, color: "white" }}
                >
                  {chainObj.name} · {branch.city}
                </div>
                <h1 className="text-[28px] sm:text-[40px] font-semibold tracking-tight text-slate-900 m-0">
                  {branch.name}
                </h1>
                {branch.address && (
                  <p className="text-[14px] sm:text-[15px] text-slate-600 mt-2 max-w-[640px]">
                    📍 {branch.address}
                  </p>
                )}
              </div>
              {branch.recruiting_open && (
                <div className="rounded-2xl border-2 p-5 max-w-[360px] bg-white" style={{ borderColor: accent }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block animate-pulse"
                      style={{ background: accent }}
                    />
                    <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: accent }}>
                      Rekrutacja otwarta
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-700 leading-[1.5] m-0 mb-3">
                    {branch.recruiting_message || `Klub ${branch.name} szuka trenerów. Załóż profil na NaZdrow! i dołącz do zespołu.`}
                  </p>
                  <Link
                    href={`/register/trainer?branch=${chainObj.slug}-${branch.slug}`}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-[13px] font-semibold text-white transition hover:brightness-110"
                    style={{ background: accent }}
                  >
                    Aplikuj jako trener →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Trainer roster */}
        <section className="px-4 sm:px-6 py-10">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-[20px] sm:text-[24px] font-semibold text-slate-900 mb-1">
              Trenerzy w tym klubie
            </h2>
            <p className="text-[13px] text-slate-600 mb-6">
              {trainers.length === 0
                ? "Jeszcze nikogo — bądź pierwszym trenerem w tym klubie."
                : `${trainers.length} ${trainers.length === 1 ? "trener" : "trenerów"} potwierdzonych przez NaZdrow!`}
            </p>

            {trainers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
                <p className="text-slate-500 mb-4">
                  Klub jeszcze nie ma trenerów na NaZdrow!.
                </p>
                <Link
                  href={`/register/trainer?branch=${chainObj.slug}-${branch.slug}`}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-[13px] font-semibold text-white transition hover:brightness-110"
                  style={{ background: accent }}
                >
                  Dołącz jako pierwszy →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {trainers.map((t) => (
                  <Link
                    key={t.id}
                    href={`/trainers/${t.id}?source=${chainObj.slug}-${branch.slug}`}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.avatar}
                        alt={t.name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: t.avatarFocal || "center" }}
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-[16px] font-semibold tracking-tight text-slate-900 m-0 mb-1">
                        {t.name}
                      </h3>
                      <p className="text-[12.5px] text-slate-600 line-clamp-2 leading-[1.4] mb-3">
                        {t.tagline}
                      </p>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-700">
                          ★ {t.rating} <span className="text-slate-500">({t.reviewCount})</span>
                        </span>
                        <span className="text-slate-700 font-medium">
                          od {t.priceFrom} zł
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {chainObj.website && (
          <section className="px-4 sm:px-6 py-10 border-t border-slate-200 bg-white">
            <div className="max-w-[1200px] mx-auto text-center">
              <p className="text-[13px] text-slate-500 mb-3">
                Oficjalna strona klubu:
              </p>
              <a
                href={chainObj.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-medium text-slate-800 hover:underline"
              >
                {chainObj.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
              </a>
            </div>
          </section>
        )}
    </div>
  );
}
