import Link from "next/link";

/**
 * Floating "Edit profile" button visible only to the profile owner when
 * they're viewing their own public page. Clicking opens the studio editor
 * — there is no longer an in-page editing mode on /trainers/[id].
 */
export default function EditProfileFab(_: { slug: string }) {
  return (
    <Link
      href="/studio/design"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-emerald-500 text-white font-medium text-sm shadow-[0_14px_36px_-8px_rgba(16,185,129,0.5)] hover:brightness-110 hover:-translate-y-0.5 transition"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      Edytuj profil
    </Link>
  );
}
