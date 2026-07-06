"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  REVIEW_CATEGORIES,
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  reviewCategoryLabel,
  type MyReview,
  type ReviewCategoryKey,
} from "@/lib/db/reviews";
import { createReview } from "./review-actions";

/**
 * Inline review form for a completed session card on /account/bookings.
 * Tappable 1–5 stars, optional category chips ("what stood out"),
 * textarea with a min-length hint. After a successful submit the card
 * flips to the thank-you state immediately (local), then router.refresh()
 * re-syncs pending counters + other cards of the same trainer.
 */

export function ReviewForm({
  bookingId,
  trainerName,
  onClose,
}: {
  bookingId: string;
  trainerName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [cats, setCats] = useState<ReviewCategoryKey[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<MyReview | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) return <ReviewThanks review={submitted} />;

  const toggleCat = (key: ReviewCategoryKey) =>
    setCats((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const trimmedLen = text.trim().length;

  const submit = () => {
    setError(null);
    if (rating < 1) {
      setError("Wybierz ocenę od 1 do 5 gwiazdek.");
      return;
    }
    if (trimmedLen < REVIEW_TEXT_MIN) {
      setError(`Opisz swoje wrażenia — co najmniej ${REVIEW_TEXT_MIN} znaków (masz ${trimmedLen}).`);
      return;
    }
    if (trimmedLen > REVIEW_TEXT_MAX) {
      setError(`Opinia może mieć maksymalnie ${REVIEW_TEXT_MAX} znaków.`);
      return;
    }
    const payload: MyReview = { rating, text: text.trim(), categories: cats };
    startTransition(async () => {
      const res = await createReview({
        bookingId,
        rating: payload.rating,
        text: payload.text,
        categories: payload.categories,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSubmitted(payload);
      router.refresh();
    });
  };

  return (
    <div className="col-span-full border-t border-slate-100 pt-3.5 mt-1">
      <div className="text-[12.5px] font-semibold text-slate-900 mb-2">
        Oceń sesję u {trainerName}
      </div>

      {/* Stars */}
      <div className="flex items-center gap-1 mb-2.5" role="radiogroup" aria-label="Ocena od 1 do 5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= (hovered || rating);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? "gwiazdka" : n < 5 ? "gwiazdki" : "gwiazdek"}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className={
                "text-[24px] leading-none transition-transform hover:scale-110 " +
                (active ? "text-amber-400" : "text-slate-300")
              }
            >
              ★
            </button>
          );
        })}
        {rating > 0 && (
          <span className="text-[11.5px] text-slate-500 ml-1.5">{rating}/5</span>
        )}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        <span className="text-[11px] text-slate-500">Co było mocną stroną?</span>
        {REVIEW_CATEGORIES.map((c) => {
          const on = cats.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleCat(c.key)}
              className={
                "h-[26px] px-2.5 inline-flex items-center rounded-full border text-[11px] font-medium transition " +
                (on
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")
              }
            >
              {c.label}
            </button>
          );
        })}
        <span className="text-[10.5px] text-slate-400">(opcjonalnie)</span>
      </div>

      {/* Text */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={REVIEW_TEXT_MAX + 200}
        placeholder={`Opisz swoje wrażenia z treningów (min. ${REVIEW_TEXT_MIN} znaków)…`}
        className="w-full rounded-[10px] border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 resize-y"
      />
      <div className="flex items-center justify-between mt-1 mb-2">
        <span className={`text-[10.5px] ${trimmedLen > 0 && trimmedLen < REVIEW_TEXT_MIN ? "text-amber-600" : "text-slate-400"}`}>
          {trimmedLen < REVIEW_TEXT_MIN
            ? `Jeszcze min. ${REVIEW_TEXT_MIN - trimmedLen} znaków`
            : "Dzięki, to wystarczy!"}
        </span>
        <span className="text-[10.5px] text-slate-400 tabular-nums">
          {trimmedLen}/{REVIEW_TEXT_MAX}
        </span>
      </div>

      {error && (
        <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2 mb-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-8 px-4 inline-flex items-center rounded-[8px] bg-slate-900 text-white text-[12px] font-semibold hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Wysyłanie…" : "Wyślij opinię"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="h-8 px-4 inline-flex items-center rounded-[8px] border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

/** Post-submit / already-reviewed state on the session card. */
export function ReviewThanks({ review }: { review: MyReview }) {
  return (
    <div className="col-span-full border-t border-slate-100 pt-3 mt-1">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-[12.5px] font-semibold text-emerald-700">
          Dziękujemy za opinię!
        </span>
        <span className="text-[13px] leading-none text-amber-400" aria-label={`Ocena ${review.rating} na 5`}>
          {"★".repeat(review.rating)}
          <span className="text-slate-200">{"★".repeat(5 - review.rating)}</span>
        </span>
        {review.categories.map((k) => (
          <span
            key={k}
            className="h-[22px] px-2 inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-medium"
          >
            {reviewCategoryLabel(k)}
          </span>
        ))}
      </div>
      <p className="text-[12.5px] text-slate-600 leading-relaxed m-0">{review.text}</p>
    </div>
  );
}
