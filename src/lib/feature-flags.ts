/**
 * Feature flags. Hard-coded for V1 — flip to env-driven if needed later
 * (NEXT_PUBLIC_ENABLE_PAGES=1 etc.). The point is to keep dead-code
 * paths out of the user's face without deleting the underlying
 * infrastructure, so a flip back to V2 is a one-line change.
 */

/**
 * Multi-page profiles (custom landing pages per trainer). MVP scope cuts
 * this — kept in the codebase for V2 B2B/influencer offering. When
 * flipping back: also re-enable the "Moje strony" CollapsibleSection in
 * EditorClient.tsx and remove the redirect in /studio/pages/page.tsx.
 */
export const ENABLE_PAGES = false;

/**
 * Client account "lite" mode (витрина strategy, 2026-07-07): NaZdrow is a
 * storefront + booking surface; the full CRM lives in TrainerApp. When true,
 * clients only get /account/bookings, /account/messages and /account/settings —
 * every other /account page (pulpit, plan, package, progress, payments,
 * trainer, become-trainer) server-redirects to /account/bookings, and the
 * client nav (AccountTopBar tabs, AccountBottomNav, AccountMenu CLIENT_ITEMS,
 * TrainerContextPanel "Pakiet" button) collapses accordingly.
 * Nothing is deleted. When flipping back to false: no other change needed —
 * all gated pages and full-nav code paths are kept alive.
 */
export const ACCOUNT_LITE = true;
