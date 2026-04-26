import { requireTrainer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import StudioSidebar from "./StudioSidebar";
import StudioMobileTabs from "./StudioMobileTabs";

/**
 * Studio = trainer-only ecosystem. Discord-style sidebar on desktop, bottom tabs on mobile.
 * Replaces the public Header on /studio/* routes.
 *
 * Non-trainers are redirected away by requireTrainer (clients → /account, guests → /login).
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireTrainer("/studio");

  const supabase = await createClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug, published")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <StudioSidebar
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
        slug={trainer?.slug ?? null}
        published={trainer?.published ?? false}
      />

      <main className="flex-1 min-w-0 sm:ml-[240px] pb-20 sm:pb-8">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-6 sm:py-10">
          {children}
        </div>
      </main>

      <StudioMobileTabs />
    </div>
  );
}
