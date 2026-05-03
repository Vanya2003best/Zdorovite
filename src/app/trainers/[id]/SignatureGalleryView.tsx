"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";

type Photo = { id: string; url: string };

const INITIAL_VISIBLE = 6;

const SLOTS = [
  "col-span-2 row-span-2 @[640px]:col-span-2 @[640px]:row-span-2",
  "col-span-1 row-span-2",
  "col-span-1 row-span-2",
  "col-span-2 row-span-1",
  "col-span-2 row-span-2",
  "col-span-2 row-span-1",
];

/**
 * Signature gallery — editorial bento, 6 first-pass slots, then cycle the
 * pattern when expanded. Click any thumb → fullscreen lightbox.
 */
export default function SignatureGalleryView({
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
      <div
        className="max-w-[1340px] mx-auto grid grid-cols-2 @[640px]:grid-cols-4 gap-3"
        style={{ gridAutoRows: "120px" }}
      >
        {visible.map((g, i) => (
          <button
            type="button"
            key={g.id}
            onClick={() => open(i)}
            className={`overflow-hidden rounded-sm relative group cursor-zoom-in p-0 border-0 ${SLOTS[i % SLOTS.length] ?? ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ objectPosition: focalMap?.[g.id] ?? "center" }}
            />
          </button>
        ))}
      </div>

      {hidden > 0 && !expanded && (
        <div className="max-w-[1340px] mx-auto mt-10 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center justify-center px-6 h-[42px] rounded-full bg-transparent text-[#3d362f] border border-[#cfc3b0] hover:bg-[#1a1613] hover:text-white hover:border-[#1a1613] transition text-[13px] font-medium"
          >
            Pokaż więcej ({hidden}) →
          </button>
        </div>
      )}
      {expanded && items.length > INITIAL_VISIBLE && (
        <div className="max-w-[1340px] mx-auto mt-10 text-center">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center justify-center px-6 h-[42px] rounded-full bg-transparent text-[#3d362f] border border-[#cfc3b0] hover:bg-[#1a1613] hover:text-white hover:border-[#1a1613] transition text-[13px] font-medium"
          >
            Pokaż mniej
          </button>
        </div>
      )}

      <Lightbox gallery={urls} activeIdx={activeIdx} onClose={close} onPrev={prev} onNext={next} />
    </>
  );
}
