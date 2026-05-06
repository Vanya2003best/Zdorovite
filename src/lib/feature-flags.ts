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
