import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser, isTrainer as checkIsTrainer } from "@/lib/auth";
import AutoHideHeader from "./AutoHideHeader";

export default async function Header() {
  // Hide the public header in trainer Studio (own sidebar), in iframe
  // previews (?embed=1), and on auth screens (full-bleed split layout).
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (pathname.startsWith("/studio")) return null;
  if (pathname.startsWith("/account")) return null;
  if (pathname === "/login" || pathname.startsWith("/register")) return null;
  if (h.get("x-embed") === "1") return null;

  const cu = await getCurrentUser();
  const user = cu?.user ?? null;
  const displayName = cu?.profile.display_name ?? user?.email ?? null;
  const isTrainer = checkIsTrainer(cu?.profile);

  return (
    <AutoHideHeader>
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-lg backdrop-saturate-[1.4]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
            N
          </span>
          <span className="text-lg font-bold tracking-tight">NaZdrow!</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-7 text-sm font-medium text-slate-700">
          <Link href="/trainers" className="hover:text-slate-900 transition">Znajdź trenera</Link>
          <Link href="#" className="hover:text-slate-900 transition">Specjalizacje</Link>
          <Link href="/register/trainer" className="hover:text-slate-900 transition">Dla trenerów</Link>
          <Link href="#" className="hover:text-slate-900 transition">Pomoc</Link>
        </nav>

        <div className="hidden sm:flex items-center gap-2.5">
          {user ? (
            <>
              {/* No "Studio" link in public header — trainer ecosystem is separate. */}
              <Link
                href="/account"
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-100 transition inline-flex items-center gap-2"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center text-xs font-semibold">
                  {(displayName ?? "?").charAt(0).toUpperCase()}
                </span>
                {displayName}
              </Link>
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition"
                >
                  Wyloguj
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 transition">
                Zaloguj się
              </Link>
              <Link href="/register" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-black transition">
                Zarejestruj się
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button className="sm:hidden w-10 h-10 rounded-xl border border-slate-200 bg-white inline-flex items-center justify-center text-slate-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
    </header>
    </AutoHideHeader>
  );
}
