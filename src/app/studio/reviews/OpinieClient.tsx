"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReplyComposer from "./ReplyComposer";
import { togglePinReview } from "./actions";

export type ReviewCategories = {
  wiedza: number | null;
  atmosfera: number | null;
  punktualnosc: number | null;
  efekty: number | null;
};

export type ReviewRow = {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  replyText: string | null;
  replyAt: string | null;
  pinnedAt: string | null;
  photos: string[];
  serviceContext: string | null;
  categories: ReviewCategories | null;
  authorName: string;
  authorAvatar: string | null;
};

type Mode = "wszystkie" | "skrzynka" | "statystyki" | "prosby" | "spory";

const MODES: {
  id: Mode;
  label: string;
  icon: React.ReactNode;
  warn?: boolean;
}[] = [
  {
    id: "wszystkie",
    label: "Wszystkie",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1L2 9.4h7.6z" />
      </svg>
    ),
  },
  {
    id: "skrzynka",
    label: "Skrzynka",
    warn: true,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
      </svg>
    ),
  },
  {
    id: "statystyki",
    label: "Statystyki",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18M7 16l4-6 3 3 5-7" />
      </svg>
    ),
  },
  {
    id: "prosby",
    label: "Prośby",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92V21a1 1 0 01-1.11 1A19.79 19.79 0 012 4.11 1 1 0 013 3h4.09a1 1 0 011 .75l1 4a1 1 0 01-.27 1L7 10a16 16 0 007 7l1.21-1.82a1 1 0 011-.27l4 1a1 1 0 01.75 1z" />
      </svg>
    ),
  },
  {
    id: "spory",
    label: "Spory",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
      </svg>
    ),
  },
];

export default function OpinieClient({
  mode: initialMode,
  reviews,
  headlineRating,
  headlineCount,
  topPercent,
}: {
  mode: Mode;
  reviews: ReviewRow[];
  headlineRating: number;
  headlineCount: number;
  /** kept for future "back to public profile" CTA — currently the
   *  sidebar's 'Strona publiczna' link covers this. */
  trainerSlug: string | null;
  /** Percentile vs other published trainers (1 = top 1%, etc.).
   *  Null when there isn't enough data to compute meaningfully. */
  topPercent: number | null;
}) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode") as Mode | null;
  const mode: Mode = MODES.some((m) => m.id === modeParam) ? (modeParam as Mode) : initialMode;

  // Star filter — clicking a row in the right-rail distribution
  // narrows the list to just that rating bucket. null = show all.
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const filteredReviews = useMemo(
    () => (starFilter === null ? reviews : reviews.filter((r) => r.rating === starFilter)),
    [reviews, starFilter],
  );

  // Star distribution + simple aggregations.
  const dist = useMemo(() => {
    const buckets = [1, 2, 3, 4, 5].map((n) => ({
      n,
      c: reviews.filter((r) => r.rating === n).length,
    }));
    return buckets;
  }, [reviews]);
  const distMax = Math.max(1, ...dist.map((d) => d.c));
  const needsReply = reviews.filter((r) => !r.replyText);
  const replyRate =
    reviews.length > 0
      ? Math.round(((reviews.length - needsReply.length) / reviews.length) * 100)
      : 0;
  // Recent average — last 30 days. Tells the trainer if the latest
  // batch of reviews is dragging or boosting the all-time number.
  const recent = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const recent30 = reviews.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
    if (recent30.length === 0) return null;
    const avg = recent30.reduce((a, r) => a + r.rating, 0) / recent30.length;
    return { avg, count: recent30.length };
  }, [reviews]);

  // Average response time — across reviews that have a reply, how
  // many hours between the review's created_at and the trainer's
  // reply_at. Surfaces in the summary card so the trainer sees the
  // 'Czas odpowiedzi' the design 34 promises. Falls back to '—'
  // when there are no replied reviews to measure.
  const avgResponseHours = useMemo(() => {
    const replied = reviews.filter((r) => r.replyAt && r.createdAt);
    if (replied.length === 0) return null;
    const totalMs = replied.reduce((acc, r) => {
      const dt = new Date(r.replyAt!).getTime() - new Date(r.createdAt).getTime();
      return acc + Math.max(0, dt);
    }, 0);
    return Math.round(totalMs / replied.length / 3600_000);
  }, [reviews]);
  const fivePct = headlineCount > 0 ? Math.round(((dist[4]?.c ?? 0) / headlineCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-7 py-5 sm:py-7">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[26px] font-semibold tracking-[-0.022em] m-0">Opinie</h1>
          <p className="text-[12.5px] text-slate-500 mt-1">
            {headlineCount === 0 ? (
              "Brak opinii — pojawią się tu po zakończonych sesjach."
            ) : (
              <>
                {headlineRating > 0 ? headlineRating.toFixed(1).replace(".", ",") : "—"} ★ ·{" "}
                {headlineCount} {headlineCount === 1 ? "opinia" : pluralOpinii(headlineCount)} · {replyRate}% odpowiedzi
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled
            title="Wkrótce — automatyczne prośby o opinię 2h po zakończonej sesji"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Auto-prośby
          </button>
          <button
            type="button"
            disabled
            title="Wkrótce — eksport wszystkich opinii do CSV"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Eksport CSV
          </button>
          <button
            type="button"
            disabled
            title="Wkrótce — wyślij prośbę o opinię do wybranych klientów"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60"
          >
            + Poproś o opinię
          </button>
        </div>
      </div>

      {/* Tabs row + Star filter pills together so they sit at the
          same horizontal level, like design 34's toolbar. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ModeSwitcher mode={mode} reviewsTotal={reviews.length} needsReplyCount={needsReply.length} />
        {(mode === "wszystkie" || mode === "skrzynka") && (
          <StarFilterPills
            current={starFilter}
            onChange={setStarFilter}
            counts={{
              all: reviews.length,
              s5: dist[4]?.c ?? 0,
              s4: dist[3]?.c ?? 0,
              low: (dist[2]?.c ?? 0) + (dist[1]?.c ?? 0) + (dist[0]?.c ?? 0),
            }}
          />
        )}
      </div>

      {/* Mode banner — context for what's on screen + the next action.
          Only the active mode's banner shows. */}
      {mode === "wszystkie" && (
        <ContextBanner
          tone="all"
          title={`Wszystkie opinie · ${reviews.length} łącznie`}
          detail={'Verified = po opłaconej sesji. Klikaj „Odpowiedz" / „Cytuj" na karcie. Sortowanie: najnowsze.'}
          link={
            needsReply.length > 0
              ? { href: "/studio/reviews?mode=skrzynka", label: `Załatw ${needsReply.length} czekające →` }
              : null
          }
        />
      )}
      {mode === "skrzynka" && (
        <ContextBanner
          tone="inbox"
          title={`Skrzynka · ${needsReply.length} czeka na odpowiedź`}
          detail="Każda opinia bez odpowiedzi obniża zaufanie. Średnia odpowiedź <24h zwiększa konwersję rezerwacji o ~12%."
          link={null}
        />
      )}

      {/* Summary strip — 5 cards per design 34, only on Wszystkie + Skrzynka */}
      {(mode === "wszystkie" || mode === "skrzynka") && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 mb-4">
          <SummaryCard
            label="Średnia ocena"
            value={headlineRating > 0 ? headlineRating.toFixed(2).replace(".", ",") : "—"}
            unit="★"
            detail={
              recent
                ? `${recent.avg >= headlineRating ? "↑" : "↓"} ${Math.abs(recent.avg - headlineRating).toFixed(2).replace(".", ",")} vs poprzednie`
                : "Pierwsza opinia czeka"
            }
            valueColor="amber"
          />
          <SummaryCard
            label="Opinii łącznie"
            value={String(headlineCount)}
            detail={recent ? `+${recent.count} w tym mies.` : undefined}
          />
          <SummaryCard
            label="% 5 gwiazdek"
            value={String(fivePct)}
            unit="%"
            detail={`${dist[4]?.c ?? 0} z ${headlineCount}`}
          />
          <SummaryCard
            label="Czas odpowiedzi"
            value={avgResponseHours !== null ? String(avgResponseHours) : "—"}
            unit={avgResponseHours !== null ? "godz." : undefined}
            detail={
              avgResponseHours === null
                ? "wkrótce — średnia z odpowiedzi"
                : avgResponseHours <= 24
                  ? "świetnie · pod 24h"
                  : `${avgResponseHours}h średnio`
            }
          />
          <SummaryCard
            label="Konwersja proszenia"
            value="—"
            unit="%"
            detail="wkrótce — po włączeniu auto-próśb"
          />
        </div>
      )}

      {/* Content per mode */}
      {mode === "wszystkie" && (
        <ReviewsListLayout
          reviews={filteredReviews}
          allReviews={reviews}
          dist={dist}
          distMax={distMax}
          headlineRating={headlineRating}
          headlineCount={headlineCount}
          starFilter={starFilter}
          setStarFilter={setStarFilter}
          topPercent={topPercent}
        />
      )}
      {mode === "skrzynka" && (
        <SkrzynkaPanel reviews={needsReply} totalCount={headlineCount} />
      )}
      {mode === "statystyki" && <StatystykiPanel reviews={reviews} />}
      {mode === "prosby" && <ProsbyPanel />}
      {mode === "spory" && <SporyPanel />}
    </div>
  );
}

/* ============ Mode switcher ============ */
function ModeSwitcher({
  mode,
  reviewsTotal,
  needsReplyCount,
}: {
  mode: Mode;
  reviewsTotal: number;
  needsReplyCount: number;
}) {
  return (
    <div
      className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium flex-wrap"
      role="tablist"
    >
      {MODES.map((m) => {
        const on = mode === m.id;
        const href = m.id === "wszystkie" ? "/studio/reviews" : `/studio/reviews?mode=${m.id}`;
        let badgeCount: number | null = null;
        if (m.id === "wszystkie") badgeCount = reviewsTotal;
        else if (m.id === "skrzynka") badgeCount = needsReplyCount;
        return (
          <Link
            key={m.id}
            href={href}
            scroll={false}
            role="tab"
            aria-selected={on}
            className={
              "px-3.5 py-1.5 rounded-[7px] inline-flex items-center gap-1.5 transition whitespace-nowrap " +
              (on
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            {m.icon}
            {m.label}
            {typeof badgeCount === "number" && badgeCount > 0 && (
              <span
                className={
                  "text-[10.5px] font-semibold px-1.5 py-px rounded-[5px] " +
                  (on
                    ? m.warn
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-500 text-white"
                    : m.warn
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200 text-slate-700")
                }
              >
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  detail,
  valueColor,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  valueColor?: "amber";
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.07em] text-slate-500 font-semibold">{label}</div>
      <div className="text-[22px] font-bold tracking-[-0.02em] text-slate-900 mt-1 tabular-nums flex items-baseline gap-1">
        {value}
        {unit && (
          <span
            className={
              "text-[14px] font-medium " +
              (valueColor === "amber" ? "text-amber-500" : "text-slate-500")
            }
          >
            {unit}
          </span>
        )}
      </div>
      {detail && <div className="text-[11px] text-slate-500 mt-1">{detail}</div>}
    </div>
  );
}

/* ============ Reviews list (Wszystkie) — 2-col layout ============ */
function ReviewsListLayout({
  reviews,
  allReviews,
  dist,
  distMax,
  headlineRating,
  headlineCount,
  starFilter,
  setStarFilter,
  topPercent,
}: {
  reviews: ReviewRow[];
  allReviews: ReviewRow[];
  dist: { n: number; c: number }[];
  distMax: number;
  headlineRating: number;
  headlineCount: number;
  starFilter: number | null;
  setStarFilter: (n: number | null) => void;
  topPercent: number | null;
}) {
  if (allReviews.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl px-6 py-16 text-center">
        <div className="text-amber-400 text-[36px] mb-2">★</div>
        <div className="text-[15px] font-semibold text-slate-700">Brak opinii</div>
        <p className="text-[12.5px] text-slate-500 mt-1.5 max-w-[420px] mx-auto leading-[1.55]">
          Klienci zostawiają opinie po zakończonej sesji. Pierwsza opinia pojawi się tu zaraz po jej dodaniu.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
      <div className="flex flex-col gap-3">
        {starFilter !== null && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-2 text-[12px] text-amber-900">
            <span>
              Filtr: <b className="font-semibold">{starFilter}★</b> · {reviews.length}{" "}
              {reviews.length === 1 ? "opinia" : pluralOpinii(reviews.length)}
            </span>
            <button
              type="button"
              onClick={() => setStarFilter(null)}
              className="text-[11.5px] font-semibold text-amber-700 hover:underline"
            >
              Wyczyść filtr
            </button>
          </div>
        )}
        {reviews.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl px-6 py-12 text-center text-[12.5px] text-slate-500">
            Brak opinii w tym filtrze. Spróbuj innego rozkładu po prawej.
          </div>
        ) : (
          reviews.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </div>
      <div className="flex flex-col gap-4">
        <BigRatingCard rating={headlineRating} count={headlineCount} topPercent={topPercent} />
        <DistributionCard dist={dist} distMax={distMax} starFilter={starFilter} setStarFilter={setStarFilter} />
      </div>
    </div>
  );
}

/* ============ Review card ============ */
function ReviewCard({ review }: { review: ReviewRow }) {
  const router = useRouter();
  const [pinPending, startPinTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const date = new Date(review.createdAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const initial = review.authorName.charAt(0).toUpperCase();
  const needsReply = !review.replyText;
  const isPinned = !!review.pinnedAt;

  const onPin = () => {
    startPinTransition(async () => {
      await togglePinReview(review.id);
      router.refresh();
    });
  };

  const onQuote = async () => {
    const block = `„${review.text}"\n— ${review.authorName}`;
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  };

  return (
    <article
      className={
        "bg-white border rounded-[14px] p-5 transition hover:shadow-sm relative " +
        (isPinned
          ? "border-emerald-300 bg-gradient-to-b from-emerald-50/50 to-white"
          : needsReply
            ? "border-amber-300 border-l-[3px]"
            : "border-slate-200 hover:border-slate-300")
      }
    >
      {isPinned && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold uppercase tracking-[0.06em]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.7 5.3H19l-4.4 3.2L16.3 16 12 12.7 7.7 16l1.7-5.5L5 7.3h5.3z" />
          </svg>
          Przypięte
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-100 text-emerald-700 inline-flex items-center justify-center font-bold text-[14px] shrink-0">
          {review.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.authorAvatar} alt={review.authorName} className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-slate-900">{review.authorName}</span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 11l3 3L22 4" />
              </svg>
              Zweryfikowany
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{date}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700 font-medium">
              {review.serviceContext ?? "Sesja indywidualna"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Stars rating={review.rating} />
          <span className="text-[10.5px] text-slate-500">{relativeDays(review.createdAt)}</span>
        </div>
      </div>

      <p className="text-[13.5px] text-slate-800 leading-[1.55] mb-3 whitespace-pre-line">{review.text}</p>

      {/* Per-category bars (Wiedza / Atmosfera / Punktualność / Efekty)
          — only render when at least one is set. Filled bar width =
          rating/5; null shows as a faint placeholder. */}
      {review.categories && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1 py-2.5 mb-3 border-y border-dashed border-slate-100">
          <CategoryBar label="Wiedza" value={review.categories.wiedza} />
          <CategoryBar label="Atmosfera" value={review.categories.atmosfera} />
          <CategoryBar label="Punktualność" value={review.categories.punktualnosc} />
          <CategoryBar label="Efekty" value={review.categories.efekty} />
        </div>
      )}

      {/* Client-attached photos — small tile gallery. Click opens
          the original in a new tab (no light-box for now). */}
      {review.photos.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {review.photos.slice(0, 6).map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-16 h-16 rounded-[8px] overflow-hidden bg-slate-100 inline-block hover:ring-2 hover:ring-emerald-400 transition"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {/* Action row: Pin/Unpin + Cytuj alongside the existing reply. */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <button
          type="button"
          onClick={onPin}
          disabled={pinPending}
          className={
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[11.5px] font-medium border transition disabled:opacity-50 " +
            (isPinned
              ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300")
          }
          title={isPinned ? "Odepnij od góry listy" : "Przypnij na górę"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 17v5M5 9.5L8 6h8l3 3.5L17 13H7L5 9.5z" />
          </svg>
          {isPinned ? "Odepnij" : "Przypnij"}
        </button>
        <button
          type="button"
          onClick={onQuote}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[11.5px] font-medium bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
          title="Skopiuj cytat do schowka — wstaw na social media"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v10c0 1.1.9 2 2 2h10M9 5h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z" />
          </svg>
          {copied ? "Skopiowano" : "Cytuj"}
        </button>
      </div>

      <ReplyComposer
        reviewId={review.id}
        initialReply={review.replyText ?? undefined}
        initialReplyAt={review.replyAt ?? undefined}
      />
    </article>
  );
}

function CategoryBar({ label, value }: { label: string; value: number | null }) {
  const pct = value !== null ? (value / 5) * 100 : 0;
  return (
    <div>
      <div className="text-[10.5px] text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
          {value !== null && (
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg,#f59e0b,#fbbf24)",
              }}
            />
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-900 tabular-nums w-6 text-right">
          {value !== null ? value.toFixed(1).replace(".", ",") : "—"}
        </span>
      </div>
    </div>
  );
}

function Stars({ rating, size = "md" }: { rating: number; size?: "md" | "lg" }) {
  const px = size === "lg" ? 18 : 14;
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={px}
          height={px}
          viewBox="0 0 24 24"
          className={n <= rating ? "text-amber-400" : "text-slate-200"}
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function relativeDays(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "dziś";
  if (diff === 1) return "wczoraj";
  if (diff < 7) return `${diff} dni temu`;
  if (diff < 30) return `${Math.floor(diff / 7)} tyg. temu`;
  if (diff < 365) return `${Math.floor(diff / 30)} mies. temu`;
  return `${Math.floor(diff / 365)} lat temu`;
}

/* ============ Right rail cards ============ */
function BigRatingCard({
  rating,
  count,
  topPercent,
}: {
  rating: number;
  count: number;
  topPercent: number | null;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 mb-3">
        Ogólna ocena
        <span className="text-[10.5px] font-medium text-slate-500 normal-case tracking-normal ml-1.5">
          {count} {count === 1 ? "opinia" : pluralOpinii(count)}
        </span>
      </div>
      <div className="flex items-baseline gap-3.5">
        <div className="text-[48px] font-bold tracking-[-0.035em] text-slate-900 leading-none tabular-nums">
          {rating > 0 ? rating.toFixed(2).replace(".", ",") : "—"}
        </div>
        <div className="flex flex-col gap-1">
          <Stars rating={Math.round(rating)} size="lg" />
        </div>
      </div>
      {topPercent !== null && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Top {topPercent}% trenerów na NaZdrow!
        </div>
      )}
    </div>
  );
}

function DistributionCard({
  dist,
  distMax,
  starFilter,
  setStarFilter,
}: {
  dist: { n: number; c: number }[];
  distMax: number;
  starFilter: number | null;
  setStarFilter: (n: number | null) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 mb-3 flex items-center justify-between">
        <span>Rozkład ocen</span>
        <span className="text-[10.5px] font-medium text-slate-500 normal-case tracking-normal">
          kliknij, aby filtrować
        </span>
      </div>
      <div className="grid gap-1.5">
        {[...dist].reverse().map(({ n, c }) => {
          const active = starFilter === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setStarFilter(active ? null : n)}
              disabled={c === 0}
              className={
                "grid grid-cols-[20px_1fr_30px] items-center gap-2 text-[12px] py-1 px-1.5 rounded-md transition disabled:cursor-default disabled:opacity-50 " +
                (active
                  ? "bg-amber-50 ring-1 ring-amber-200"
                  : c === 0
                    ? ""
                    : "hover:bg-slate-50 cursor-pointer")
              }
            >
              <span className="font-semibold text-slate-700 tabular-nums text-left inline-flex items-center gap-0.5">
                {n}
                <span className="text-amber-400 text-[10px]">★</span>
              </span>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={
                    "h-full rounded-full " +
                    (n === 5 ? "bg-emerald-500" : n === 1 ? "bg-rose-500" : "bg-amber-400")
                  }
                  style={{ width: `${(c / distMax) * 100}%` }}
                />
              </div>
              <span className={"tabular-nums text-right " + (active ? "text-amber-700 font-semibold" : "text-slate-500")}>
                {c}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Star filter pills (toolbar row, design 34) ============ */
function StarFilterPills({
  current,
  onChange,
  counts,
}: {
  current: number | null;
  onChange: (n: number | null) => void;
  counts: { all: number; s5: number; s4: number; low: number };
}) {
  const items: { id: number | null; label: string; count: number; tone: "all" | "good" | "ok" | "bad" }[] = [
    { id: null, label: "Wszystkie", count: counts.all, tone: "all" },
    { id: 5, label: "5★", count: counts.s5, tone: "good" },
    { id: 4, label: "4★", count: counts.s4, tone: "ok" },
    { id: 3, label: "≤3★", count: counts.low, tone: "bad" },
  ];
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {items.map((it) => {
        // For ≤3 we let the user toggle through 1/2/3 — keep this
        // simple for now: clicking ≤3 cycles through 3, 2, 1, off.
        // For other pills, click toggles set/clear.
        const active =
          it.id === null ? current === null : it.id === 3 ? current !== null && current <= 3 : current === it.id;
        const handleClick = () => {
          if (it.id === null) onChange(null);
          else if (it.id === 3) {
            // Cycle low-end through 3 → 2 → 1 → off.
            const order = [3, 2, 1, null] as (number | null)[];
            const idx = order.findIndex((n) => n === current);
            onChange(order[(idx + 1) % order.length]);
          } else {
            onChange(current === it.id ? null : it.id);
          }
        };
        const dotClass =
          it.tone === "good"
            ? "text-emerald-500"
            : it.tone === "ok"
              ? "text-amber-500"
              : it.tone === "bad"
                ? "text-rose-500"
                : "";
        return (
          <button
            key={String(it.id)}
            type="button"
            onClick={handleClick}
            className={
              "inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] text-[11.5px] font-medium border transition " +
              (active
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300")
            }
          >
            {it.tone !== "all" && <span className={dotClass}>★</span>}
            {it.id === 3 && current !== null && current <= 3 ? `${current}★` : it.label}
            {it.count > 0 && <span className="tabular-nums text-slate-500">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ============ Mode-context banner ============ */
function ContextBanner({
  tone,
  title,
  detail,
  link,
}: {
  tone: "all" | "inbox";
  title: string;
  detail: string;
  link: { href: string; label: string } | null;
}) {
  const palette =
    tone === "all"
      ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", iconBg: "bg-emerald-500" }
      : { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", iconBg: "bg-amber-500" };
  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] border mt-3 ${palette.bg} ${palette.border} ${palette.text}`}
    >
      <span className={`w-7 h-7 rounded-[8px] inline-flex items-center justify-center shrink-0 text-white ${palette.iconBg}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
        </svg>
      </span>
      <div className="min-w-0">
        <b className="font-semibold">{title}</b>
        <div className="opacity-70 leading-[1.4] mt-px">{detail}</div>
      </div>
      {link && (
        <Link
          href={link.href}
          scroll={false}
          className="ml-auto shrink-0 font-semibold underline underline-offset-[3px] hover:no-underline"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}

/* ============ SKRZYNKA — needs-reply only ============ */
function SkrzynkaPanel({
  reviews,
  totalCount,
}: {
  reviews: ReviewRow[];
  totalCount: number;
}) {
  if (reviews.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-emerald-300 rounded-2xl px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-[12px] bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M9 11l3 3L22 4" />
          </svg>
        </div>
        <div className="text-[15px] font-semibold text-emerald-700">Wszystko ogarnięte</div>
        <p className="text-[12.5px] text-slate-500 mt-1.5 max-w-[420px] mx-auto leading-[1.55]">
          {totalCount === 0
            ? "Pierwsza opinia jeszcze nie przyszła."
            : "Odpowiedziałeś/aś na wszystkie opinie. Szybkie odpowiedzi to znak jakości — klienci to zauważają."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[12.5px] text-slate-600 mb-3">
        <b className="font-semibold text-amber-700">{reviews.length}</b> {reviews.length === 1 ? "opinia czeka" : "opinii czeka"} na odpowiedź — kliknij &quot;Odpowiedz&quot; pod każdą.
      </div>
      <div className="grid gap-3">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

/* ============ STATYSTYKI ============ */
function StatystykiPanel({ reviews }: { reviews: ReviewRow[] }) {
  // Build a 12-month rating series so the chart has a real shape.
  const series = useMemo(() => {
    const now = new Date();
    const months: { label: string; avg: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = reviews.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      const avg =
        inMonth.length > 0
          ? inMonth.reduce((a, r) => a + r.rating, 0) / inMonth.length
          : 0;
      months.push({
        label: d.toLocaleDateString("pl-PL", { month: "short" }).replace(".", ""),
        avg,
        count: inMonth.length,
      });
    }
    return months;
  }, [reviews]);

  // Dimensions for the inline SVG line chart.
  const W = 700;
  const H = 220;
  const padX = 30;
  const padY = 20;
  const xStep = (W - padX * 2) / Math.max(1, series.length - 1);
  const yScale = (avg: number) => H - padY - ((avg - 1) / 4) * (H - padY * 2);
  const points = series.map((s, i) => ({
    x: padX + i * xStep,
    y: s.avg > 0 ? yScale(s.avg) : H - padY,
    on: s.avg > 0,
  }));
  const linePath = points
    .filter((p) => p.on)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-[14px] font-semibold m-0">Średnia ocena · ostatnie 12 miesięcy</h3>
          <div className="flex gap-3.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-400" />
              Średnia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-slate-200" />
              Brak danych
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]" preserveAspectRatio="none">
          {/* gridlines */}
          {[1, 2, 3, 4, 5].map((n) => (
            <g key={n}>
              <line
                x1={padX}
                x2={W - padX}
                y1={yScale(n)}
                y2={yScale(n)}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text x={padX - 6} y={yScale(n) + 3} fontSize="10" fill="#94a3b8" textAnchor="end">
                {n}★
              </text>
            </g>
          ))}
          {/* line */}
          {linePath && <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2" />}
          {/* dots */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill={p.on ? "#f59e0b" : "#cbd5e1"}
            />
          ))}
          {/* x-axis labels */}
          {series.map((s, i) => (
            <text
              key={i}
              x={padX + i * xStep}
              y={H - 4}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {s.label}
            </text>
          ))}
        </svg>
      </div>

      <div className="bg-white border border-slate-200 rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-[14px] font-semibold m-0">Słowa kluczowe</h3>
          <span className="text-[11px] text-slate-500 italic">
            Wkrótce — analiza tekstu opinii (NLP) + cluster pozytywny/negatywny.
          </span>
        </div>
        <p className="text-[12.5px] text-slate-500 max-w-[520px] leading-[1.55]">
          W kolejnej iteracji wyłonimy najczęściej powtarzające się słowa — co
          klienci chwalą („technika", „cierpliwość", „efekt"), a co krytykują —
          żebyś widział(a) swoje silne strony i obszary do poprawy bez
          przeczytywania każdej opinii osobno.
        </p>
      </div>
    </div>
  );
}

/* ============ PROŚBY (placeholder) ============ */
function ProsbyPanel() {
  return (
    <div className="bg-white border-2 border-dashed border-violet-300 rounded-2xl px-6 py-14 text-center">
      <div className="w-14 h-14 mx-auto mb-3 rounded-[12px] bg-violet-100 text-violet-700 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92V21a1 1 0 01-1.11 1A19.79 19.79 0 012 4.11 1 1 0 013 3h4.09a1 1 0 011 .75l1 4a1 1 0 01-.27 1L7 10a16 16 0 007 7l1.21-1.82a1 1 0 011-.27l4 1a1 1 0 01.75 1z" />
        </svg>
      </div>
      <div className="text-[15px] font-semibold text-slate-900">Prośby o opinię — wkrótce</div>
      <p className="text-[12.5px] text-slate-500 mt-2 max-w-[480px] mx-auto leading-[1.55]">
        Po zakończonej sesji system wyśle SMS+push do klienta z prośbą o ocenę
        (po 2 godzinach). Możesz kontrolować szablon, częstotliwość i
        przypominanie. Średnio dodaje +30% opinii.
      </p>
    </div>
  );
}

/* ============ SPORY (placeholder) ============ */
function SporyPanel() {
  return (
    <div className="bg-white border-2 border-dashed border-rose-300 rounded-2xl px-6 py-14 text-center">
      <div className="w-14 h-14 mx-auto mb-3 rounded-[12px] bg-rose-100 text-rose-700 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
        </svg>
      </div>
      <div className="text-[15px] font-semibold text-slate-900">Spory — wkrótce</div>
      <p className="text-[12.5px] text-slate-500 mt-2 max-w-[480px] mx-auto leading-[1.55]">
        Zgłaszanie nieprawdziwych opinii (np. od osoby, która nigdy nie była na
        sesji). Moderacja sprawdzi historię rezerwacji i podejmie decyzję w
        ciągu 48 godzin. Trafią tu opinie ze statusem &quot;w sporze&quot;.
      </p>
    </div>
  );
}

function pluralOpinii(n: number): string {
  if (n === 1) return "opinia";
  const lastTwo = n % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return "opinii";
  const last = n % 10;
  if (last >= 2 && last <= 4) return "opinie";
  return "opinii";
}
