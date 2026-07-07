"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_LITE } from "@/lib/feature-flags";

/**
 * Client bottom navigation — mobile only (<1024px), per MVP spec:
 * Pulpit · Sesje · Trenerzy · Czat · Postępy. Fixed to the viewport
 * bottom with safe-area padding; hidden on lg+ where AccountTopBar
 * (dark-teal strip + page tabs) is the nav pattern.
 *
 * The top page-tabs stay visible on mobile too — they are the only
 * entry to Plan / Mój trener / Pakiet, which the 5-tab bottom bar
 * intentionally does not carry.
 *
 * ACCOUNT_LITE (витрина strategy) squeezes the bar to 4 tabs:
 * Rezerwacje · Trenerzy · Czat · Ustawienia — Pulpit/Postępy pages
 * redirect to /account/bookings while the flag is on.
 */

const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
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
  badge?: number;
};

export default function AccountBottomNav({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname() ?? "";

  const tabs: Tab[] = ACCOUNT_LITE
    ? [
        { href: "/account/bookings", label: "Rezerwacje", icon: Icon.cal, match: (p) => p.startsWith("/account/bookings") },
        { href: "/", label: "Trenerzy", icon: Icon.search, match: () => false },
        {
          href: "/account/messages",
          label: "Czat",
          icon: Icon.chat,
          match: (p) => p.startsWith("/account/messages"),
          badge: unreadMessages,
        },
        { href: "/account/settings", label: "Ustawienia", icon: Icon.settings, match: (p) => p.startsWith("/account/settings") },
      ]
    : [
        { href: "/account", label: "Pulpit", icon: Icon.home, match: (p) => p === "/account" },
        { href: "/account/bookings", label: "Sesje", icon: Icon.cal, match: (p) => p.startsWith("/account/bookings") },
        { href: "/", label: "Trenerzy", icon: Icon.search, match: () => false },
        {
          href: "/account/messages",
          label: "Czat",
          icon: Icon.chat,
          match: (p) => p.startsWith("/account/messages"),
          badge: unreadMessages,
        },
        { href: "/account/progress", label: "Postępy", icon: Icon.chart, match: (p) => p.startsWith("/account/progress") },
      ];

  return (
    <nav
      aria-label="Nawigacja konta"
      className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className={ACCOUNT_LITE ? "grid grid-cols-4" : "grid grid-cols-5"}>
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold transition " +
                (active ? "text-emerald-600" : "text-slate-500 hover:text-slate-700")
              }
            >
              <span className="relative">
                {t.icon}
                {(t.badge ?? 0) > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                    {t.badge! > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
