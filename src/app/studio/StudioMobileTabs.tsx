"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MessagesBadge from "@/app/account/MessagesBadge";

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
const PaintIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l3.5 3.5L22 12l-7 7-7-7L12 2z" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
const ChatIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const BoltIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

const TABS = [
  { href: "/studio",          label: "Pulpit",     match: (p: string) => p === "/studio",           icon: HomeIcon, hasUnread: false },
  { href: "/studio/bookings", label: "Rezerwacje", match: (p: string) => p.startsWith("/studio/bookings"), icon: CalIcon,  hasUnread: false },
  { href: "/studio/design",   label: "Edytor",     match: (p: string) => p.startsWith("/studio/design") || p.startsWith("/studio/profile"), icon: PaintIcon, hasUnread: false },
  { href: "/studio/messages", label: "Czat",       match: (p: string) => p.startsWith("/studio/messages"), icon: ChatIcon, hasUnread: true },
  { href: "/studio/services", label: "Oferta",     match: (p: string) => p.startsWith("/studio/services") || p.startsWith("/studio/packages") || p.startsWith("/studio/availability"), icon: BoltIcon, hasUnread: false },
];

export default function StudioMobileTabs({
  myId,
  unreadMessages,
}: {
  myId: string | null;
  unreadMessages: number;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Nawigacja Studio"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 h-[84px] grid grid-cols-5 pt-1.5 pb-[18px] bg-white/[0.94] backdrop-blur-xl border-t border-slate-200"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
              active ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            <span className="relative">
              {t.icon}
              {t.hasUnread && myId && (
                <MessagesBadge initialCount={unreadMessages} myId={myId} variant="floating" />
              )}
            </span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
