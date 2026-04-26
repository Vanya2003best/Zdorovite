"use server";

import { getAvailableSlots, type Slot } from "@/lib/db/availability";

export async function fetchSlots(
  trainerId: string,
  date: string,
): Promise<Slot[]> {
  return getAvailableSlots(trainerId, date);
}
