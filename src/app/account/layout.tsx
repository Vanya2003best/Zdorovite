import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import MessagesBadge from "./MessagesBadge";
import NotificationsBell from "./NotificationsBell";

type NavItem = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: React.ReactNode;
  /** When true, the live <MessagesBadge/> is rendered next to this item. */
  hasUnreadBadge?: boolean;
};

const HomeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);
const CalIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const SearchIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const ChatIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const PulseIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const NAV: NavItem[] = [
  { href: "/account", label: "Pulpit", match: (p) => p === "/account", icon: HomeIcon },
  { href: "/account/bookings", label: "Sesje", match: (p) => p.startsWith("/account/bookings"), icon: CalIcon },
  { href: "/trainers", label: "Trenerzy", match: (p) => p.startsWith("/trainers"), icon: SearchIcon },
  {
    href: "/account/messages",
    label: "Czat",
    match: (p) => p.startsWith("/account/messages"),
    icon: ChatIcon,
    hasUnreadBadge: true,
  },
  { href: "/account/progress", label: "Postępy", match: (p) => p.startsWith("/account/progress"), icon: PulseIcon },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const cu = await getCurrentUser();
  const displayName = cu?.profile.display_name ?? cu?.user.email ?? "Konto";
  const firstName = displayName.split(" ")[0] || "Konto";
  const avatarUrl = cu?.profile.avatar_url ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  // Initial unread count — used as the SSR seed for <MessagesBadge/>, which
  // then keeps itself in sync via Supabase realtime (INSERT/UPDATE on messages).
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
    <div className="bg-slate-100 min-h-[100dvh] flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-7 sticky top-0 z-50">
        {/* Mobile: greeting on left. Desktop: logo + nav. */}
        <div className="flex items-center gap-6 min-w-0">
          {/* Mobile greeting */}
          <div className="md:hidden min-w-0">
            <div className="text-[12px] text-slate-500 leading-tight">Cześć,</div>
            <div className="text-[16px] font-semibold leading-tight truncate">{firstName} 👋</div>
          </div>

          {/* Desktop logo */}
          <Link href="/" className="hidden md:flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
              Z
            </span>
            <span className="font-semibold text-[15px] tracking-[-0.01em]">NaZdrow!</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`relative px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                  {item.hasUnreadBadge && myId && (
                    <MessagesBadge initialCount={unreadMessages} myId={myId} variant="inline" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search — desktop only. Real text-search/autocomplete is a follow-up;
              for now this is an honest jump into the catalog where filters live. */}
          <Link
            href="/trainers"
            aria-label="Szukaj trenera"
            className="hidden lg:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-[9px] px-3 py-1.5 min-w-[280px] text-[13px] text-slate-500 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Szukaj trenera w katalogu
          </Link>

          {/* Notifications */}
          {myId && (
            <NotificationsBell
              myId={myId}
              initialNotifications={recentNotifs}
              initialUnreadCount={unreadNotifs}
            />
          )}

          {/* Avatar — pill on desktop, square on mobile */}
          <Link
            href="/account"
            className="inline-flex gap-2 items-center md:pl-1 md:pr-2.5 md:py-1 md:bg-white md:border md:border-slate-200 md:rounded-full md:hover:border-slate-400 transition"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-9 h-9 md:w-7 md:h-7 rounded-[11px] md:rounded-full object-cover" />
            ) : (
              <span className="w-9 h-9 md:w-7 md:h-7 rounded-[11px] md:rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center text-sm md:text-xs font-semibold">
                {initial}
              </span>
            )}
            <span className="text-[13px] font-medium hidden md:inline">{displayName}</span>
          </Link>
        </div>
      </header>

      {/* Main content — padded bottom on mobile to clear the tab bar */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Nawigacja główna"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[84px] grid grid-cols-5 pt-1.5 pb-[18px] bg-white/[0.94] backdrop-blur-xl border-t border-slate-200"
      >
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                active ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              <span className="relative">
                {item.icon}
                {item.hasUnreadBadge && myId && (
                  <MessagesBadge initialCount={unreadMessages} myId={myId} variant="floating" />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
