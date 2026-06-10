"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import NotificationsBell from "@/components/NotificationsBell";
import MessagesBadge from "./MessagesBadge";
import type { Notification } from "@/lib/db/notifications";

/**
 * OLX-style client chrome — mirror of StudioTopBar but for the client
 * (/account) surface. Dark-teal sticky top strip + horizontal page-tabs.
 *
 * Auto-hide on scroll-down + reveal on scroll-up, same as the studio
 * chrome so the two surfaces feel like one app. Tabs row sticks below
 * the topbar when visible and rises to top-0 when topbar is hidden.
 */

const TopnavIcon = {
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

const PageNavIcon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
    </svg>
  ),
  trainer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
  badgeKey?: "messages";
};

const TABS: Tab[] = [
  { href: "/account",          label: "Pulpit",      icon: PageNavIcon.home,     match: (p) => p === "/account" },
  { href: "/account/bookings", label: "Treningi",    icon: PageNavIcon.cal,      match: (p) => p.startsWith("/account/bookings") },
  { href: "/account/plan",     label: "Plan",        icon: PageNavIcon.plan,     match: (p) => p.startsWith("/account/plan") },
  { href: "/account/progress", label: "Postęp",      icon: PageNavIcon.chart,    match: (p) => p.startsWith("/account/progress") },
  { href: "/account/trainer",  label: "Mój trener",  icon: PageNavIcon.trainer,  match: (p) => p.startsWith("/account/trainer") },
  { href: "/account/messages", label: "Wiadomości",  icon: PageNavIcon.chat,     match: (p) => p.startsWith("/account/messages"), badgeKey: "messages" },
  { href: "/account/package",  label: "Pakiet",      icon: PageNavIcon.package,  match: (p) => p.startsWith("/account/package") },
  { href: "/account/payments", label: "Płatności",   icon: PageNavIcon.card,     match: (p) => p.startsWith("/account/payments") },
  { href: "/account/settings", label: "Ustawienia",  icon: PageNavIcon.settings, match: (p) => p.startsWith("/account/settings") },
];

export default function AccountTopBar({
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
  const pathname = usePathname() ?? "";

  // Auto-hide topbar on scroll-down — same behaviour as StudioTopBar so
  // both surfaces feel coupled. 6px jitter threshold + y>80 guard.
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastYRef.current;
      if (Math.abs(dy) < 6) return;
      if (dy > 0 && y > 80) setHidden(true);
      else if (dy < 0) setHidden(false);
      lastYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Dark-teal top strip — full-width bg, content centered at 1280px */}
      <header
        className={
          "sticky top-0 z-50 text-white transition-transform duration-300 ease-out will-change-transform " +
          (hidden ? "-translate-y-full" : "translate-y-0")
        }
        style={{ background: "#002f34" }}
      >
        <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-8 flex items-center gap-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-[19px] tracking-[-0.02em] shrink-0"
          >
            <span className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-extrabold text-[15px]">
              N
            </span>
            <span>
              Na<span className="text-emerald-400 font-extrabold">Zdrow</span>!
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition"
            >
              {TopnavIcon.card}
              Znajdź trenera
            </Link>
            <Link
              href="/account/messages"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition relative"
            >
              {TopnavIcon.chat}
              Czat
              {unreadMessages > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-md h-4 leading-4">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
            <Link
              href="/?fav=1"
              aria-label="Obserwowane"
              className="flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:bg-white/10 hover:text-white transition"
            >
              {TopnavIcon.heart}
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-0.5">
            <div className="text-white">
              <NotificationsBell
                myId={myId}
                initialNotifications={recentNotifs}
                initialUnreadCount={unreadNotifs}
                messagesLink="/account/messages"
                align="right"
              />
            </div>
            <AccountMenu
              variant="chip"
              displayName={displayName}
              email={email}
              avatarUrl={avatarUrl}
              avatarFocal={avatarFocal}
            />
          </div>

          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-[9px] bg-white text-[#002f34] font-bold text-[13px] hover:bg-emerald-50 transition"
          >
            {TopnavIcon.search}
            Znajdź trenera
          </Link>
        </div>
      </header>

      {/* Horizontal page-tabs — same coupling as the studio chrome */}
      <div
        className="sticky z-40 bg-white border-b border-slate-200 transition-[top] duration-300 ease-out"
        style={{ top: hidden ? 0 : 64 }}
      >
        <nav className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "flex items-center gap-2 px-4 py-3.5 text-[13.5px] font-semibold whitespace-nowrap border-b-[3px] -mb-px transition " +
                  (active
                    ? "text-slate-900 border-slate-900"
                    : "text-slate-600 border-transparent hover:text-slate-900")
                }
              >
                {t.icon}
                {t.label}
                {t.badgeKey === "messages" && unreadMessages > 0 && (
                  <span className="bg-emerald-500 text-white text-[10.5px] font-bold px-1.5 py-px rounded-md">
                    {unreadMessages}
                  </span>
                )}
                {t.badgeKey === "messages" && unreadMessages === 0 && (
                  <MessagesBadge initialCount={0} myId={myId} variant="floating" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
