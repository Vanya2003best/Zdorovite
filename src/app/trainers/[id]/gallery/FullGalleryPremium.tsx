import Link from "next/link";
import type { Trainer } from "@/types";

/**
 * Full-gallery view for trainers on the Premium template. Soft slate
 * gradient bg matching the profile, emerald accent, simple 3-col 3:2 grid
 * that scales to 4-col on wide screens. No bento — Premium's voice is
 * trustworthy and clean rather than editorial.
 */
export default function FullGalleryPremium({
  trainer,
  items,
  focalMap,
}: {
  trainer: Trainer;
  items: { id: string; url: string }[];
  focalMap?: Record<string, string>;
}) {
  return (
    <div className="bg-[radial-gradient(800px_400px_at_10%_-10%,rgba(16,185,129,0.08),transparent_60%),radial-gradient(600px_400px_at_100%_0%,rgba(20,184,166,0.06),transparent_60%),linear-gradient(180deg,#f8fafc_0%,#ffffff_35%)] text-slate-900 min-h-screen antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 h-[64px] flex items-center justify-between">
          <Link href={`/trainers/${trainer.id}`} className="inline-flex items-center gap-2 text-[13px] text-slate-600 hover:text-emerald-700 transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Wróć do profilu
          </Link>
          <span className="text-[12px] text-slate-500">
            {items.length} {items.length === 1 ? "zdjęcie" : "zdjęć"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 py-12 sm:py-20">
        <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Galeria</span>
        <h1 className="text-[36px] sm:text-[48px] font-semibold tracking-tight mt-2 mb-10">
          Praca w obiektywie · {trainer.name}
        </h1>

        {items.length === 0 ? (
          <div className="text-slate-500 italic py-24 text-center">Brak zdjęć.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map((g) => (
              <div key={g.id} className="aspect-[3/2] rounded-2xl overflow-hidden border border-white/60 shadow-sm bg-slate-100 relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  style={{ objectPosition: focalMap?.[g.id] ?? "center" }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="px-4 sm:px-6 py-10 border-t border-slate-200 flex justify-between text-[12px] text-slate-500 gap-4 flex-wrap">
        <span>© {new Date().getFullYear()} NaZdrow! · {trainer.name}</span>
        <Link href={`/trainers/${trainer.id}`} className="hover:text-emerald-700 transition">← Profil</Link>
      </footer>
    </div>
  );
}
