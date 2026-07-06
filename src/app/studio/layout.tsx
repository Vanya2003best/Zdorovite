import { requireTrainer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import StudioTopBar from "./StudioTopBar";

/**
 * Studio chrome — OLX-style horizontal nav.
 *
 * - Dark-green topbar (logo, mini-nav, bell, account menu, "Dodaj usługę")
 * - Horizontal tabs row (Pulpit / Kalendarz / Klienci / Wiadomości / Usługi /
 *   Oceny / Płatności / Profil / Design stron)
 *
 * Replaces the previous vertical 240px sidebar (StudioSidebar.tsx, removed
 * as dead code). Visual reference: design file
 * 35-studio-klienci-olx-style.html.
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireTrainer("/studio");
  const supabase = await createClient();

  const [
    { data: trainer },
    { count: unreadMessagesCount },
    { count: klienciCountRaw },
    recentNotifs,
    unreadNotifs,
  ] = await Promise.all([
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
    // Klienci-count badge — distinct clients who ever booked with this trainer.
    // Cheap proxy: count distinct client_id in bookings. Done as a head-only
    // query on bookings since trainer_clients table may not exist on dev DBs.
    supabase
      .from("bookings")
      .select("client_id", { count: "exact", head: true })
      .eq("trainer_id", user.id),
    getRecentNotifications(user.id, 12),
    getUnreadNotificationCount(user.id),
  ]);

  const unreadMessages = unreadMessagesCount ?? 0;
  const klienciCount = klienciCountRaw ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudioTopBar
        trainerId={user.id}
        trainerSlug={trainer?.slug ?? null}
        unreadMessages={unreadMessages}
        klienciCount={klienciCount}
        displayName={profile.display_name}
        email={user.email ?? null}
        avatarUrl={profile.avatar_url}
        avatarFocal={profile.avatar_focal}
        recentNotifs={recentNotifs}
        unreadNotifs={unreadNotifs}
      />

      <main className="flex-1">{children}</main>
    </div>
  );
}
