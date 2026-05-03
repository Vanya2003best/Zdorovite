"use client";

import { useState } from "react";
import { TemplateStyles } from "@/data/templates";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";

interface Props {
  gallery: string[];
  styles: TemplateStyles;
}

const INITIAL_VISIBLE = 6;

export default function GallerySection({ gallery, styles: s }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { activeIdx, open, close, prev, next } = useLightbox(gallery.length);

  if (gallery.length === 0) return null;

  const visible = expanded ? gallery : gallery.slice(0, INITIAL_VISIBLE);
  const hidden = gallery.length - INITIAL_VISIBLE;

  return (
    <section id="gallery" data-section-id="gallery" className={`${s.sectionPadding} ${s.sectionBorder} scroll-mt-20`}>
      <div className={s.sectionTitleStyle}>Galeria</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((src, i) => (
          <button
            type="button"
            key={i}
            onClick={() => open(i)}
            className="aspect-square overflow-hidden rounded-xl bg-gray-100 cursor-zoom-in group p-0 border-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Zdjęcie ${i + 1}`}
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          </button>
        ))}
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
          Pokaż więcej zdjęć ({hidden})
        </button>
      )}
      {expanded && gallery.length > INITIAL_VISIBLE && (
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

      <Lightbox gallery={gallery} activeIdx={activeIdx} onClose={close} onPrev={prev} onNext={next} />
    </section>
  );
}
