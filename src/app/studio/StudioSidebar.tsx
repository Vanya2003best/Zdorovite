"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MessagesBadge from "@/app/account/MessagesBadge";
import { STUDIO_NAV } from "./nav-items";

const ExternalIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

/**
 * Permanent left sidebar for /studio/* on lg+. Same content + visual style
 * as the StudioNavMenu drawer (which lives on mobile only).
 */
export default function StudioSidebar({
  trainerId,
  trainerSlug,
  trainerName,
  avatarUrl,
  unreadMessages,
}: {
  trainerId: string;
  trainerSlug: string | null;
  trainerName: string;
  avatarUrl: string | null;
  unreadMessages: number;
}) {
  const pathname = usePathname();
  const initial = (trainerName || "?").charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[280px] bg-white border-r border-slate-200 flex-col z-40">
      {/* Top: brand + identity */}
      <div className="px-4 py-4 border-b border-slate-100 flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold">
            {initial}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate">{trainerName}</div>
          <div className="text-[11px] text-emerald-700 font-semibold uppercase tracking-[0.06em]">
            NaZdrow! Studio
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {STUDIO_NAV.map((item) => {
          const active = item.match(pathname);
          const cls = `flex items-start gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-[10px] transition ${
            active
              ? "bg-emerald-50 text-emerald-900"
              : item.soon
                ? "text-slate-400 cursor-not-allowed"
                : "text-slate-700 hover:bg-slate-50"
          }`;
          const inner = (
            <>
              <span className={`w-7 h-7 rounded-[8px] inline-flex items-center justify-center shrink-0 relative ${
                active ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                {item.icon}
                {item.hasUnreadBadge && (
                  <MessagesBadge initialCount={unreadMessages} myId={trainerId} variant="floating" />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-semibold leading-tight">{item.label}</span>
                <span className="block text-[11.5px] text-slate-500 leading-tight mt-0.5">{item.description}</span>
              </span>
              {active && (
                <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider self-center">
                  tutaj
                </span>
              )}
            </>
          );
          if (item.soon) {
            return <span key={item.label} className={cls}>{inner}</span>;
          }
          return (
            <Link key={item.label} href={item.href} className={cls}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 py-2">
        {trainerSlug && (
          <Link
            href={`/trainers/${trainerSlug}`}
            target="_blank"
            className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-[10px] text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="w-7 h-7 rounded-[8px] bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
              {ExternalIcon}
            </span>
            <span className="flex-1 text-[13px] font-medium">Strona publiczna</span>
            {ExternalIcon}
          </Link>
        )}
        <form action="/auth/sign-out" method="post" className="block">
          <button
            type="submit"
            className="w-full flex items-center gap-3 mx-2 px-3 py-2.5 rounded-[10px] text-slate-700 hover:bg-slate-50 transition text-left"
            style={{ width: "calc(100% - 16px)" }}
          >
            <span className="w-7 h-7 rounded-[8px] bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </span>
            <span className="flex-1 text-[13px] font-medium">Wyloguj</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
