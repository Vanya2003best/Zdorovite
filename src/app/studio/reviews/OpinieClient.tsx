"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReplyComposer from "./ReplyComposer";

export type ReviewRow = {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  replyText: string | null;
  replyAt: string | null;
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
  trainerSlug,
}: {
  mode: Mode;
  reviews: ReviewRow[];
  headlineRating: number;
  headlineCount: number;
  trainerSlug: string | null;
}) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode") as Mode | null;
  const mode: Mode = MODES.some((m) => m.id === modeParam) ? (modeParam as Mode) : initialMode;

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
          {trainerSlug && (
            <Link
              href={`/trainers/${trainerSlug}#reviews`}
              target="_blank"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-700 hover:border-slate-300"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Zobacz publicznie
            </Link>
          )}
          <button
            type="button"
            disabled
            title="Wkrótce — wysyłka prośby o opinię do klientów po sesji"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60"
          >
            + Poproś o opinię
          </button>
        </div>
      </div>

      {/* Mode switcher */}
      <ModeSwitcher mode={mode} reviewsTotal={reviews.length} needsReplyCount={needsReply.length} />

      {/* Summary strip — visible on Wszystkie + Skrzynka */}
      {(mode === "wszystkie" || mode === "skrzynka") && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 mb-4">
          <SummaryCard
            label="Średnia ocena"
            value={headlineRating > 0 ? headlineRating.toFixed(1).replace(".", ",") : "—"}
            unit="★"
            detail={recent ? `30 dni: ${recent.avg.toFixed(1).replace(".", ",")}` : undefined}
            valueColor="amber"
          />
          <SummaryCard
            label="Wszystkie opinie"
            value={String(headlineCount)}
            detail={recent ? `+${recent.count} w 30 dni` : "Pierwsza opinia czeka"}
          />
          <SummaryCard
            label="Wymagają odpowiedzi"
            value={String(needsReply.length)}
            detail={needsReply.length === 0 ? "Wszystko ogarnięte" : "Klienci to widzą"}
          />
          <SummaryCard
            label="Wskaźnik odpowiedzi"
            value={String(replyRate)}
            unit="%"
            detail={replyRate >= 80 ? "Świetnie" : replyRate >= 50 ? "OK" : "Mało"}
          />
          <SummaryCard
            label="5★ recenzje"
            value={String(dist[4]?.c ?? 0)}
            detail={
              headlineCount > 0
                ? `${Math.round(((dist[4]?.c ?? 0) / headlineCount) * 100)}% wszystkich`
                : "—"
            }
          />
        </div>
      )}

      {/* Content per mode */}
      {mode === "wszystkie" && (
        <ReviewsListLayout
          reviews={reviews}
          dist={dist}
          distMax={distMax}
          headlineRating={headlineRating}
          headlineCount={headlineCount}
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
  dist,
  distMax,
  headlineRating,
  headlineCount,
}: {
  reviews: ReviewRow[];
  dist: { n: number; c: number }[];
  distMax: number;
  headlineRating: number;
  headlineCount: number;
}) {
  if (reviews.length === 0) {
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
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <BigRatingCard rating={headlineRating} count={headlineCount} />
        <DistributionCard dist={dist} distMax={distMax} />
        <FeaturedQuotesCard reviews={reviews} />
      </div>
    </div>
  );
}

/* ============ Review card ============ */
function ReviewCard({ review }: { review: ReviewRow }) {
  const date = new Date(review.createdAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const initial = review.authorName.charAt(0).toUpperCase();
  const needsReply = !review.replyText;

  return (
    <article
      className={
        "bg-white border rounded-[14px] p-5 transition hover:shadow-sm " +
        (needsReply ? "border-amber-300 border-l-[3px]" : "border-slate-200 hover:border-slate-300")
      }
    >
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
            <span className="text-slate-700 font-medium">Sesja indywidualna</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Stars rating={review.rating} />
          <span className="text-[10.5px] text-slate-500">{relativeDays(review.createdAt)}</span>
        </div>
      </div>

      <p className="text-[13.5px] text-slate-800 leading-[1.55] mb-3 whitespace-pre-line">{review.text}</p>

      <ReplyComposer
        reviewId={review.id}
        initialReply={review.replyText ?? undefined}
        initialReplyAt={review.replyAt ?? undefined}
      />
    </article>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width="14"
          height="14"
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
function BigRatingCard({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 mb-3">
        Ogólna ocena
      </div>
      <div className="flex items-baseline gap-3.5">
        <div className="text-[48px] font-bold tracking-[-0.035em] text-slate-900 leading-none tabular-nums">
          {rating > 0 ? rating.toFixed(1).replace(".", ",") : "—"}
        </div>
        <div className="flex flex-col gap-1">
          <Stars rating={Math.round(rating)} />
          <div className="text-[11.5px] text-slate-500">
            {count} {count === 1 ? "opinia" : pluralOpinii(count)}
          </div>
        </div>
      </div>
    </div>
  );
}

function DistributionCard({
  dist,
  distMax,
}: {
  dist: { n: number; c: number }[];
  distMax: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 mb-3">
        Rozkład ocen
      </div>
      <div className="grid gap-1.5">
        {[...dist].reverse().map(({ n, c }) => (
          <div key={n} className="grid grid-cols-[18px_1fr_30px] items-center gap-2 text-[12px]">
            <span className="font-semibold text-slate-700 tabular-nums">{n}</span>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={
                  "h-full rounded-full " +
                  (n === 5 ? "bg-emerald-500" : n === 1 ? "bg-rose-500" : "bg-amber-400")
                }
                style={{ width: `${(c / distMax) * 100}%` }}
              />
            </div>
            <span className="text-slate-500 tabular-nums text-right">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturedQuotesCard({ reviews }: { reviews: ReviewRow[] }) {
  // Pick up to 2 of the highest-rated, longest reviews — these read
  // best as featured testimonials.
  const featured = useMemo(() => {
    return [...reviews]
      .filter((r) => r.rating >= 5 && r.text.length > 80)
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 2);
  }, [reviews]);
  if (featured.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 mb-3">
        Cytaty <span className="text-slate-500 font-medium tracking-normal normal-case ml-1">5★ z dłuższym tekstem</span>
      </div>
      <div className="space-y-2">
        {featured.map((r) => (
          <div
            key={r.id}
            className="rounded-[10px] p-3.5 border border-emerald-200"
            style={{ background: "linear-gradient(135deg,#ecfdf5,#f0fdfa)" }}
          >
            <p className="text-[13px] text-slate-800 leading-[1.5] italic m-0 mb-2 line-clamp-3">
              {r.text}
            </p>
            <div className="text-[11.5px] text-slate-700 font-semibold">{r.authorName}</div>
          </div>
        ))}
      </div>
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
