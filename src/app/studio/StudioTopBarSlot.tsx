"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the layout's StudioTopBar on routes that mount their own top bar.
 * Currently:
 *   /studio/design   — editor's action row (viewport/publish)
 *   /studio/calendar — design 32 unified calendar's title + KPIs +
 *                       Eksport / Sync Google / + Nowa sesja actions
 */
export default function StudioTopBarSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/studio/design") || pathname.startsWith("/studio/calendar")) return null;
  return <>{children}</>;
}
