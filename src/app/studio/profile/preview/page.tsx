import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTrainer } from "@/lib/auth";

/**
 * Fullscreen preview of the trainer's public profile inside Studio shell.
 * Iframe fills the entire content area (sidebar stays).
 * sandbox="allow-same-origin" gives auth-aware rendering but blocks all scripts/forms,
 * so the preview is naturally read-only — clicks/buttons inside don't do anything,
 * but the user CAN scroll to see the whole page.
 */
export default async function ProfilePreview() {
  const { user } = await requireTrainer("/studio/profile/preview");

  const supabase = await createClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();

  if (!trainer?.slug) redirect("/studio/profile");

  const embedUrl = `/trainers/${trainer.slug}?embed=1`;

  return (
    <>
      {/* Iframe fills the area to the right of the sidebar.
          Fixed positioning escapes the centered studio content padding. */}
      <div
        className="fixed top-0 right-0 bottom-20 sm:bottom-0 left-0 sm:left-[240px] bg-white z-10"
      >
        <iframe
          src={embedUrl}
          title="Podgląd profilu trenera"
          sandbox="allow-same-origin"
          className="w-full h-full block border-0"
        />
      </div>

      {/* Floating "back to editor" button — top-right corner, doesn't take layout space */}
      <Link
        href="/studio/profile"
        className="fixed top-4 right-4 z-20 inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium text-slate-700 border border-slate-200 bg-white/95 backdrop-blur-md shadow-sm hover:border-slate-400 transition"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        Wróć do edytora
      </Link>
    </>
  );
}
