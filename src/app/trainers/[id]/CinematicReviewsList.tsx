"use client";

import { useState } from "react";
import type { Review, CinematicTestimonial } from "@/types";

const INITIAL_VISIBLE = 3;

type Item =
  | { kind: "review"; data: Review }
  | { kind: "testimonial"; data: CinematicTestimonial };

/**
 * Read-only review/testimonial cards for the Cinematic profile, used in both
 * editor preview and public render. DB reviews come first, then manual
 * testimonials. First 3 items show by default; rest are revealed via "Pokaż
 * więcej opinii (N)". Editor mode places the manual-testimonial editor BELOW
 * this list — these cards stay non-interactive in both modes (real reviews
 * are client-authored; testimonials get edited via the editor below).
 */
export default function CinematicReviewsList({
  reviews,
  testimonials,
}: {
  reviews: Review[];
  testimonials: CinematicTestimonial[];
}) {
  const [expanded, setExpanded] = useState(false);

  const items: Item[] = [
    ...reviews.map((r): Item => ({ kind: "review", data: r })),
    ...testimonials.map((t): Item => ({ kind: "testimonial", data: t })),
  ];
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hidden = items.length - INITIAL_VISIBLE;

  if (items.length === 0) return null;

  return (
    <>
      <div className="grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-5">
        {visible.map((it) => {
          if (it.kind === "review") {
            const r = it.data;
            return (
              <div key={`r-${r.id}`} className="bg-white/[0.025] border border-white/10 rounded-2xl p-7 flex flex-col">
                <div className="text-[#d4ff00] tracking-[0.25em] text-[13px] mb-4">
                  {"★".repeat(Math.round(r.rating))}
                </div>
                <p className="text-[16px] sm:text-[17px] leading-[1.55] text-white m-0 mb-4 tracking-[-0.005em]">
                  „{r.text}"
                </p>
                {r.replyText && (
                  <div className="mb-4 pl-3 border-l-2 border-[#d4ff00]/40">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d4ff00] mb-1.5">
                      Odpowiedź od trenera
                    </div>
                    <p className="text-[13.5px] leading-[1.55] text-white/80 m-0 whitespace-pre-line">
                      {r.replyText}
                    </p>
                  </div>
                )}
                <div className="flex gap-3 items-center pt-5 border-t border-white/10 mt-auto">
                  {r.authorAvatar && (
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.authorAvatar} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="text-[15px] font-medium tracking-[-0.005em]">{r.authorName}</div>
                    <div className="font-mono text-[12px] text-white/50 tracking-[0.05em] mt-0.5">{r.date}</div>
                  </div>
                </div>
              </div>
            );
          }
          const t = it.data;
          return (
            <div key={`t-${t.id}`} className="bg-white/[0.025] border border-white/10 rounded-2xl p-7 flex flex-col">
              <div className="text-[#d4ff00] tracking-[0.25em] text-[13px] mb-4">
                {"★".repeat(Math.max(1, Math.min(5, t.rating)))}
              </div>
              <p
                className="text-[16px] sm:text-[17px] leading-[1.55] text-white m-0 mb-6 flex-grow tracking-[-0.005em]"
                dangerouslySetInnerHTML={{ __html: `„${t.text}"` }}
              />
              <div className="flex gap-3 items-center pt-5 border-t border-white/10">
                {t.authorAvatar && (
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.authorAvatar} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <div className="text-[15px] font-medium tracking-[-0.005em]">{t.authorName}</div>
                  {t.date && (
                    <div className="font-mono text-[12px] text-white/50 tracking-[0.05em] mt-0.5">{t.date}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hidden > 0 && !expanded && (
        <div className="text-center mt-10">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-[13px] text-white/80 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 hover:bg-white/5 transition"
          >
            Pokaż więcej opinii ({hidden}) →
          </button>
        </div>
      )}
      {expanded && items.length > INITIAL_VISIBLE && (
        <div className="text-center mt-10">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-[13px] text-white/80 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 hover:bg-white/5 transition"
          >
            Pokaż mniej
          </button>
        </div>
      )}
    </>
  );
}
