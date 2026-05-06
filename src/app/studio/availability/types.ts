/**
 * Shared availability types. Lives separate from the page (which is
 * now just a redirect to /studio/calendar?mode=pattern) so other
 * pages — most notably /studio/design — can import without pulling
 * a server component.
 */
export type DayRule = { start: string; end: string };
