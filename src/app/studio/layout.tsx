import { requireTrainer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import StudioMobileTabs from "./StudioMobileTabs";
import StudioTopBar from "./StudioTopBar";

/**
 * Studio = trainer-only ecosystem. Single top bar with a Menu drawer
 * (StudioNavMenu) replaces the old persistent left sidebar — every section
 * lives behind the menu now. Mobile keeps the bottom tab bar for
 * thumb-reachable shortcuts. The /studio/design editor mounts its own
 * fullscreen shell on top of this.
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireTrainer("/studio");

  const supabase = await createClient();
  const [{ data: trainer }, { count: unreadMessagesCount }] = await Promise.all([
    supabase
      .from("trainers")
      .select("slug, published")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("to_id", user.id)
      .is("read_at", null),
  ]);
  const unreadMessages = unreadMessagesCount ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudioTopBar
        trainerId={user.id}
        trainerSlug={trainer?.slug ?? null}
        trainerName={profile.display_name}
        avatarUrl={profile.avatar_url}
      />

      <main className="flex-1 pb-24 sm:pb-8">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
          {children}
        </div>
      </main>

      <StudioMobileTabs myId={user.id} unreadMessages={unreadMessages} />
    </div>
  );
}
