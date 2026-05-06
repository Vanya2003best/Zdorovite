import { redirect } from "next/navigation";

/**
 * /studio/availability is now a sub-mode of the unified Calendar
 * (design 32). Permanent redirect so old bookmarks, e-mail
 * deeplinks, and any in-app links still land on the right view.
 */
export default function AvailabilityRedirect() {
  redirect("/studio/calendar?mode=pattern");
}
