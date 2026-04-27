"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  match: (p: string) => boolean;
  external?: boolean;
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
const ExternalIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

export default function StudioNavMenu({
  trainerSlug,
  trainerName,
  avatarUrl,
}: {
  trainerSlug: string | null;
  trainerName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const items: Item[] = [
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
      match: (p) => p.startsWith("/studio/design") || p.startsWith("/studio/profile"),
    },
    {
      href: "/studio/bookings",
      label: "Rezerwacje",
      description: "Potwierdzenia, anulacje, przeniesienia",
      icon: CalIcon,
      match: (p) => p.startsWith("/studio/bookings"),
    },
    {
      href: "/studio/messages",
      label: "Wiadomości",
      description: "Czat z klientami",
      icon: ChatIcon,
      match: (p) => p.startsWith("/studio/messages"),
    },
    {
      href: "/studio/services",
      label: "Usługi",
      description: "Pojedyncze sesje",
      icon: BoltIcon,
      match: (p) => p.startsWith("/studio/services"),
    },
    {
      href: "/studio/packages",
      label: "Pakiety",
      description: "Programy długoterminowe",
      icon: PackageIcon,
      match: (p) => p.startsWith("/studio/packages"),
    },
    {
      href: "/studio/availability",
      label: "Dostępność",
      description: "Godziny pracy",
      icon: ClockIcon,
      match: (p) => p.startsWith("/studio/availability"),
    },
    {
      href: "#",
      label: "Opinie",
      description: "Wkrótce",
      icon: StarIcon,
      match: () => false,
      soon: true,
    },
  ];

  // Click-outside dismiss.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const initial = (trainerName || "?").charAt(0).toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu Studio"
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-10 pl-2 pr-3 rounded-[10px] border border-slate-200 bg-white hover:border-slate-400 transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <span className="text-[13px] font-semibold tracking-[-0.01em] hidden sm:inline">Menu</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-[320px] max-w-[calc(100vw-24px)] bg-white border border-slate-200 rounded-[14px] shadow-[0_20px_40px_-12px_rgba(2,6,23,0.16)] z-[60] overflow-hidden">
          {/* Top: who am I */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
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
          <div className="py-1.5">
            {items.map((item) => {
              const active = item.match(pathname);
              const cls = `flex items-start gap-3 px-4 py-2.5 transition ${
                active
                  ? "bg-emerald-50 text-emerald-900"
                  : item.soon
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-slate-700 hover:bg-slate-50"
              }`;
              const inner = (
                <>
                  <span className={`w-7 h-7 rounded-[8px] inline-flex items-center justify-center shrink-0 ${active ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {item.icon}
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
                return (
                  <span key={item.label} className={cls}>{inner}</span>
                );
              }
              return (
                <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 py-1.5">
            {trainerSlug && (
              <Link
                href={`/trainers/${trainerSlug}`}
                target="_blank"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition"
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
                className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition text-left"
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
        </div>
      )}
    </div>
  );
}
