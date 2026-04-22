import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-emerald-600">Zdrovite</span>
          <span className="hidden sm:inline text-sm text-gray-500 font-medium">
            Trenerzy
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/trainers"
            className="text-sm font-medium text-gray-700 hover:text-emerald-600 transition"
          >
            Znajdź trenera
          </Link>
          <Link
            href="#"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Dołącz jako trener
          </Link>
        </nav>
      </div>
    </header>
  );
}
