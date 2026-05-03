import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReplyComposer from "./ReplyComposer";

/**
 * /studio/reviews — trainer-facing reviews dashboard.
 *
 * Phase 1: read-only summary + list of all reviews left by clients.
 * Phase 2 (later): reply threads, abuse-flag, response-rate metric.
 *
 * Header shows the headline rating + total count + a small star-distribution
 * histogram so the trainer can see the shape of their feedback at a glance.
 * The list below is chronological newest-first with per-row author avatar,
 * name, date, stars and full body. Empty state explains how reviews land
 * here (after a completed booking).
 */
export default async function StudioReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/reviews");

  // Pull the trainer row first — gives us the recalculated rating + count
  // (the recalc_trainer_rating trigger keeps these in sync with the reviews
  // table). Empty defaults if the trainer profile hasn't been created yet.
  const { data: trainer } = await supabase
    .from("trainers")
    .select("rating, review_count, slug")
    .eq("id", user.id)
    .maybeSingle();

  const headlineRating = trainer?.rating ?? 0;
  const headlineCount = trainer?.review_count ?? 0;
  const trainerSlug = trainer?.slug as string | undefined;

  // Newest reviews first. Joining profiles for author display name + avatar
  // — same shape used by the public profile, so the list looks identical.
  const { data: reviewsRaw } = await supabase
    .from("reviews")
    .select(`
      id,
      rating,
      text,
      created_at,
      reply_text,
      reply_at,
      author:profiles!reviews_author_id_fkey ( display_name, avatar_url )
    `)
    .eq("trainer_id", user.id)
    .order("created_at", { ascending: false });

  type ReviewRow = {
    id: string;
    rating: number;
    text: string;
    created_at: string;
    reply_text: string | null;
    reply_at: string | null;
    author: { display_name: string | null; avatar_url: string | null } | null;
  };
  const reviews = ((reviewsRaw ?? []) as unknown as ReviewRow[]);

  // Star distribution — 1..5 buckets so the histogram bars line up.
  const dist = [1, 2, 3, 4, 5].map((n) => ({
    n,
    c: reviews.filter((r) => r.rating === n).length,
  }));
  const distMax = Math.max(1, ...dist.map((d) => d.c));

  return (
    <div className="px-6 sm:px-10 py-8 sm:py-12 max-w-[1100px] mx-auto">
      {/* Page header is already shown in the StudioTopBar (Opinie / Co mówią
          klienci) — no need to repeat it here. Summary card opens directly. */}

      {/* Summary card — average rating + count + 5-bar distribution */}
      <div className="grid sm:grid-cols-[280px_1fr] gap-6 sm:gap-10 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm">
        <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-6 sm:pb-0 sm:pr-8">
          <div className="flex items-baseline gap-2">
            <span className="text-[44px] font-semibold tracking-tight text-slate-900 leading-none">
              {headlineRating > 0 ? headlineRating.toFixed(1).replace(".", ",") : "—"}
            </span>
            <span className="text-[18px] text-amber-400 leading-none">★★★★★</span>
          </div>
          <div className="text-[13px] text-slate-500 mt-2">
            {headlineCount === 0 ? "Brak opinii" : `${headlineCount} ${pluralOpinii(headlineCount)}`}
          </div>
          {trainerSlug && headlineCount > 0 && (
            <Link
              href={`/trainers/${trainerSlug}#reviews`}
              className="inline-flex items-center gap-1.5 mt-4 text-[13px] text-emerald-700 font-medium hover:text-emerald-900"
            >
              Zobacz publicznie →
            </Link>
          )}
        </div>

        <div className="grid gap-2">
          {dist
            .slice()
            .reverse() // 5★ on top
            .map(({ n, c }) => (
              <div key={n} className="grid grid-cols-[28px_1fr_42px] gap-3 items-center text-[12.5px] text-slate-600">
                <span className="font-medium text-slate-700">{n}★</span>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(c / distMax) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{c}</span>
              </div>
            ))}
        </div>
      </div>

      {/* List */}
      {reviews.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          <div className="text-3xl mb-2">★</div>
          <p className="text-[14px] max-w-[420px] mx-auto">
            Klienci mogą zostawiać opinie po zakończonej sesji. Pierwsza opinia
            pojawi się tu zaraz po jej dodaniu.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((r) => {
            const date = new Date(r.created_at).toLocaleDateString("pl-PL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const name = r.author?.display_name ?? "Anonimowy klient";
            const initial = name.charAt(0).toUpperCase();
            return (
              <li
                key={r.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-emerald-100 text-emerald-700 inline-flex items-center justify-center font-semibold text-[15px] shrink-0">
                    {r.author?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.author.avatar_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[15px] font-semibold text-slate-900 truncate">
                        {name}
                      </div>
                      <div className="text-[12px] text-slate-500 whitespace-nowrap">
                        {date}
                      </div>
                    </div>
                    <div className="text-amber-400 text-[14px] mt-0.5 leading-none tracking-tight">
                      {"★".repeat(r.rating)}
                      <span className="text-slate-200">{"★".repeat(5 - r.rating)}</span>
                    </div>
                    <p className="text-[14px] text-slate-700 leading-relaxed mt-2.5 whitespace-pre-line">
                      {r.text}
                    </p>
                  </div>
                </div>
                <ReplyComposer
                  reviewId={r.id}
                  initialReply={r.reply_text ?? undefined}
                  initialReplyAt={r.reply_at ?? undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function pluralOpinii(n: number): string {
  // Polish plural — opinia / opinie / opinii
  if (n === 1) return "opinia";
  const lastTwo = n % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return "opinii";
  const last = n % 10;
  if (last >= 2 && last <= 4) return "opinie";
  return "opinii";
}
