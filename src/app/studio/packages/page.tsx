import { redirect } from "next/navigation";

/**
 * /studio/packages has been folded into /studio/uslugi?mode=pakiety
 * (design 33's unified offer page). Redirect preserves old bookmarks
 * and deep-links. ./actions.ts (createPackage / updatePackage /
 * deletePackage) is still used by the new client.
 */
export default function PackagesRedirect() {
  redirect("/studio/uslugi?mode=pakiety");
}
