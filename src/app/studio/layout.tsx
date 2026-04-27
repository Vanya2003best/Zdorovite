import { requireTrainer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import StudioSidebar from "./StudioSidebar";
import StudioMobileTabs from "./StudioMobileTabs";
import StudioMobileTopBar from "./StudioMobileTopBar";

/**
 * Studio = trainer-only ecosystem. Discord-style sidebar on desktop,
 * top bar (greeting + bell) + bottom tabs on mobile. Replaces the public
 * Header on /studio/* routes.
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
    <div className="min-h-screen bg-slate-50 flex">
      <StudioSidebar
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
        slug={trainer?.slug ?? null}
        published={trainer?.published ?? false}
      />

      <div className="flex-1 min-w-0 sm:ml-[240px] flex flex-col">
        <StudioMobileTopBar
          trainerId={user.id}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
          slug={trainer?.slug ?? null}
          published={trainer?.published ?? false}
        />
        <main className="flex-1 pb-24 sm:pb-8">
          <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
            {children}
          </div>
        </main>
      </div>

      <StudioMobileTabs myId={user.id} unreadMessages={unreadMessages} />
    </div>
  );
}
