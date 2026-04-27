import { requireTrainer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import StudioMobileTabs from "./StudioMobileTabs";
import StudioSidebar from "./StudioSidebar";
import StudioTopBar from "./StudioTopBar";

/**
 * Studio = trainer-only ecosystem.
 * - Desktop (lg+): permanent left sidebar (StudioSidebar) with all sections.
 * - Mobile (<lg): top bar with hamburger Menu drawer (StudioNavMenu) +
 *   bottom tabs for thumb-reach.
 * - Editor (/studio/design) renders inside the same chrome but lays its
 *   preview + settings panel below in its own grid.
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
    <div className="min-h-screen bg-slate-50 flex flex-col lg:block">
      <StudioSidebar
        trainerId={user.id}
        trainerSlug={trainer?.slug ?? null}
        trainerName={profile.display_name}
        avatarUrl={profile.avatar_url}
        unreadMessages={unreadMessages}
      />

      <div className="lg:ml-[280px] flex flex-col min-h-screen">
        <StudioTopBar
          trainerId={user.id}
          trainerSlug={trainer?.slug ?? null}
          trainerName={profile.display_name}
          avatarUrl={profile.avatar_url}
        />

        <main className="flex-1 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      <StudioMobileTabs myId={user.id} unreadMessages={unreadMessages} />
    </div>
  );
}
