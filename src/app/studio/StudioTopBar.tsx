import Link from "next/link";
import { headers } from "next/headers";
import NotificationsBell from "@/components/NotificationsBell";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import StudioNavMenu from "./StudioNavMenu";
import { STUDIO_NAV } from "./nav-items";

function titleFor(pathname: string): string {
  for (const s of STUDIO_NAV) if (s.match(pathname)) return s.label;
  return "Studio";
}

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
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const title = titleFor(pathname);

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
        <strong className="text-[14px] sm:text-[15px] font-semibold tracking-[-0.01em] truncate">
          {title}
        </strong>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationsBell
          myId={trainerId}
          initialNotifications={recentNotifs}
          initialUnreadCount={unreadNotifs}
          messagesLink="/studio/messages"
        />
        {trainerSlug && (
          <Link
            href={`/trainers/${trainerSlug}`}
            target="_blank"
            aria-label="Strona publiczna"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:border-slate-400 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
            Strona publiczna
          </Link>
        )}
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
