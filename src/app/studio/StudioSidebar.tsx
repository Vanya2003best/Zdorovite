"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MessagesBadge from "@/app/account/MessagesBadge";
import { NAV_SECTIONS, STUDIO_NAV, type StudioNavItem } from "./nav-items";

const ExternalIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

/**
 * Studio sidebar — design 31 layout. 240px wide, single-line links
 * grouped by sections (Oferta / Komunikacja / Profil). Brand area
 * at the top with role badge ("Trener") next to the name. Bottom
 * keeps the public-profile shortcut from before.
 */
export default function StudioSidebar({
  trainerId,
  trainerSlug,
  unreadMessages,
}: {
  trainerId: string;
  trainerSlug: string | null;
  unreadMessages: number;
}) {
  const pathname = usePathname();

  const topItems = STUDIO_NAV.filter((i) => i.group === "top");

  return (
    <aside
      data-studio-sidebar
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-slate-200 flex-col z-40"
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/studio" className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            N
          </span>
          <span className="font-bold text-[16px] tracking-[-0.01em]">NaZdrow!</span>
          <span className="ml-auto text-[11px] font-medium text-slate-500 px-[7px] py-[3px] bg-slate-50 rounded-md">
            Trener
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-[14px] py-2 scrollbar-hide">
        {topItems.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            pathname={pathname}
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
                  trainerId={trainerId}
                  unreadMessages={unreadMessages}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer — public-profile shortcut */}
      {trainerSlug && (
        <div className="border-t border-slate-100 p-[14px] pt-3">
          <Link
            href={`/trainers/${trainerSlug}`}
            target="_blank"
            className="flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="w-[17px] h-[17px] inline-flex items-center justify-center shrink-0 text-slate-500">
              {ExternalIcon}
            </span>
            <span className="flex-1 text-[13.5px] font-medium">Strona publiczna</span>
            <span className="text-slate-400">{ExternalIcon}</span>
          </Link>
        </div>
      )}
    </aside>
  );
}

function NavRow({
  item,
  pathname,
  trainerId,
  unreadMessages,
}: {
  item: StudioNavItem;
  pathname: string;
  trainerId: string;
  unreadMessages: number;
}) {
  const active = item.match(pathname);
  const cls =
    "flex items-center gap-[11px] px-3 py-[9px] rounded-[9px] text-[13.5px] font-medium transition " +
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
          <MessagesBadge initialCount={unreadMessages} myId={trainerId} variant="floating" />
        )}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
    </>
  );

  if (item.soon) return <span className={cls}>{inner}</span>;
  return (
    <Link href={item.href} className={cls}>
      {inner}
    </Link>
  );
}
