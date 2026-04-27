"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the layout's StudioTopBar on routes that mount their own top bar
 * (currently only /studio/design — the editor renders its own action row
 * up top so the saved-status + viewport toggle + publish buttons sit
 * level with the section title instead of in a second strip below it).
 */
export default function StudioTopBarSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/studio/design")) return null;
  return <>{children}</>;
}
