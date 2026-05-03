import AccountMenu from "@/components/AccountMenu";
import NotificationsBell from "@/components/NotificationsBell";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import StudioNavMenu from "./StudioNavMenu";
import StudioPageTitle from "./StudioPageTitle";

/**
 * Top bar for /studio/* pages.
 * - Mobile (lg-): hamburger Menu button (drawer) + section title.
 * - Desktop (lg+): no hamburger — the persistent StudioSidebar replaces it.
 * Right side on both: NotificationsBell + AccountMenu (avatar dropdown
 *   with display_name + email + Wyloguj).
 */
export default async function StudioTopBar({
  trainerId,
  trainerSlug,
  trainerName,
  email,
  avatarUrl,
  avatarFocal,
}: {
  trainerId: string;
  trainerSlug: string | null;
  trainerName: string;
  email: string | null;
  avatarUrl: string | null;
  avatarFocal: string | null;
}) {
  const [recentNotifs, unreadNotifs] = await Promise.all([
    getRecentNotifications(trainerId, 12),
    getUnreadNotificationCount(trainerId),
  ]);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-5 sticky top-0 z-30 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="lg:hidden">
          <StudioNavMenu trainerSlug={trainerSlug} trainerName={trainerName} avatarUrl={avatarUrl} />
        </div>
        <StudioPageTitle />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationsBell
          myId={trainerId}
          initialNotifications={recentNotifs}
          initialUnreadCount={unreadNotifs}
          messagesLink="/studio/messages"
        />
        <AccountMenu
          displayName={trainerName}
          email={email}
          avatarUrl={avatarUrl}
          avatarFocal={avatarFocal}
        />
      </div>
    </header>
  );
}
