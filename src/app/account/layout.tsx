import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import AccountTopBar from "./AccountTopBar";

/**
 * /account chrome — OLX-style horizontal nav, parallel to /studio.
 *
 * Was a 240px left sidebar (AccountSidebar.tsx) + mobile bottom tab bar.
 * Both removed in favour of the same dark-teal top strip + page tabs we
 * ship under /studio, so the two surfaces feel like one app.
 *
 * Visual reference: studio/StudioTopBar.tsx + design 35-studio-klienci.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const cu = await getCurrentUser();
  const displayName = cu?.profile.display_name ?? cu?.user.email ?? "Konto";
  const email = cu?.user.email ?? null;
  const avatarUrl = cu?.profile.avatar_url ?? null;
  const avatarFocal = cu?.profile.avatar_focal ?? null;

  // Initial unread count seeds <MessagesBadge/>; live updates via realtime.
  let unreadMessages = 0;
  const myId = cu?.user.id;
  let recentNotifs: Awaited<ReturnType<typeof getRecentNotifications>> = [];
  let unreadNotifs = 0;
  if (myId) {
    const supabase = await createClient();
    const [{ count }, notifs, unreadN] = await Promise.all([
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("to_id", myId)
        .is("read_at", null),
      getRecentNotifications(myId, 12),
      getUnreadNotificationCount(myId),
    ]);
    unreadMessages = count ?? 0;
    recentNotifs = notifs;
    unreadNotifs = unreadN;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {myId && (
        <AccountTopBar
          myId={myId}
          unreadMessages={unreadMessages}
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          avatarFocal={avatarFocal}
          recentNotifs={recentNotifs}
          unreadNotifs={unreadNotifs}
        />
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}
