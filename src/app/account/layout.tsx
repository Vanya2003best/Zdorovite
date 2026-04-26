import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

const NAV = [
  { href: "/account", label: "Pulpit", match: (p: string) => p === "/account" },
  { href: "/account/bookings", label: "Sesje", match: (p: string) => p.startsWith("/account/bookings") },
  { href: "/trainers", label: "Trenerzy", match: (p: string) => p.startsWith("/trainers") },
  { href: "/account/messages", label: "Wiadomości", match: (p: string) => p.startsWith("/account/messages") },
  // /account/progress doesn't exist yet — placeholder, see project_account_dashboard_followups memory
  { href: "#", label: "Postępy", match: () => false },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const cu = await getCurrentUser();
  const displayName = cu?.profile.display_name ?? cu?.user.email ?? "Konto";
  const avatarUrl = cu?.profile.avatar_url ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="bg-slate-100 min-h-[100dvh] flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5 sm:px-7 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
              Z
            </span>
            <span className="font-semibold text-[15px] tracking-[-0.01em]">NaZdrow!</span>
          </Link>
          <nav className="hidden md:flex gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Search — visual only for now */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-100 rounded-[9px] px-3 py-1.5 min-w-[280px] text-[13px] text-slate-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Szukaj trenera, sesji…
          </div>

          {/* Notifications */}
          <button
            aria-label="Powiadomienia"
            className="relative w-9 h-9 rounded-[9px] bg-white border border-slate-200 inline-flex items-center justify-center text-slate-700 hover:border-slate-400 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span className="absolute top-2 right-2 w-[7px] h-[7px] bg-red-500 rounded-full border-[1.5px] border-white" />
          </button>

          {/* Avatar pill */}
          <Link
            href="/account"
            className="inline-flex gap-2 items-center pl-1 pr-2.5 py-1 bg-white border border-slate-200 rounded-full hover:border-slate-400 transition"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center text-xs font-semibold">
                {initial}
              </span>
            )}
            <span className="text-[13px] font-medium hidden sm:inline">{displayName}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
