"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import MessagesBadge from "@/app/account/MessagesBadge";
import AccountMenu from "@/components/AccountMenu";
import NotificationsBell from "@/components/NotificationsBell";
import type { Notification } from "@/lib/db/notifications";
import { NAV_SECTIONS, STUDIO_NAV, type StudioNavItem } from "./nav-items";

/**
 * Studio sidebar — design 31 layout. 240px wide, single-line links
 * grouped by sections (Oferta / Komunikacja / Profil). Brand area
 * at the top with role badge ("Trener") next to the name. Bottom
 * shows the AccountMenu pill (avatar + name + dropdown) — replaces
 * the old "Strona publiczna" footer link, with that link merged into
 * the dropdown so we don't lose access.
 */
export default function StudioSidebar({
  trainerId,
  trainerSlug,
  unreadMessages,
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
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  avatarFocal: string | null;
  recentNotifs: Notification[];
  unreadNotifs: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const topItems = STUDIO_NAV.filter((i) => i.group === "top");

  return (
    <aside
      data-studio-sidebar
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-slate-200 flex-col z-40"
    >
      {/* Brand + bell — bell replaces the "Trener" badge per design feedback.
          Single render: sidebar is `hidden lg:flex` but components inside
          still mount on mobile (CSS-only hiding). Putting a second bell in
          the topbar would double-subscribe to the same Supabase realtime
          channel, so it's removed from there. */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <Link href="/studio" className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            N
          </span>
          <span className="font-bold text-[16px] tracking-[-0.01em] truncate">NaZdrow!</span>
        </Link>
        <NotificationsBell
          myId={trainerId}
          initialNotifications={recentNotifs}
          initialUnreadCount={unreadNotifs}
          messagesLink="/studio/messages"
          align="left"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[14px] py-2 scrollbar-hide">
        {topItems.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            pathname={pathname}
            searchParams={searchParams}
            trainerId={trainerId}
            unreadMessages={unreadMessages}
          />
        ))}

        {NAV_SECTIONS.map(({ group, label }) => {
          const items = STUDIO_NAV.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-semibold pt-4 pb-1.5 px-3">
                {label}
              </div>
              {items.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  searchParams={searchParams}
                  trainerId={trainerId}
                  unreadMessages={unreadMessages}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer — account pill (avatar + name + dropdown). Public-profile
          link is now an item inside the dropdown (publicPageHref). */}
      <div className="border-t border-slate-100 p-2">
        <AccountMenu
          variant="pill"
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          avatarFocal={avatarFocal}
          publicPageHref={trainerSlug ? `/trainers/${trainerSlug}` : null}
        />
      </div>
    </aside>
  );
}

function NavRow({
  item,
  pathname,
  searchParams,
  trainerId,
  unreadMessages,
}: {
  item: StudioNavItem;
  pathname: string;
  searchParams: URLSearchParams;
  trainerId: string;
  unreadMessages: number;
}) {
  const active = item.match(pathname);
  // Sub-link "active" only matters when parent matches (otherwise we'd
  // visually mark the parent as having an active sub-link from
  // another page entirely).
  const subItems = active && item.subItems ? item.subItems : [];
  // Parent is "fully active" only when it matches AND no sub-link is
  // currently the selected one — same convention as Notion / Linear:
  // sub picks override the parent's bold state.
  const subActiveIndex = subItems.findIndex((s) => s.match(searchParams, pathname));
  const parentSelfActive = active && subActiveIndex === -1;

  const cls =
    "flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-[13.5px] font-medium transition " +
    (parentSelfActive
      ? "bg-emerald-50 text-emerald-700 font-semibold"
      : item.soon
        ? "text-slate-300 cursor-not-allowed"
        : active
          ? "text-slate-900"
          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900");

  const inner = (
    <>
      <span className="w-[17px] h-[17px] inline-flex items-center justify-center shrink-0 relative">
        {item.icon}
        {item.hasUnreadBadge && (
          <MessagesBadge initialCount={unreadMessages} myId={trainerId} variant="floating" />
        )}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
    </>
  );

  return (
    <>
      {item.soon ? (
        <span className={cls}>{inner}</span>
      ) : (
        <Link href={item.href} className={cls}>
          {inner}
        </Link>
      )}
      {subItems.map((sub) => {
        const subOn = sub.match(searchParams, pathname);
        return (
          <Link
            key={sub.href}
            href={sub.href}
            className={
              "relative flex items-center pl-8 pr-3 py-[7px] text-[13px] transition " +
              (subOn
                ? "text-slate-900 font-semibold"
                : "text-slate-500 hover:text-slate-900")
            }
          >
            {/* Vertical guide line + active marker */}
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
    </>
  );
}
