import Link from "next/link";
import type { Trainer } from "@/types";

/**
 * Full-gallery view for trainers on the Studio template. Off-white editorial
 * chrome, numbered "06 / Kadry" eyebrow, masonry-ish 4-col grid with the
 * burnt-orange accent. The masonry rhythm intentionally keeps tiles square so
 * a long gallery reads as a clean editorial contact sheet rather than a
 * Pinterest-style waterfall.
 */
export default function FullGalleryStudio({
  trainer,
  items,
  focalMap,
}: {
  trainer: Trainer;
  items: { id: string; url: string }[];
  focalMap?: Record<string, string>;
}) {
  return (
    <div className="bg-[#fafaf7] text-[#141413] min-h-screen antialiased font-sans">
      <header className="sticky top-0 z-40 border-b border-[#e8e6df] bg-[#fafaf7]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-10 h-[64px] flex items-center justify-between">
          <Link href={`/trainers/${trainer.id}`} className="inline-flex items-center gap-2 text-[13px] text-[#3d3d3a] hover:text-[#ff5722] transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Wróć do profilu
          </Link>
          <span className="text-[12px] text-[#77756f] tracking-[0.04em]">
            {items.length} {items.length === 1 ? "zdjęcie" : "zdjęć"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-6 sm:px-10 py-16 sm:py-24">
        <div className="text-[14px] text-[#77756f] font-medium mb-3 flex items-center gap-2">
          <span style={{ color: "#ff5722" }}>→</span>
          06 / Atelier · {trainer.name}
        </div>
        <h1 className="font-medium m-0 mb-12" style={{ fontSize: "clamp(40px, 6vw, 80px)", lineHeight: 1, letterSpacing: "-0.035em" }}>
          Atelier <em className="italic font-light text-[#77756f]">w pełnej rozdzielczości.</em>
        </h1>

        {items.length === 0 ? (
          <div className="text-[#77756f] italic py-24 text-center">Brak zdjęć.</div>
        ) : (
          <div className="grid grid-cols-2 @[640px]:grid-cols-3 @[1024px]:grid-cols-4 gap-4">
            {items.map((g) => (
              <div key={g.id} className="rounded-2xl overflow-hidden bg-[#e8e6df] aspect-[4/3] group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  style={{ objectPosition: focalMap?.[g.id] ?? "center" }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 sm:px-10 py-10 border-t border-[#e8e6df] flex justify-between text-[12px] text-[#77756f] gap-4 flex-wrap">
        <span>© {new Date().getFullYear()} NaZdrow! · {trainer.name}</span>
        <Link href={`/trainers/${trainer.id}`} className="hover:text-[#ff5722] transition">← Profil</Link>
      </footer>
    </div>
  );
}
