"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

/**
 * Hides children when the current pathname falls under one of the listed
 * prefixes. Lives in the root layout so client-side navigation between
 * `/` and `/account` (or `/studio`, `/login`, etc.) hides the public
 * Header/Footer immediately — the Server Component versions are cached
 * across navigations in App Router and would otherwise stay visible
 * until a hard refresh.
 *
 * The Server Header/Footer still do their own ownership-based hiding
 * (route patterns, embed mode, role checks) — this just adds a client-
 * side path check on top so visibility flips on navigation.
 *
 * Note: regex patterns are passed as strings, not `RegExp` instances —
 * Server → Client Component boundaries can't serialize class instances
 * like RegExp. We build the RegExp on the client side via useMemo.
 */
export default function HeaderGate({
  hiddenPrefixes,
  hiddenExact,
  hiddenPatterns,
  children,
}: {
  /** Hide when pathname === prefix OR pathname.startsWith(prefix + "/"). */
  hiddenPrefixes?: string[];
  /** Hide when pathname === exact path. */
  hiddenExact?: string[];
  /** Hide when any of these regex source strings matches the pathname. */
  hiddenPatterns?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  const compiledPatterns = useMemo(
    () => (hiddenPatterns ?? []).map((src) => new RegExp(src)),
    [hiddenPatterns],
  );

  if (hiddenExact?.some((p) => pathname === p)) return null;
  if (hiddenPrefixes?.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  if (compiledPatterns.some((re) => re.test(pathname))) return null;

  return <>{children}</>;
}
