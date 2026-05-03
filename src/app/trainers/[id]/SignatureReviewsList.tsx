"use client";

import { useState } from "react";
import type { Review } from "@/types";

// Signature renders reviews in a 2-column grid, so 4 fills two clean rows
// instead of 3's awkward 1.5 rows. Other templates with single-column or
// 3-column layouts use 3.
const INITIAL_VISIBLE = 4;

/**
 * Signature template review grid with show-more behaviour. Renders the first
 * 3 reviews by default (matches Cozy / other templates); a "Pokaż więcej
 * opinii (N)" pill expands to all and a "Pokaż mniej" collapses back. Card
 * styling stays in this component — burgundy ❝, serif italic body, mono
 * author meta, optional reply block — same as it was inline in
 * SignatureProfile before extraction.
 */
export default function SignatureReviewsList({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, INITIAL_VISIBLE);
  const hidden = reviews.length - INITIAL_VISIBLE;

  return (
    <>
      <div className="grid @[1024px]:grid-cols-2 gap-8 @[1024px]:gap-12">
        {visible.map((r) => {
          const dateFormatted = new Date(r.date).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <article key={r.id} className="border-t border-[#cfc3b0] pt-7 relative">
              <span className="absolute -top-4 left-0 font-serif text-[36px] leading-none text-[#7d1f1f] bg-white pr-3">
                ❝
              </span>
              <p className="font-serif text-[15px] sm:text-[17px] leading-[1.5] tracking-[-0.01em] text-[#1a1613] m-0 mb-5">
                {r.text}
              </p>
              {r.replyText && (
                <div className="mb-5 pl-4 border-l-2 border-[#7d1f1f]/40">
                  <div className="font-mono text-[10px] text-[#7d1f1f] tracking-[0.22em] uppercase mb-1.5">
                    Odpowiedź od trenera
                  </div>
                  <p className="font-serif italic text-[14px] sm:text-[16px] leading-[1.55] text-[#3d362f] m-0 whitespace-pre-line">
                    {r.replyText}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-[#ede4d6] inline-flex items-center justify-center text-[#7d1f1f] font-semibold text-[15px] shrink-0">
                  {r.authorAvatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={r.authorAvatar} alt={r.authorName} className="w-full h-full object-cover" />
                  ) : (
                    r.authorName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-[13px] tracking-[0.08em] uppercase text-[#1a1613]">{r.authorName}</div>
                  <div className="font-mono text-[10.5px] text-[#7d7268] tracking-[0.12em] mt-0.5">
                    {dateFormatted}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hidden > 0 && !expanded && (
        <div className="text-center mt-12">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center justify-center px-6 h-[44px] rounded-full bg-transparent text-[#1a1613] border border-[#cfc3b0] hover:bg-[#1a1613] hover:text-white hover:border-[#1a1613] transition text-[13px] tracking-[0.08em] uppercase font-medium"
          >
            Pokaż więcej opinii ({hidden})
          </button>
        </div>
      )}
      {expanded && reviews.length > INITIAL_VISIBLE && (
        <div className="text-center mt-12">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center justify-center px-6 h-[44px] rounded-full bg-transparent text-[#1a1613] border border-[#cfc3b0] hover:bg-[#1a1613] hover:text-white hover:border-[#1a1613] transition text-[13px] tracking-[0.08em] uppercase font-medium"
          >
            Pokaż mniej
          </button>
        </div>
      )}
    </>
  );
}
