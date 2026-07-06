"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Mobile navigation for the public header (< sm). The desktop header keeps
 * its inline link set (`hidden sm:flex` in Header.tsx); this component owns
 * the burger button and a full-width dropdown panel pinned under the 64px
 * chrome. Closes on link tap (delegated click on the nav) and on backdrop
 * tap.
 *
 * Server Header passes only serializable props (booleans/strings) — the
 * open/close state lives entirely on the client.
 */
export default function MobileMenu({
  isLoggedIn,
  displayName,
}: {
  isLoggedIn: boolean;
  displayName: string | null;
}) {
  const [open, setOpen] = useState(false);

  const initial = (displayName ?? "?").charAt(0).toUpperCase();

  const linkCls =
    "flex items-center gap-3 min-h-[48px] px-4 rounded-lg text-[15px] font-semibold text-white/90 hover:bg-white/10 hover:text-white transition";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Zamknij menu nawigacyjne" : "Otwórz menu nawigacyjne"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-lg text-white hover:bg-white/10 inline-flex items-center justify-center transition"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop — tap anywhere outside to close. */}
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 bg-black/40"
          />
          <nav
            aria-label="Menu mobilne"
            onClick={() => setOpen(false)}
            className="absolute left-0 right-0 top-16 border-t border-white/10 px-3 py-3 shadow-[0_16px_32px_rgba(0,0,0,0.35)]"
            style={{ background: "#002f34" }}
          >
            {isLoggedIn ? (
              <div className="grid gap-0.5">
                <Link href="/account" className={linkCls}>
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white inline-flex items-center justify-center font-bold text-[12px] shrink-0">
                    {initial}
                  </span>
                  <span className="truncate">{displayName ?? "Twoje konto"}</span>
                </Link>
                <Link href="/" className={linkCls}>Strona główna</Link>
                <Link href="/?fav=1" className={linkCls}>Obserwowane</Link>
                <Link href="/account/messages" className={linkCls}>Czat</Link>
              </div>
            ) : (
              <div className="grid gap-0.5">
                <Link href="/" className={linkCls}>Strona główna</Link>
                <Link href="/register/trainer" className={linkCls}>Zostań trenerem</Link>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-white/10">
                  <Link
                    href="/login"
                    className="min-h-[48px] rounded-[9px] text-[14px] font-semibold text-white border border-white/30 hover:bg-white/10 transition inline-flex items-center justify-center"
                  >
                    Zaloguj się
                  </Link>
                  <Link
                    href="/register"
                    className="min-h-[48px] rounded-[9px] bg-white text-[#002f34] font-bold text-[14px] hover:bg-emerald-50 transition inline-flex items-center justify-center"
                  >
                    Zarejestruj się
                  </Link>
                </div>
              </div>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
