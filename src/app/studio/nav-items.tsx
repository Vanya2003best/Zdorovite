import type { ReactNode } from "react";

/**
 * Studio sidebar nav — restructured into design-31 sections (top
 * group / Oferta / Komunikacja / Profil) so the nav reads as a
 * compact grouped list instead of a flat scroll. Section headers
 * are the small uppercase labels rendered between groups.
 */
export type NavGroup = "top" | "oferta" | "komunikacja" | "profil";

export type StudioNavSubItem = {
  href: string;
  label: string;
  /** Tested against the current `?...` (URLSearchParams). Returns
   *  true when this sub-link is the active selection. */
  match: (search: URLSearchParams) => boolean;
};

export type StudioNavItem = {
  href: string;
  label: string;
  group: NavGroup;
  icon: ReactNode;
  match: (pathname: string) => boolean;
  /** Mark for the unread-message live badge. */
  hasUnreadBadge?: boolean;
  /** Disabled "wkrótce" state. */
  soon?: boolean;
  /** Optional second-line description used by the mobile drawer
   *  (StudioNavMenu) and the page-title fallback. The desktop
   *  sidebar (design 31) ignores this and renders single-line. */
  description?: string;
  /** Sub-links rendered under this item (when active). Used for
   *  Calendar's mode deeplinks: Wzorzec / Wolne sloty. */
  subItems?: StudioNavSubItem[];
};

const HomeIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);
const PaletteIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
  </svg>
);
const CalIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const ChatIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const StarIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const BoltIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 7L12 3 4 7v10l8 4 8-4V7z" />
  </svg>
);
const PackageIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);
const UsersIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const ProfileIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a8 8 0 0116 0v1" />
  </svg>
);

export const STUDIO_NAV: StudioNavItem[] = [
  // Top group — daily-driver entries the trainer hits most often.
  {
    href: "/studio",
    label: "Pulpit",
    description: "Statystyki, najbliższe sesje",
    group: "top",
    icon: HomeIcon,
    match: (p) => p === "/studio",
  },
  {
    href: "/studio/calendar",
    label: "Kalendarz",
    description: "Sesje, rezerwacje, godziny pracy",
    group: "top",
    icon: CalIcon,
    match: (p) =>
      p.startsWith("/studio/calendar") ||
      p.startsWith("/studio/bookings") ||
      p.startsWith("/studio/availability"),
    subItems: [
      {
        href: "/studio/calendar?mode=pattern",
        label: "Wzorzec tygodniowy",
        match: (search) => search.get("mode") === "pattern",
      },
      {
        href: "/studio/calendar?mode=availability",
        label: "Wolne sloty (podgląd)",
        match: (search) => search.get("mode") === "availability",
      },
    ],
  },
  {
    href: "/studio/klienci",
    label: "Klienci",
    description: "Roster, notatki, cele",
    group: "top",
    icon: UsersIcon,
    match: (p) => p.startsWith("/studio/klienci"),
  },

  // Oferta — services + packages. Both are deep-links into
  // /studio/design (single source of truth — inline editing in the
  // live preview). The hash triggers scroll-to-section in
  // EditorClient; no separate page state to manage.
  {
    href: "/studio/design#services",
    label: "Usługi",
    description: "Cennik pojedynczych sesji",
    group: "oferta",
    icon: BoltIcon,
    match: () => false,
  },
  {
    href: "/studio/design#packages",
    label: "Pakiety",
    description: "Wielorazowe pakiety sesji",
    group: "oferta",
    icon: PackageIcon,
    match: () => false,
  },

  // Komunikacja — messages + reviews.
  {
    href: "/studio/messages",
    label: "Wiadomości",
    description: "Czat z klientami",
    group: "komunikacja",
    icon: ChatIcon,
    match: (p) => p.startsWith("/studio/messages"),
    hasUnreadBadge: true,
  },
  {
    href: "/studio/reviews",
    label: "Opinie",
    description: "Co mówią klienci",
    group: "komunikacja",
    icon: StarIcon,
    match: (p) => p.startsWith("/studio/reviews"),
  },

  // Profil — public-data editor + visual designer.
  {
    href: "/studio/profile",
    label: "Profil",
    description: "Dane, certyfikaty, ustawienia",
    group: "profil",
    icon: ProfileIcon,
    match: (p) => p.startsWith("/studio/profile"),
  },
  {
    href: "/studio/design",
    label: "Design profilu",
    description: "Treść + szablon · live preview",
    group: "profil",
    icon: PaletteIcon,
    match: (p) => p.startsWith("/studio/design"),
  },
];

export const NAV_SECTIONS: { group: Exclude<NavGroup, "top">; label: string }[] = [
  { group: "oferta", label: "Oferta" },
  { group: "komunikacja", label: "Komunikacja" },
  { group: "profil", label: "Profil" },
];
