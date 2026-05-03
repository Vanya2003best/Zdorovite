"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";

type Photo = { id: string; url: string };

const INITIAL_VISIBLE = 6;

// Bento slot layout — first 6 slots are used at INITIAL_VISIBLE; expand
// reveals the rest with the same 9-slot pattern repeating.
const SLOTS = [
  "col-span-12 sm:col-span-6 row-span-3", // a — large
  "col-span-6 sm:col-span-3 row-span-2", // b
  "col-span-6 sm:col-span-3 row-span-2", // c
  "col-span-6 sm:col-span-4 row-span-2", // d
  "col-span-6 sm:col-span-4 row-span-2", // e
  "col-span-12 sm:col-span-4 row-span-2", // f
  "col-span-6 sm:col-span-3 row-span-2", // g
  "col-span-6 sm:col-span-5 row-span-2", // h — wide
  "col-span-12 sm:col-span-4 row-span-2", // i
];

export default function CinematicGalleryView({
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
      <div className="grid grid-cols-12 auto-rows-[140px] gap-3 px-6 sm:px-12">
        {visible.map((g, i) => (
          <button
            type="button"
            key={g.id}
            onClick={() => open(i)}
            className={`overflow-hidden rounded-xl ${SLOTS[i % SLOTS.length] ?? "col-span-4 row-span-2"} relative group cursor-zoom-in p-0 border-0`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              style={{ objectPosition: focalMap?.[g.id] ?? "center" }}
            />
            <span className="absolute left-3 bottom-3 z-10 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] text-white bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Kadr · {String(i + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {hidden > 0 && !expanded && (
        <div className="text-center mt-10 px-6 sm:px-12">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-[13px] text-white/80 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 hover:bg-white/5 transition"
          >
            Pokaż więcej kadrów ({hidden}) →
          </button>
        </div>
      )}
      {expanded && items.length > INITIAL_VISIBLE && (
        <div className="text-center mt-10 px-6 sm:px-12">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-[13px] text-white/80 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 hover:bg-white/5 transition"
          >
            Pokaż mniej
          </button>
        </div>
      )}

      <Lightbox gallery={urls} activeIdx={activeIdx} onClose={close} onPrev={prev} onNext={next} />
    </>
  );
}
