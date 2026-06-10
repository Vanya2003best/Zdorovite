import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser, isTrainer as checkIsTrainer } from "@/lib/auth";
import AutoHideHeader from "./AutoHideHeader";

/**
 * Public top bar — dark teal OLX-style chrome.
 *
 * Hyperlink set mirrors design 41 / 38 / 37:
 *   Left nav  : Strona główna · Trenerzy · Specjalizacje · Jak to działa · Cennik
 *   Right side: 🔔 · Obserwowane · Czat · Twoje konto chip
 *   (Dropped: "+ Dodaj ogłoszenie" — felt out-of-place on the public
 *   site, where the equivalent action is registration as a trainer.)
 *
 * Hidden states:
 *   - Per-path hides (Studio / account / login / register / trainer
 *     template pages) handled by HeaderGate on the client so visibility
 *     flips immediately on navigation.
 *   - Embed mode (?embed=1) hidden server-side — set per-request by
 *     middleware via the `x-embed` header.
 */
export default async function Header() {
  const h = await headers();
  if (h.get("x-embed") === "1") return null;

  const pathname = h.get("x-pathname") ?? "";
  const cu = await getCurrentUser();
  const user = cu?.user ?? null;
  const displayName = cu?.profile.display_name ?? user?.email ?? null;
  void checkIsTrainer(cu?.profile);

  const initial = (displayName ?? "?").charAt(0).toUpperCase();

  // After the /trainers→/ merge, the homepage IS the search page so
  // "Strona główna" + "Trenerzy" would point to the same URL. Kept just
  // "Strona główna" to avoid duplicate navigation entries.
  const navItems: Array<{ href: string; label: string; active: boolean }> = [
    { href: "/",                label: "Strona główna",  active: pathname === "/" },
  ];

  return (
    <AutoHideHeader>
      <header
        className="sticky top-0 z-50 text-white"
        style={{ background: "#002f34" }}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-5 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-[19px] tracking-[-0.02em] shrink-0"
          >
            <span className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-extrabold text-[15px]">
              N
            </span>
            <span>
              Na<span className="text-emerald-400 font-extrabold">Zdrow</span>!
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "px-3 py-2 rounded-lg text-[14px] font-medium transition " +
                  (item.active
                    ? "text-white bg-white/10"
                    : "text-white/85 hover:bg-white/10 hover:text-white")
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-1">
            {user ? (
              <>
                {/* Bell icon — placeholder. Real NotificationsBell lives in
                    AccountTopBar / StudioTopBar with the DB-backed list. */}
                <Link
                  href="/account"
                  aria-label="Powiadomienia"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-white/90 hover:bg-white/10 hover:text-white transition relative"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </Link>
                <Link
                  href="/?fav=1"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  Obserwowane
                </Link>
                <Link
                  href="/account/messages"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-white/90 hover:bg-white/10 hover:text-white transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  Czat
                </Link>
                <Link
                  href="/account"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[9px] hover:bg-white/10 transition text-white ml-1"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white inline-flex items-center justify-center font-bold text-[11.5px]">
                    {initial}
                  </span>
                  <span className="text-[13px] font-semibold max-w-[140px] truncate">
                    {displayName}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-[9px] text-[13px] font-semibold text-white border border-white/30 hover:bg-white/10 transition"
                >
                  Zaloguj się
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-[9px] bg-white text-[#002f34] font-bold text-[13px] hover:bg-emerald-50 transition"
                >
                  Zarejestruj się
                </Link>
              </>
            )}
          </div>

          <button aria-label="Otwórz menu nawigacyjne" className="sm:hidden w-10 h-10 rounded-lg text-white hover:bg-white/10 inline-flex items-center justify-center transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </header>
    </AutoHideHeader>
  );
}
