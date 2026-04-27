import Link from "next/link";
import NotificationsBell from "@/components/NotificationsBell";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";

/**
 * Mobile-only top bar for /studio/*. Mirrors the /account top bar shape:
 * greeting + notification bell + avatar. Desktop has the StudioSidebar instead.
 */
export default async function StudioMobileTopBar({
  trainerId,
  displayName,
  avatarUrl,
  slug,
  published,
}: {
  trainerId: string;
  displayName: string;
  avatarUrl: string | null;
  slug: string | null;
  published: boolean;
}) {
  const firstName = displayName.split(" ")[0] || "Trener";
  const initial = displayName.charAt(0).toUpperCase();

  const [recentNotifs, unreadNotifs] = await Promise.all([
    getRecentNotifications(trainerId, 12),
    getUnreadNotificationCount(trainerId),
  ]);

  return (
    <header className="sm:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-emerald-700 font-semibold uppercase tracking-[0.06em] leading-none">
          NaZdrow! Studio
        </div>
        <div className="text-[15px] font-semibold leading-tight truncate mt-0.5">
          {firstName}
          {published === false && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
              szkic
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationsBell
          myId={trainerId}
          initialNotifications={recentNotifs}
          initialUnreadCount={unreadNotifs}
          messagesLink="/studio/messages"
        />
        {slug && (
          <Link
            href={`/trainers/${slug}`}
            target="_blank"
            aria-label="Strona publiczna"
            className="w-9 h-9 rounded-[11px] bg-slate-100 inline-flex items-center justify-center text-slate-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </Link>
        )}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-[11px] object-cover" />
        ) : (
          <span className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-sm">
            {initial}
          </span>
        )}
      </div>
    </header>
  );
}
