"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";

type Photo = { url: string; id?: string; focal?: string };

const INITIAL_VISIBLE = 6;

const GAL_SLOTS = [
  "@[1024px]:col-span-3 @[1024px]:row-span-2 col-span-2 row-span-2",
  "@[1024px]:col-span-3 @[1024px]:row-span-1 col-span-2 row-span-2",
  "@[1024px]:col-span-3 @[1024px]:row-span-1 col-span-1 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-1 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-2 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-2 row-span-1",
];

/**
 * Luxury gallery — editorial 6-col asymmetric masonry. First 6 photos use
 * the bespoke GAL_SLOTS layout. "Pokaż więcej" expands; subsequent photos
 * cycle through the same slot pattern. Click any photo → fullscreen
 * lightbox.
 */
export default function LuxuryGalleryView({ items }: { items: Photo[] }) {
  const [expanded, setExpanded] = useState(false);
  const urls = items.map((g) => g.url);
  const { activeIdx, open, close, prev, next } = useLightbox(urls.length);

  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hidden = items.length - INITIAL_VISIBLE;

  return (
    <>
      <div
        className="max-w-[1200px] mx-auto grid grid-cols-2 @[1024px]:grid-cols-6 gap-1"
        style={{ gridAutoRows: "minmax(120px, auto)" }}
      >
        {visible.map((g, i) => (
          <button
            type="button"
            key={g.id ?? `fallback-${i}`}
            onClick={() => open(i)}
            className={`overflow-hidden relative bg-[#efe7d7] group cursor-zoom-in p-0 border-0 ${GAL_SLOTS[i % GAL_SLOTS.length] ?? ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              style={{ filter: "saturate(0.9)", objectPosition: g.focal ?? "center" }}
            />
            <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(28,26,21,0.05)]" />
          </button>
        ))}
      </div>

      {hidden > 0 && !expanded && (
        <div className="text-center mt-12">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center justify-center h-12 px-6 text-[12px] tracking-[0.18em] uppercase font-medium border border-[#8a7346] text-[#8a7346] hover:bg-[#8a7346] hover:text-[#fbf8f1] transition"
          >
            Pokaż więcej ({hidden})
          </button>
        </div>
      )}
      {expanded && items.length > INITIAL_VISIBLE && (
        <div className="text-center mt-12">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center justify-center h-12 px-6 text-[12px] tracking-[0.18em] uppercase font-medium border border-[#8a7346] text-[#8a7346] hover:bg-[#8a7346] hover:text-[#fbf8f1] transition"
          >
            Pokaż mniej
          </button>
        </div>
      )}

      <Lightbox gallery={urls} activeIdx={activeIdx} onClose={close} onPrev={prev} onNext={next} />
    </>
  );
}
