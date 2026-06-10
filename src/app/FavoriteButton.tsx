"use client";

/**
 * Small client-only heart button used inside the landing's listing cards.
 * Lives in its own file because the parent <ListingCard> sits inside a
 * Server Component (app/page.tsx) and Server Components can't forward
 * event handlers to children — extracting the click handler into a
 * client component is the standard workaround.
 *
 * Currently stateless / visual-only — favourites aren't wired to a
 * `client_favorites` table yet. The handler just stops the surrounding
 * <Link> from triggering navigation when the heart is clicked. Once
 * favourites land, wire up the toggle action here.
 */
export default function FavoriteButton() {
  return (
    <button
      type="button"
      aria-label="Dodaj do obserwowanych"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="absolute top-2 right-2 w-[30px] h-[30px] rounded-full bg-white/95 flex items-center justify-center hover:bg-white transition"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 hover:text-red-500 transition">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </button>
  );
}
