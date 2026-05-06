import { redirect } from "next/navigation";

/**
 * /studio/services has been folded into /studio/uslugi (design 33's
 * unified offer page). Redirect so old bookmarks and any in-app
 * deep-links keep working. Server actions in ./actions.ts are still
 * imported by /studio/uslugi/UslugiClient — that file stays.
 */
export default function ServicesRedirect() {
  redirect("/studio/uslugi");
}
