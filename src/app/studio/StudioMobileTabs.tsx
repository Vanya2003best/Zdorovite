"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/studio",          label: "Główna",     icon: "🏠" },
  { href: "/studio/design",   label: "Edytor",     icon: "🎨" },
  { href: "/studio/bookings", label: "Rezerwacje", icon: "📅" },
  { href: "/studio/messages", label: "Czat",       icon: "💬" },
  { href: "/studio/services", label: "Usługi",     icon: "⚡" },
];

export default function StudioMobileTabs() {
  const pathname = usePathname();
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 grid grid-cols-5 px-2 pt-2 pb-3.5">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition ${
              active ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            <span className="text-[18px]">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
