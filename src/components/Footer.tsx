import Link from "next/link";
import { headers } from "next/headers";

export default async function Footer() {
  // Hide on /studio (own layout), iframe preview (?embed=1), and auth screens.
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (pathname.startsWith("/studio")) return null;
  if (pathname === "/login" || pathname.startsWith("/register")) return null;
  if (h.get("x-embed") === "1") return null;

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-6 py-8 sm:pt-12 sm:pb-8">
        {/* Desktop: 4-column grid */}
        <div className="hidden sm:grid sm:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-lg text-slate-900">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 inline-flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(16,185,129,0.18)]">N</span>
              NaZdrow!
            </Link>
            <p className="mt-3.5 text-sm text-slate-600 leading-relaxed max-w-[320px]">
              Marketplace trenerów personalnych w Polsce. Łączymy ludzi z ekspertami od zdrowia i sportu.
            </p>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-slate-900 mb-3.5">Dla klientów</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li><Link href="/trainers" className="hover:text-slate-900 transition">Znajdź trenera</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Specjalizacje</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Pakiety</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Opinie</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-slate-900 mb-3.5">Dla trenerów</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li><Link href="#" className="hover:text-slate-900 transition">Dołącz</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Szablony profilu</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Kalendarz</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Cennik</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-slate-900 mb-3.5">Firma</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li><Link href="#" className="hover:text-slate-900 transition">O nas</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Kontakt</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Regulamin</Link></li>
              <li><Link href="#" className="hover:text-slate-900 transition">Polityka prywatności</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="sm:mt-10 sm:pt-6 sm:border-t sm:border-slate-200 flex flex-col sm:flex-row items-center sm:justify-between gap-2 text-[13px] text-slate-500">
          <span>&copy; {new Date().getFullYear()} NaZdrow! Wszelkie prawa zastrzeżone.</span>
          <span className="hidden sm:inline">Made in Warszawa 🇵🇱</span>
          {/* Mobile: simple links */}
          <div className="flex gap-6 sm:hidden">
            <Link href="#" className="hover:text-slate-700 transition">Regulamin</Link>
            <Link href="#" className="hover:text-slate-700 transition">Prywatność</Link>
            <Link href="#" className="hover:text-slate-700 transition">Kontakt</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
