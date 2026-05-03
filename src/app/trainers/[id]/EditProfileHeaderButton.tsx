import Link from "next/link";

/**
 * Round icon-only "Edit profile" button intended for the Cinematic header
 * cluster (next to FavoriteButton / Umów sesję CTA). Visual sibling of
 * FavoriteButton — same 40px circle, white/10 fill, white/15 border, lime
 * accent on hover to signal it's a primary owner action.
 *
 * Rendered only when the viewing user is the trainer themselves. Sends them
 * to the studio editor — in-page editing on /trainers/[id] no longer exists.
 */
export default function EditProfileHeaderButton(_: { slug: string }) {
  return (
    <Link
      href="/studio/design"
      title="Edytuj profil"
      aria-label="Edytuj profil"
      className="w-10 h-10 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-white inline-flex items-center justify-center hover:bg-[#d4ff00]/15 hover:border-[#d4ff00]/50 hover:text-[#d4ff00] transition"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </Link>
  );
}
