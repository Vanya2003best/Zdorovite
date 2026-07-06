"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import NotificationsBell from "@/components/NotificationsBell";
import MessagesBadge from "@/app/account/MessagesBadge";
import type { Notification } from "@/lib/db/notifications";

/**
 * OLX-style studio chrome — dark-green top strip + horizontal page-tabs.
 *
 * Replaces the legacy left sidebar (StudioSidebar.tsx, removed as dead
 * code). The visual reference is `35-studio-
 * klienci-olx-style.html` from the design bundle.
 *
 * Two parts in one component because both depend on usePathname for the
 * "is this tab active?" state — splitting them would double the client
 * hydration cost.
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
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  ),
  palette: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    </svg>
  ),
};

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
  badgeKey?: "messages" | "klienciCount" | "bookings";
  accent?: boolean;
};

const TABS: Tab[] = [
  { href: "/studio",          label: "Pulpit",      icon: PageNavIcon.home,    match: (p) => p === "/studio" || p.startsWith("/studio/bookings") },
  { href: "/studio/calendar", label: "Kalendarz",   icon: PageNavIcon.cal,     match: (p) => p.startsWith("/studio/calendar") },
  { href: "/studio/klienci",  label: "Klienci",     icon: PageNavIcon.users,   match: (p) => p.startsWith("/studio/klienci"), badgeKey: "klienciCount" },
  { href: "/studio/messages", label: "Wiadomości",  icon: PageNavIcon.chat,    match: (p) => p.startsWith("/studio/messages"), badgeKey: "messages" },
  { href: "/studio/uslugi",   label: "Usługi",      icon: PageNavIcon.bolt,    match: (p) => p.startsWith("/studio/uslugi") || p.startsWith("/studio/services") || p.startsWith("/studio/packages") },
  { href: "/studio/reviews",  label: "Oceny",       icon: PageNavIcon.star,    match: (p) => p.startsWith("/studio/reviews") },
  { href: "/studio/finanse",  label: "Płatności",   icon: PageNavIcon.card,    match: (p) => p.startsWith("/studio/finanse") || p.startsWith("/studio/payments") },
  { href: "/studio/profile",  label: "Profil",      icon: PageNavIcon.user,    match: (p) => p.startsWith("/studio/profile") },
  { href: "/studio/design",   label: "Design stron",icon: PageNavIcon.palette, match: (p) => p.startsWith("/studio/design") },
];

export default function StudioTopBar({
  trainerId,
  trainerSlug,
  unreadMessages,
  klienciCount,
  displayName,
  email,
  avatarUrl,
  avatarFocal,
  recentNotifs,
  unreadNotifs,
}: {
  trainerId: string;
  trainerSlug: string | null;
  unreadMessages: number;
  /** Count badge for the Klienci tab. Calculated server-side in layout. */
  klienciCount: number;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  avatarFocal: string | null;
  recentNotifs: Notification[];
  unreadNotifs: number;
}) {
  const pathname = usePathname() ?? "";

  // Auto-hide topbar on scroll-down, reveal on scroll-up — OLX-style.
  // Threshold: ignore tiny jitters (<6px), and never hide while still near
  // the top (y < 80) so the user doesn't lose the topbar after a single
  // small wheel-tick on a fresh page load.
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
      {/* === Dark-green OLX top strip === */}
      {/* Background stretches full-width; inner wrapper is capped at 1280px
          and centered so the logo / nav / CTAs align with the page body
          below (which also uses max-w-[1280px] mx-auto). */}
      <header
        className={
          "sticky top-0 z-50 text-white transition-transform duration-300 ease-out will-change-transform " +
          (hidden ? "-translate-y-full" : "translate-y-0")
        }
        style={{ background: "#002f34" }}
      >
        <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-8 flex items-center gap-5">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-[19px] tracking-[-0.02em] shrink-0">
          <span className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-extrabold text-[15px]">
            N
          </span>
          <span>
            Na<span className="text-emerald-400 font-extrabold">Zdrow</span>!
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-3">
          {trainerSlug && (
            <Link
              href={`/trainers/${trainerSlug}`}
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition"
            >
              {TopnavIcon.card}
              Twoja wizytówka
            </Link>
          )}
          <Link
            href="/studio/messages"
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
          {/* OLX-style "Obserwowane" — currently routes to favourites
              section under reviews/leads. Visual-only parity with OLX
              chrome; wiring to a real saved-clients view is a follow-up. */}
          <Link
            href="/studio/reviews"
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
              myId={trainerId}
              initialNotifications={recentNotifs}
              initialUnreadCount={unreadNotifs}
              messagesLink="/studio/messages"
              align="right"
            />
          </div>
          <AccountMenu
            variant="chip"
            displayName={displayName}
            email={email}
            avatarUrl={avatarUrl}
            avatarFocal={avatarFocal}
            publicPageHref={trainerSlug ? `/trainers/${trainerSlug}` : null}
          />
        </div>

        </div>
      </header>

      {/* === Horizontal page-tabs — sticks below the topbar when it's
            visible (top-16) and rises to top-0 when the topbar hides on
            scroll-down. The same transition timing as the header keeps
            the two movements visually coupled. === */}
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
                {t.badgeKey === "klienciCount" && klienciCount > 0 && (
                  <span className="bg-emerald-500 text-white text-[10.5px] font-bold px-1.5 py-px rounded-md">
                    {klienciCount}
                  </span>
                )}
                {/* Static mini-badge that prevents the tab from being too lonely when there's no number */}
                {t.badgeKey === "messages" && unreadMessages === 0 && (
                  <MessagesBadge initialCount={0} myId={trainerId} variant="floating" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
