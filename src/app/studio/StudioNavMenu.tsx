"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STUDIO_NAV } from "./nav-items";

const ExternalIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

/**
 * Mobile-only drawer triggered by the hamburger Menu button.
 * Desktop has the persistent <StudioSidebar/>; this component is hidden there
 * (callers wrap in `lg:hidden`).
 */
export default function StudioNavMenu({
  trainerSlug,
  trainerName,
  avatarUrl,
  avatarFocal,
}: {
  trainerSlug: string | null;
  trainerName: string;
  avatarUrl: string | null;
  avatarFocal?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + ESC dismiss.
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
              <img
                src={avatarUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
                style={{ objectPosition: avatarFocal || "center" }}
              />
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
            {STUDIO_NAV.map((item) => {
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
                return <span key={item.label} className={cls}>{inner}</span>;
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
