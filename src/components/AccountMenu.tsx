"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SettingsIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
const AccountIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const SparkIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2z" />
  </svg>
);
const HelpIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);
const LogoutIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

type Item =
  | { kind: "link"; href: string; label: string; icon: React.ReactNode; soon?: boolean; description?: string }
  | { kind: "divider" };

const ITEMS: Item[] = [
  {
    kind: "link",
    href: "/studio/profile",
    label: "Moje konto",
    description: "Dane, certyfikaty, usługi",
    icon: AccountIcon,
  },
  {
    kind: "link",
    href: "/studio/design",
    label: "Mój profil",
    description: "Treść + szablon",
    icon: SettingsIcon,
  },
  {
    kind: "link",
    href: "#",
    label: "Subskrypcja PRO",
    description: "Zaawansowane szablony",
    icon: SparkIcon,
    soon: true,
  },
  {
    kind: "link",
    href: "#",
    label: "Pomoc",
    description: "FAQ i kontakt",
    icon: HelpIcon,
    soon: true,
  },
  { kind: "divider" },
];

/**
 * Avatar dropdown for the studio top bar — shows display_name + email
 * at the top, then quick links (settings / subscription / help) and
 * the Wyloguj action. Replaces the old "user footer" block at the
 * bottom of the sidebar.
 */
export default function AccountMenu({
  displayName,
  email,
  avatarUrl,
  avatarFocal,
}: {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  /** CSS object-position for the avatar (e.g. "30% 45%"). Falls back to
   *  "center" when null/undefined. Comes from profiles.avatar_focal —
   *  set via drag-pan on /studio/profile. */
  avatarFocal?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Konto: ${displayName}`}
        aria-expanded={open}
        className="block w-9 h-9 rounded-full overflow-hidden border border-slate-200 hover:border-slate-400 transition"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: avatarFocal || "center" }}
          />
        ) : (
          <span className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-sm">
            {initial}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[300px] max-w-[calc(100vw-24px)] bg-white border border-slate-200 rounded-[14px] shadow-[0_20px_40px_-12px_rgba(2,6,23,0.16)] z-[60] overflow-hidden">
          {/* Identity */}
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
              <div className="text-[14px] font-semibold truncate">{displayName}</div>
              {email && <div className="text-[11.5px] text-slate-500 truncate">{email}</div>}
            </div>
          </div>

          {/* Items */}
          <div className="py-1.5">
            {ITEMS.map((item, i) => {
              if (item.kind === "divider") {
                return <div key={`div-${i}`} className="border-t border-slate-100 my-1" />;
              }
              const cls = `flex items-start gap-3 px-4 py-2.5 transition ${
                item.soon ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50"
              }`;
              const inner = (
                <>
                  <span className="w-7 h-7 rounded-[8px] bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                    {item.description && (
                      <span className="block text-[11.5px] text-slate-500 leading-tight mt-0.5">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.soon && (
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold self-center">
                      wkrótce
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

            <form action="/auth/sign-out" method="post" className="block">
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition text-left"
              >
                <span className="w-7 h-7 rounded-[8px] bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
                  {LogoutIcon}
                </span>
                <span className="flex-1 text-[13px] font-semibold">Wyloguj</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
