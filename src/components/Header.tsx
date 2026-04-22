import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg backdrop-saturate-[1.4]">
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
          <Link href="#" className="hover:text-slate-900 transition">Dla trenerów</Link>
          <Link href="#" className="hover:text-slate-900 transition">Pomoc</Link>
        </nav>

        <div className="hidden sm:flex items-center gap-2.5">
          <Link href="#" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 transition">
            Zaloguj się
          </Link>
          <Link href="#" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-black transition">
            Zarejestruj się
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="sm:hidden w-10 h-10 rounded-xl border border-slate-200 bg-white inline-flex items-center justify-center text-slate-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
    </header>
  );
}
