"use client";

import { useState } from "react";
import type { Review } from "@/types";

const INITIAL_VISIBLE = 4;

/**
 * Premium template review grid with show-more behaviour. First 4 reviews
 * render in a 2-column grid; "Pokaż więcej opinii (N)" expands to all,
 * "Pokaż mniej" collapses back. Card styling stays in this component —
 * white-glass card, emerald avatar circle, amber stars, optional
 * emerald-bordered reply block — same as it was inline in PremiumProfile
 * before extraction.
 */
export default function PremiumReviewsList({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, INITIAL_VISIBLE);
  const hidden = reviews.length - INITIAL_VISIBLE;

  return (
    <>
      <div className="grid @[640px]:grid-cols-2 gap-3.5">
        {visible.map((review) => {
          const dateFormatted = new Date(review.date).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <div key={review.id} className="bg-white/80 backdrop-blur-sm border border-white/70 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-sm">
                  {review.authorName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{review.authorName}</div>
                  <div className="text-xs text-slate-500">{dateFormatted}</div>
                </div>
              </div>
              <div className="text-amber-400 text-sm mt-2.5">★★★★★</div>
              <p className="text-sm text-slate-700 leading-relaxed mt-2">{review.text}</p>
              {review.replyText && (
                <div className="mt-3 pl-3 border-l-2 border-emerald-300 bg-emerald-50/50 rounded-r-lg p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-emerald-700 font-semibold mb-1">
                    Odpowiedź od trenera
                  </div>
                  <p className="text-[13px] text-slate-700 leading-relaxed m-0 whitespace-pre-line">
                    {review.replyText}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hidden > 0 && !expanded && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition"
          >
            Pokaż więcej opinii ({hidden})
          </button>
        </div>
      )}
      {expanded && reviews.length > INITIAL_VISIBLE && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition"
          >
            Pokaż mniej
          </button>
        </div>
      )}
    </>
  );
}
