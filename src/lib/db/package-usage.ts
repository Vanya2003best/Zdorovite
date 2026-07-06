/**
 * Single source of truth for package-saldo derivation, shared by the
 * trainer roster (/studio/klienci via lib/db/clients.ts) and the client
 * package view (/account/package).
 *
 * Semantics (agreed launch-audit fix, 2026-07):
 *   used                — ONLY bookings the trainer marked `completed`.
 *   pendingConfirmation — sessions whose time has passed but the trainer
 *                         has not completed them yet (confirmed/paid/
 *                         pending). Shown to the client as
 *                         "czeka na potwierdzenie trenera" — honest about
 *                         why the number differs from "used".
 *   scheduled           — future (or in-progress) non-cancelled sessions.
 *   free                — slots still bookable.
 * Cancelled bookings never consume a slot.
 */

export type PackageBookingLike = {
  status: string;
  start_time: string;
  /** Optional — callers that don't select end_time fall back to start_time. */
  end_time?: string | null;
};

export type PackageUsage = {
  used: number;
  pendingConfirmation: number;
  scheduled: number;
  total: number;
  free: number;
};

export function packageUsage(
  bookings: PackageBookingLike[],
  sessionsTotal: number,
  now: number = Date.now(),
): PackageUsage {
  let used = 0;
  let pendingConfirmation = 0;
  let scheduled = 0;

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    if (b.status === "completed") {
      used += 1;
      continue;
    }
    const endsAt = new Date(b.end_time ?? b.start_time).getTime();
    if (endsAt < now) pendingConfirmation += 1;
    else scheduled += 1;
  }

  const total = Math.max(0, sessionsTotal);
  return {
    used,
    pendingConfirmation,
    scheduled,
    total,
    free: Math.max(0, total - used - pendingConfirmation - scheduled),
  };
}
