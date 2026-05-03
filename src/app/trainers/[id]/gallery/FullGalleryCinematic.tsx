import Link from "next/link";
import type { Trainer } from "@/types";

/**
 * Full-gallery view for trainers on the Cinematic template. Dark editorial
 * chrome, mono labels, lime accent line, dense 12-col bento that grows
 * fluidly. Slot rhythm is fixed so adding photos doesn't reflow existing
 * tiles unpredictably.
 */
const SLOTS = [
  "col-span-12 sm:col-span-8 row-span-3", // a — XL hero
  "col-span-6  sm:col-span-4 row-span-2",
  "col-span-6  sm:col-span-4 row-span-1",
  "col-span-12 sm:col-span-4 row-span-2",
  "col-span-6  sm:col-span-3 row-span-2",
  "col-span-6  sm:col-span-3 row-span-2",
  "col-span-12 sm:col-span-6 row-span-2",
  "col-span-6  sm:col-span-3 row-span-2",
  "col-span-6  sm:col-span-3 row-span-2",
  "col-span-12 sm:col-span-6 row-span-2",
  "col-span-6  sm:col-span-3 row-span-2",
  "col-span-6  sm:col-span-3 row-span-2",
];

export default function FullGalleryCinematic({
  trainer,
  items,
  focalMap,
}: {
  trainer: Trainer;
  items: { id: string; url: string }[];
  focalMap?: Record<string, string>;
}) {
  return (
    <div className="bg-[#0a0a0c] text-[#f5f5f4] min-h-screen font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0c]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12 h-[68px] flex items-center justify-between">
          <Link href={`/trainers/${trainer.id}`} className="inline-flex items-center gap-2 text-[13px] text-white/70 hover:text-white transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Wróć do profilu
          </Link>
          <span className="font-mono text-[11px] text-white/50 uppercase tracking-[0.12em]">
            {items.length} {items.length === 1 ? "kadr" : "kadrów"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-6 sm:px-12 py-16 sm:py-24">
        <div className="font-mono text-[11px] text-white/50 tracking-[0.2em] uppercase mb-3.5 flex gap-2.5 items-center">
          <span className="w-8 h-px bg-[#d4ff00]" />
          Galeria · {trainer.name}
        </div>
        <h1 style={{ fontSize: "clamp(36px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0 mb-12">
          Wszystkie kadry.
        </h1>

        {items.length === 0 ? (
          <div className="text-white/50 italic py-24 text-center">Brak zdjęć.</div>
        ) : (
          <div className="grid grid-cols-12 auto-rows-[140px] gap-3">
            {items.map((g, i) => (
              <div key={g.id} className={`group relative overflow-hidden rounded-xl ${SLOTS[i % SLOTS.length]}`}>
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
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 sm:px-12 py-10 border-t border-white/10 flex justify-between font-mono text-[11px] text-white/50 uppercase tracking-[0.1em] gap-4 flex-wrap">
        <span>© {new Date().getFullYear()} NaZdrow! · {trainer.name}</span>
        <Link href={`/trainers/${trainer.id}`} className="hover:text-white transition">← Profil</Link>
      </footer>
    </div>
  );
}
