"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";

type Photo = { url: string; id?: string; focal?: string };

const INITIAL_VISIBLE = 6;

/**
 * Public-render gallery for Studio template — 4-col grid (2 col on mobile,
 * 3 col on tablet) of rounded photos. Click any thumb → fullscreen lightbox.
 * After 6 photos, "Pokaż więcej" expands; lightbox always navigates the full
 * gallery.
 */
export default function StudioGalleryView({ items }: { items: Photo[] }) {
  const [expanded, setExpanded] = useState(false);
  const urls = items.map((g) => g.url);
  const { activeIdx, open, close, prev, next } = useLightbox(urls.length);

  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hidden = items.length - INITIAL_VISIBLE;

  return (
    <>
      <div className="grid grid-cols-2 @[640px]:grid-cols-3 @[1024px]:grid-cols-4 gap-4">
        {visible.map((g, i) => (
          <button
            type="button"
            key={g.id ?? `fallback-${i}`}
            onClick={() => open(i)}
            className="rounded-2xl overflow-hidden bg-[#e8e6df] cursor-zoom-in p-0 border-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.url}
              alt=""
              className="w-full h-full object-cover hover:scale-[1.03] transition"
              style={{ objectPosition: g.focal ?? "center" }}
            />
          </button>
        ))}
      </div>

      {hidden > 0 && !expanded && (
        <div className="text-center mt-8">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium hover:bg-[#141413] hover:text-white hover:border-[#141413] transition"
          >
            Pokaż więcej zdjęć ({hidden}) →
          </button>
        </div>
      )}
      {expanded && items.length > INITIAL_VISIBLE && (
        <div className="text-center mt-8">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium hover:bg-[#141413] hover:text-white hover:border-[#141413] transition"
          >
            Pokaż mniej
          </button>
        </div>
      )}

      <Lightbox gallery={urls} activeIdx={activeIdx} onClose={close} onPrev={prev} onNext={next} />
    </>
  );
}
