"use server";

import { getAvailableSlots, type Slot } from "@/lib/db/availability";

/**
 * Server-action wrapper around getAvailableSlots so client components
 * can fetch availability for an arbitrary trainer + date pair.
 *
 * Used by the reschedule flow (RescheduleDialog) and the booking flow
 * (trainers/[id]/book also has its own local copy of this for symmetry).
 */
export async function fetchSlotsForTrainer(trainerId: string, date: string): Promise<Slot[]> {
  return getAvailableSlots(trainerId, date);
}
