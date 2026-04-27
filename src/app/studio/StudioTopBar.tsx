import NotificationsBell from "@/components/NotificationsBell";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import StudioNavMenu from "./StudioNavMenu";
import StudioPageTitle from "./StudioPageTitle";

/**
 * Top bar for /studio/* pages.
 * - Mobile (lg-): hamburger Menu button (drawer) + section title + bell + avatar.
 * - Desktop (lg+): Menu button is hidden — the persistent <StudioSidebar/> on the
 *   left replaces it. Only the section title + bell + utilities remain.
 */
export default async function StudioTopBar({
  trainerId,
  trainerSlug,
  trainerName,
  avatarUrl,
}: {
  trainerId: string;
  trainerSlug: string | null;
  trainerName: string;
  avatarUrl: string | null;
}) {
  const [recentNotifs, unreadNotifs] = await Promise.all([
    getRecentNotifications(trainerId, 12),
    getUnreadNotificationCount(trainerId),
  ]);

  const initial = (trainerName || "?").charAt(0).toUpperCase();

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
        {/* Avatar only on mobile (sidebar shows it on desktop). */}
        <div className="lg:hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-[11px] object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-sm">
              {initial}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
