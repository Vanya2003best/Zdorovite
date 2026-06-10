"use client";

import { useEffect } from "react";

/**
 * Sticky header shell. Used to auto-hide on scroll-down; the user asked
 * for the header to stay pinned always, so the slide-off-screen behavior
 * was removed. The `--header-offset` CSS var is still published in case
 * downstream sticky bars want to pin themselves under the chrome.
 */
export default function AutoHideHeader({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.style.setProperty("--header-offset", "64px");
    return () => {
      document.documentElement.style.removeProperty("--header-offset");
    };
  }, []);

  return (
    <div className="sticky top-0 z-50">
      {children}
    </div>
  );
}
