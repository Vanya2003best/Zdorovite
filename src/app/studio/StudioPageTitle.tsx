"use client";

import { usePathname } from "next/navigation";
import { STUDIO_NAV } from "./nav-items";

/**
 * Derives the section title from the live pathname. We do this on the client
 * because Next.js may reuse layout server components across same-segment
 * navigations — re-running `headers()` inside the top bar isn't reliable
 * for keeping the title in sync.
 */
export default function StudioPageTitle() {
  const pathname = usePathname();
  const match = STUDIO_NAV.find((s) => s.match(pathname));
  return (
    <strong className="text-[14px] sm:text-[15px] font-semibold tracking-[-0.01em] truncate">
      {match?.label ?? "Studio"}
    </strong>
  );
}
