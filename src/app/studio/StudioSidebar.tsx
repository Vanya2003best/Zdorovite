"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/studio",              label: "Główna",          icon: "🏠" },
  { href: "/studio/design",       label: "Edytor profilu",  icon: "🎨" },
  { href: "/studio/profile",      label: "Treść profilu",   icon: "👤" },
  { href: "/studio/bookings",     label: "Rezerwacje",      icon: "📅" },
  { href: "/studio/messages",     label: "Wiadomości",      icon: "💬" },
  { href: "/studio/reviews",      label: "Opinie",          icon: "⭐", soon: true },
  { href: "/studio/services",     label: "Usługi",          icon: "⚡" },
  { href: "/studio/packages",     label: "Pakiety",         icon: "📦" },
  { href: "/studio/availability", label: "Dostępność",      icon: "🕒" },
];

export default function StudioSidebar({
  displayName,
  avatarUrl,
  slug,
  published,
}: {
  displayName: string;
  avatarUrl: string | null;
  slug: string | null;
  published: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden sm:flex fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-slate-200 flex-col z-40">
      {/* Brand */}
      <Link href="/studio" className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
          N
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">NaZdrow!</div>
          <div className="text-[11px] text-emerald-700 font-medium uppercase tracking-[0.06em]">Studio</div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="grid gap-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.soon ? "#" : item.href}
                  aria-disabled={item.soon}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition ${
                    active
                      ? "bg-emerald-500 text-white"
                      : item.soon
                        ? "text-slate-400 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.soon && (
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">soon</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Public profile link */}
        {slug && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <Link
              href={`/trainers/${slug}`}
              target="_blank"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              <span className="text-base w-5 text-center">🌐</span>
              <span className="flex-1">Strona publiczna</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </Link>
            {!published && (
              <p className="text-[11px] text-amber-700 px-3 mt-1.5">
                ⚠ Twój profil jest w trybie szkicu — niewidoczny dla klientów.
              </p>
            )}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-slate-900 truncate">{displayName}</div>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="text-[11px] text-slate-500 hover:text-slate-900 transition">
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
