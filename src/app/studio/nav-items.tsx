import type { ReactNode } from "react";

export type StudioNavItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  match: (pathname: string) => boolean;
  /** Mark for the unread-message live badge. */
  hasUnreadBadge?: boolean;
  /** Disabled "wkrótce" state. */
  soon?: boolean;
};

const HomeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);
const PaletteIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="13.5" cy="6.5" r="0.5" />
    <circle cx="17.5" cy="10.5" r="0.5" />
    <circle cx="8.5" cy="7.5" r="0.5" />
    <circle cx="6.5" cy="12.5" r="0.5" />
    <path d="M12 22a10 10 0 110-20 8 8 0 016.79 12.07c-.84 1.43-2.1 2.13-3.79 1.93-1.5-.18-2.5.5-2.5 2 0 1.5-.65 2-2 2-3 0-3-.66-3-3 0-1.5.5-2 2-2 1.5 0 2-1 2-2.5z" />
  </svg>
);
const CalIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const ChatIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const StarIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const BoltIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);
const PackageIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 00-1-1.73L13 2.27a2 2 0 00-2 0L4 6.27A2 2 0 003 8v8a2 2 0 001 1.73l7 4.05a2 2 0 002 0l7-4.05A2 2 0 0021 16z" />
    <path d="M3.27 7L12 12l8.73-5M12 22V12" />
  </svg>
);
const ClockIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export const STUDIO_NAV: StudioNavItem[] = [
  {
    href: "/studio",
    label: "Pulpit",
    description: "Statystyki, najbliższe sesje",
    icon: HomeIcon,
    match: (p) => p === "/studio",
  },
  {
    href: "/studio/design",
    label: "Mój profil",
    description: "Treść + szablon · live preview",
    icon: PaletteIcon,
    // /studio/profile reached via AccountMenu dropdown ("Moje konto") — has its
    // own top-bar override; intentionally not a sidebar entry to keep the
    // sidebar focused on profile editing flows.
    match: (p) => p.startsWith("/studio/design"),
  },
  {
    href: "/studio/calendar",
    label: "Kalendarz",
    description: "Sesje, rezerwacje, godziny pracy",
    icon: CalIcon,
    match: (p) => p.startsWith("/studio/calendar") || p.startsWith("/studio/bookings"),
  },
  {
    href: "/studio/messages",
    label: "Wiadomości",
    description: "Czat z klientami",
    icon: ChatIcon,
    match: (p) => p.startsWith("/studio/messages"),
    hasUnreadBadge: true,
  },
  {
    href: "/studio/reviews",
    label: "Opinie",
    description: "Co mówią klienci",
    icon: StarIcon,
    match: (p) => p.startsWith("/studio/reviews"),
  },
];
