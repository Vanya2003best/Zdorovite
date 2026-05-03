"use client";

import { useState } from "react";
import { Review } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  reviews: Review[];
  styles: TemplateStyles;
}

const INITIAL_VISIBLE = 3;

export default function ReviewsSection({ reviews, styles: s }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, INITIAL_VISIBLE);
  const hidden = reviews.length - INITIAL_VISIBLE;

  return (
    <section id="reviews" data-section-id="reviews" className={`${s.sectionPadding} ${s.sectionBorder} scroll-mt-20`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Co mówią klienci" : "Opinie"}
      </div>
      <div>
        {visible.map((review) => {
          const dateFormatted = new Date(review.date).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
          });
          return (
            <div key={review.id} className={s.revCardStyle}>
              <div className="flex justify-between items-center">
                <span className={s.revNameStyle}>{review.authorName}</span>
                <span className={s.revDateStyle}>{dateFormatted}</span>
              </div>
              <div className={s.revStarsStyle}>★★★★★</div>
              <p className={`mt-1 ${s.revTextStyle}`}>{review.text}</p>
              {review.replyText && (
                <div className="mt-3 pl-3 border-l-2 border-current/30 opacity-90">
                  <div className={`${s.revDateStyle} uppercase tracking-[0.08em] mb-1`}>
                    Odpowiedź od trenera
                  </div>
                  <p className={`${s.revTextStyle} whitespace-pre-line`}>{review.replyText}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hidden > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={
            s.name === "cozy"
              ? "mt-4 w-full py-3 px-4 bg-white border border-orange-200 text-orange-700 rounded-full text-[14px] font-semibold hover:bg-orange-50 transition shadow-[0_2px_8px_rgba(164,95,30,0.06)]"
              : "mt-4 w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-full text-[13px] font-medium hover:bg-slate-50 transition"
          }
        >
          Pokaż więcej opinii ({hidden})
        </button>
      )}
      {expanded && reviews.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={
            s.name === "cozy"
              ? "mt-4 w-full py-3 px-4 bg-white border border-orange-200 text-orange-700 rounded-full text-[14px] font-semibold hover:bg-orange-50 transition shadow-[0_2px_8px_rgba(164,95,30,0.06)]"
              : "mt-4 w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-full text-[13px] font-medium hover:bg-slate-50 transition"
          }
        >
          Pokaż mniej
        </button>
      )}
    </section>
  );
}
