"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";

type Photo = { id: string; url: string };

const INITIAL_VISIBLE = 6;

/**
 * Public-render gallery for Premium template — 2/3 col grid of soft-shadowed
 * cards. Click any thumb → fullscreen lightbox with swipe / arrows / Esc.
 * After 6 photos, a "Pokaż więcej" pill expands to show the rest. Lightbox
 * always swipes through the FULL gallery, even when only the first 6 are
 * visible in the grid.
 */
export default function PremiumGalleryView({
  items,
  focalMap,
}: {
  items: Photo[];
  focalMap?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const urls = items.map((g) => g.url);
  const { activeIdx, open, close, prev, next } = useLightbox(urls.length);

  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hidden = items.length - INITIAL_VISIBLE;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {visible.map((g, i) => (
          <button
            type="button"
            key={g.id}
            onClick={() => open(i)}
            className="aspect-[3/2] rounded-2xl overflow-hidden border border-white/60 shadow-sm relative group cursor-zoom-in p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              style={{ objectPosition: focalMap?.[g.id] ?? "center" }}
            />
          </button>
        ))}
      </div>

      {hidden > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-5 w-full py-3 px-4 bg-white/75 backdrop-blur-sm border border-white/70 text-slate-700 rounded-full text-[13px] font-medium hover:bg-white transition shadow-sm"
        >
          Pokaż więcej zdjęć ({hidden})
        </button>
      )}
      {expanded && items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-5 w-full py-3 px-4 bg-white/75 backdrop-blur-sm border border-white/70 text-slate-700 rounded-full text-[13px] font-medium hover:bg-white transition shadow-sm"
        >
          Pokaż mniej
        </button>
      )}

      <Lightbox gallery={urls} activeIdx={activeIdx} onClose={close} onPrev={prev} onNext={next} />
    </>
  );
}
