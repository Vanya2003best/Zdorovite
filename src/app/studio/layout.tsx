import { headers } from "next/headers";
import { requireTrainer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import StudioMobileTabs from "./StudioMobileTabs";
import StudioSidebar from "./StudioSidebar";
import StudioTopBar from "./StudioTopBar";
import StudioTopBarSlot from "./StudioTopBarSlot";

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

  // /studio/design renders its own viewport-filling editor — pb-24/pb-8 on
  // <main> would leave a slate-50 strip below the editor on lg+ and an unused
  // pb-24 on mobile. Other studio pages still need the padding to clear the
  // mobile tab bar / breathe on lg+.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isEditor = pathname.startsWith("/studio/design");
  const mainPadding = isEditor ? "" : "pb-24 lg:pb-8";

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
        unreadMessages={unreadMessages}
      />

      <div data-studio-content className="lg:ml-[240px] flex flex-col min-h-screen">
        <StudioTopBarSlot>
          <StudioTopBar
            trainerId={user.id}
            trainerSlug={trainer?.slug ?? null}
            trainerName={profile.display_name}
            email={user.email ?? null}
            avatarUrl={profile.avatar_url}
            avatarFocal={profile.avatar_focal}
          />
        </StudioTopBarSlot>

        <main className={`flex-1 ${mainPadding}`}>
          {children}
        </main>
      </div>

      <StudioMobileTabs myId={user.id} unreadMessages={unreadMessages} />
    </div>
  );
}
