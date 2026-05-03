import Link from "next/link";
import type { Trainer } from "@/types";

/**
 * Full-gallery view for trainers on the Signature template. Cream bg, mono
 * § labels, burgundy accent. The bento cycles in 6 — same rhythm as the
 * inline section so navigation in/out feels continuous.
 */
const SLOTS = [
  "col-span-2 row-span-2 @[640px]:col-span-2 @[640px]:row-span-2",
  "col-span-1 row-span-1",
  "col-span-1 row-span-2",
  "col-span-2 row-span-1",
  "col-span-2 row-span-2",
  "col-span-2 row-span-1",
];

export default function FullGallerySignature({
  trainer,
  items,
  focalMap,
}: {
  trainer: Trainer;
  items: { id: string; url: string }[];
  focalMap?: Record<string, string>;
}) {
  const monogram = trainer.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ")
    .toUpperCase();

  return (
    <div className="bg-[#f6f1ea] text-[#1a1613] min-h-screen antialiased @container">
      <header className="sticky top-0 z-40 border-b border-[#e4dccf] bg-[#f6f1ea]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1340px] px-6 sm:px-10 h-[64px] sm:h-[72px] flex items-center justify-between">
          <Link href={`/trainers/${trainer.id}`} className="inline-flex items-center gap-2 text-[13px] text-[#3d362f] hover:text-[#7d1f1f] transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Wróć do profilu
          </Link>
          <span className="font-mono text-[11px] text-[#7d7268] tracking-[0.18em] uppercase">
            {items.length} {items.length === 1 ? "kadr" : "kadrów"}
          </span>
        </div>
      </header>

      <section className="px-6 sm:px-10 py-20 sm:py-[120px]">
        <div className="max-w-[1340px] mx-auto mb-10">
          <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.2em] uppercase mb-3.5">
            § 06 · Studio · {monogram}
          </div>
          <h1 style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-normal m-0">
            {trainer.location.split(",").slice(-1)[0]?.trim() || "Studio"}<em className="italic">.</em>
          </h1>
        </div>

        {items.length === 0 ? (
          <div className="max-w-[1340px] mx-auto text-[#7d7268] italic py-24 text-center">Brak zdjęć.</div>
        ) : (
          <div
            className="max-w-[1340px] mx-auto grid grid-cols-2 @[640px]:grid-cols-4 gap-3"
            style={{ gridAutoRows: "120px" }}
          >
            {items.map((g, i) => (
              <div key={g.id} className={`overflow-hidden rounded-sm relative group ${SLOTS[i % SLOTS.length]}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{ objectPosition: focalMap?.[g.id] ?? "center" }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 sm:px-10 py-10 border-t border-[#e4dccf] flex justify-between font-mono text-[11px] text-[#7d7268] uppercase tracking-[0.16em] gap-4 flex-wrap">
        <span>© {new Date().getFullYear()} NaZdrow! · {trainer.name}</span>
        <Link href={`/trainers/${trainer.id}`} className="hover:text-[#7d1f1f] transition">← Profil</Link>
      </footer>
    </div>
  );
}
