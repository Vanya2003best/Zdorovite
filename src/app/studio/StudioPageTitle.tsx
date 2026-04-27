"use client";

import { usePathname } from "next/navigation";
import { STUDIO_NAV } from "./nav-items";

/**
 * Top-bar title block. Shows icon tile + section label + tiny description
 * underneath — gives the chrome a bit of visual weight instead of a lone word.
 * Reads STUDIO_NAV via usePathname so it always matches the current route.
 */
export default function StudioPageTitle() {
  const pathname = usePathname();
  const match = STUDIO_NAV.find((s) => s.match(pathname));
  const label = match?.label ?? "Studio";
  const description = match?.description ?? "";
  const icon = match?.icon;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && (
        <span className="hidden sm:inline-flex w-8 h-8 rounded-[9px] bg-emerald-50 text-emerald-700 items-center justify-center shrink-0">
          {icon}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <div className="text-[14px] sm:text-[15px] font-semibold tracking-[-0.01em] truncate">
          {label}
        </div>
        {description && (
          <div className="hidden sm:block text-[11px] text-slate-500 truncate">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
