"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MessagesBadge from "./MessagesBadge";
import NotificationsBell from "@/components/NotificationsBell";
import type { Notification } from "@/lib/db/notifications";

const HomeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);
const CalIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const ChartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
  </svg>
);
const CheckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <path d="M9 11l3 3L22 4" />
  </svg>
);
const PackageIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
  </svg>
);
const PersonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a8 8 0 0116 0v1" />
  </svg>
);
const ChatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const CardIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
const SettingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
  /** Live unread count from <MessagesBadge/>. */
  hasUnreadBadge?: boolean;
  /** Static muted badge (e.g. package progress "4/8"). */
  staticBadge?: string;
  /** Greys out the row and disables clicks when the route doesn't exist yet. */
  soon?: boolean;
};

type SubItem = { href: string; label: string; match: (p: string) => boolean };
type SectionItem = NavItem & { subItems?: SubItem[] };
type Section = { group: string | null; items: SectionItem[] };

// Client-side mirror of the trainer's 4-section layout: Pulpit / Treningi
// (Kalendarz analog) / Trener (Klienci analog — one trainer per client) /
// Profil (own account: package, payments, settings). All former secondary
// pages stay routable; they just live as sub-links under their new parent.
const SECTIONS: Section[] = [
  {
    group: null,
    items: [
      { href: "/account", label: "Pulpit", icon: HomeIcon, match: (p) => p === "/account" },
      {
        href: "/account/bookings",
        label: "Treningi",
        icon: CalIcon,
        // Bookings parent absorbs Postępy + Mój plan — they're all
        // "what's happening with my training" sub-views.
        match: (p) =>
          p.startsWith("/account/bookings") ||
          p.startsWith("/account/progress") ||
          p.startsWith("/account/plan"),
        subItems: [
          { href: "/account/progress", label: "Postępy", match: (p) => p.startsWith("/account/progress") },
          { href: "/account/plan",     label: "Mój plan", match: (p) => p.startsWith("/account/plan") },
        ],
      },
      {
        href: "/account/trainer",
        label: "Trener",
        icon: PersonIcon,
        // Klienci-analog: one trainer per client + chat with them.
        match: (p) =>
          p.startsWith("/account/trainer") ||
          p.startsWith("/account/messages"),
        subItems: [
          { href: "/account/messages", label: "Wiadomości", match: (p) => p.startsWith("/account/messages") },
        ],
      },
      {
        href: "/account/settings",
        label: "Profil",
        icon: PersonIcon,
        // Own account: package, payments, settings all under here.
        match: (p) =>
          p.startsWith("/account/settings") ||
          p.startsWith("/account/package") ||
          p.startsWith("/account/payments"),
        subItems: [
          { href: "/account/package",  label: "Mój pakiet", match: (p) => p.startsWith("/account/package") },
          { href: "/account/payments", label: "Płatności",  match: (p) => p.startsWith("/account/payments") },
          { href: "/account/settings", label: "Ustawienia", match: (p) => p.startsWith("/account/settings") },
        ],
      },
    ],
  },
];

/**
 * Account sidebar — design 35 layout. 240px wide, fixed left, sections
 * grouped by activity domain. Profile pill at the bottom mirrors the
 * mock's avatar/name/email composition. Hidden on mobile (<lg) — bottom
 * tab bar from layout.tsx covers the same nav at thumb reach.
 */
export default function AccountSidebar({
  myId,
  unreadMessages,
  displayName,
  email,
  avatarUrl,
  avatarFocal,
  recentNotifs,
  unreadNotifs,
}: {
  myId: string;
  unreadMessages: number;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  avatarFocal: string | null;
  recentNotifs: Notification[];
  unreadNotifs: number;
}) {
  const pathname = usePathname();
  const initials = (displayName || "K")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      data-account-sidebar
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-slate-200 flex-col z-40"
    >
      {/* Brand + bell — bell replaces the "Klient" badge per design feedback.
          Single render across the app: sidebar is `hidden lg:flex` so on
          mobile this never mounts; the mobile header (in layout.tsx) handles
          notifications instead. Keeping bell in exactly one DOM tree avoids
          a duplicate Supabase realtime subscribe() on the same channel. */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            N
          </span>
          <span className="font-bold text-[16px] tracking-[-0.01em] truncate">NaZdrow!</span>
        </Link>
        <NotificationsBell
          myId={myId}
          initialNotifications={recentNotifs}
          initialUnreadCount={unreadNotifs}
          align="left"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[14px] py-2 scrollbar-hide">
        {SECTIONS.map((section, idx) => (
          <div key={section.group ?? `section-${idx}`}>
            {section.group && (
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-semibold pt-4 pb-1.5 px-3">
                {section.group}
              </div>
            )}
            {section.items.map((item) => {
              const active = item.match(pathname);
              const cls =
                "relative flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-[13.5px] font-medium transition " +
                (active
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : item.soon
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900");
              const inner = (
                <>
                  <span className="w-[17px] h-[17px] inline-flex items-center justify-center shrink-0 relative">
                    {item.icon}
                    {item.hasUnreadBadge && (
                      <MessagesBadge initialCount={unreadMessages} myId={myId} variant="floating" />
                    )}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.staticBadge && (
                    <span className="text-[10.5px] font-semibold text-slate-700 bg-slate-200 rounded-lg px-[7px] py-[1px] min-w-[18px] text-center">
                      {item.staticBadge}
                    </span>
                  )}
                </>
              );
              return (
                <div key={item.label}>
                  {item.soon ? (
                    <span className={cls}>{inner}</span>
                  ) : (
                    <Link href={item.href} className={cls}>
                      {inner}
                    </Link>
                  )}
                  {/* Sub-links — rendered when the parent is the active
                      section. Mirrors the trainer-sidebar treatment so the
                      4-section layout reads consistently on both sides. */}
                  {active && (item as SectionItem).subItems?.map((sub) => {
                    const subOn = sub.match(pathname);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={
                          "relative flex items-center pl-8 pr-3 py-[7px] text-[13px] transition " +
                          (subOn ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900")
                        }
                      >
                        <span
                          className={
                            "absolute left-[22px] top-0 bottom-0 " +
                            (subOn ? "w-0.5 bg-emerald-500" : "w-px bg-slate-200")
                          }
                        />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Profile pill */}
      <div className="m-4 mt-2 p-3 bg-slate-50 rounded-[11px] flex items-center gap-2.5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="w-[34px] h-[34px] rounded-full object-cover shrink-0"
            style={{ objectPosition: avatarFocal || "center" }}
          />
        ) : (
          <span className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 inline-flex items-center justify-center font-bold text-[13px] shrink-0">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-slate-900 truncate">{displayName}</div>
          {email && <div className="text-[10.5px] text-slate-500 truncate">{email}</div>}
        </div>
      </div>
    </aside>
  );
}
