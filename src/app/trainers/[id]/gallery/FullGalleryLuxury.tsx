import Link from "next/link";
import type { Trainer } from "@/types";

/**
 * Full-gallery view for trainers on the Luxury template. Ivory bg, serif
 * roman-numeral chrome, asymmetric editorial 6-col grid with gold accents.
 * Gallery slots cycle through a 6-photo rhythm so long galleries stay
 * editorial — never a uniform contact sheet.
 */
const SLOTS = [
  "@[1024px]:col-span-3 @[1024px]:row-span-2 col-span-2 row-span-2",
  "@[1024px]:col-span-3 @[1024px]:row-span-1 col-span-2 row-span-1",
  "@[1024px]:col-span-3 @[1024px]:row-span-1 col-span-1 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-1 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-2 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-2 row-span-1",
];

export default function FullGalleryLuxury({
  trainer,
  items,
  focalMap,
}: {
  trainer: Trainer;
  items: { id: string; url: string }[];
  focalMap?: Record<string, string>;
}) {
  return (
    <div className="bg-[#f6f1e8] text-[#1c1a15] min-h-screen antialiased @container">
      <header className="sticky top-0 z-40 border-b border-[#d9cfb8] bg-[#f6f1e8]/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1340px] px-6 sm:px-10 h-[64px] sm:h-[72px] flex items-center justify-between">
          <Link href={`/trainers/${trainer.id}`} className="inline-flex items-center gap-2 text-[13px] text-[#3a3730] hover:text-[#8a7346] transition tracking-[0.02em]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Wróć do profilu
          </Link>
          <span className="font-serif italic text-[14px] text-[#7a7365]">
            Atelier · {items.length} {items.length === 1 ? "kadr" : "kadrów"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[1340px] px-6 sm:px-10 py-16 sm:py-24">
        <div className="text-[11px] sm:text-[12px] tracking-[0.22em] uppercase text-[#7a7365] mb-4 flex items-center gap-3">
          <span className="font-serif italic text-[16px] tracking-normal text-[#8a7346] normal-case">IV.</span>
          Atelier · {trainer.name}
        </div>
        <h1 className="font-serif font-light m-0 mb-12" style={{ fontSize: "clamp(40px, 6vw, 80px)", lineHeight: 1, letterSpacing: "-0.025em" }}>
          Atelier <em className="not-italic font-normal">w pełnej kolekcji.</em>
        </h1>

        {items.length === 0 ? (
          <div className="text-[#7a7365] italic py-24 text-center font-serif">Brak zdjęć.</div>
        ) : (
          <div
            className="max-w-[1200px] mx-auto grid grid-cols-2 @[1024px]:grid-cols-6 gap-1"
            style={{ gridAutoRows: "minmax(120px, auto)" }}
          >
            {items.map((g, i) => (
              <div key={g.id} className={`overflow-hidden relative bg-[#efe7d7] group ${SLOTS[i % SLOTS.length]}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  style={{ filter: "saturate(0.9)", objectPosition: focalMap?.[g.id] ?? "center" }}
                />
                <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(28,26,21,0.05)]" />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 sm:px-10 py-10 border-t border-[#d9cfb8] flex justify-between text-[12px] text-[#7a7365] gap-4 flex-wrap tracking-[0.06em]">
        <span>© {new Date().getFullYear()} NaZdrow! · {trainer.name}</span>
        <Link href={`/trainers/${trainer.id}`} className="hover:text-[#8a7346] transition">← Profil</Link>
      </footer>
    </div>
  );
}
