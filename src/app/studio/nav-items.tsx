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
  /** Tested against the current `?...` AND pathname. Returns true when
   *  this sub-link is the active selection. The two inputs let sub-items
   *  point either to a query-mode of the same page (`?mode=foo`) or to a
   *  separate sub-route (`/studio/parent/child`). */
  match: (search: URLSearchParams, pathname: string) => boolean;
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
    // Inbox lives only as a Pulpit widget — no separate sidebar entry. So
    // /studio/bookings (the full Skrzynka działań page) is treated as a
    // sub-context of Pulpit and keeps it highlighted when visited.
    icon: HomeIcon,
    match: (p) => p === "/studio" || p.startsWith("/studio/bookings"),
  },
  {
    href: "/studio/calendar",
    label: "Kalendarz",
    description: "Sesje, rezerwacje, godziny pracy",
    group: "top",
    icon: CalIcon,
    match: (p) =>
      p.startsWith("/studio/calendar") ||
      p.startsWith("/studio/availability"),
    subItems: [
      {
        href: "/studio/calendar?mode=pattern",
        label: "Dostępność",
        match: (search) => search.get("mode") === "pattern",
      },
    ],
  },
  {
    href: "/studio/klienci",
    label: "Klienci",
    description: "Roster, czat, opinie",
    group: "top",
    icon: UsersIcon,
    // Klienci absorbs Wiadomości as a sub-link, so the section highlights
    // for either route (the chat is conceptually "talk to your clients").
    match: (p) => p.startsWith("/studio/klienci") || p.startsWith("/studio/messages"),
    subItems: [
      {
        href: "/studio/messages",
        label: "Wiadomości",
        match: (_search, pathname) => pathname.startsWith("/studio/messages"),
      },
    ],
  },

  // Profil — public data + reputation + promo. Usługi/pakiety removed
  // per user spec (still routable at /studio/uslugi but hidden from nav).
  // Design stron lifted to its own top-level section since it's a heavy,
  // distinct workflow (visual editor) that deserves first-class entry.
  {
    href: "/studio/profile",
    label: "Profil",
    description: "Dane publiczne, kupony, opinie",
    group: "top",
    icon: ProfileIcon,
    match: (p) =>
      p.startsWith("/studio/profile") ||
      p.startsWith("/studio/reviews") ||
      p.startsWith("/studio/kupony"),
    subItems: [
      {
        href: "/studio/kupony",
        label: "Kupony",
        match: (_search, pathname) => pathname.startsWith("/studio/kupony"),
      },
      {
        href: "/studio/reviews",
        label: "Opinie",
        match: (_search, pathname) => pathname.startsWith("/studio/reviews"),
      },
    ],
  },

  // Design stron — own top-level entry. Visual page editor is involved
  // enough (templates, sections, drag-around-preview) to deserve its own
  // section rather than burying under Profil.
  {
    href: "/studio/design",
    label: "Design stron",
    description: "Treść + szablon · live preview",
    group: "top",
    icon: PaletteIcon,
    match: (p) =>
      p.startsWith("/studio/design") ||
      p.startsWith("/studio/uslugi") ||
      p.startsWith("/studio/services") ||
      p.startsWith("/studio/packages"),
  },
];

// Top-only structure now — all former groups (Oferta/Komunikacja/Profil)
// fold into the four top-level sections via subItems. Keep the export
// for backward compat; sidebar renders nothing when empty.
export const NAV_SECTIONS: { group: Exclude<NavGroup, "top">; label: string }[] = [];
