"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export type AvailabilityRule = { dow: number; start: string; end: string };

/**
 * Replace the trainer's full set of weekly availability rules.
 * - dow: 0 (Sunday) … 6 (Saturday)
 * - start/end: "HH:MM" 24-hour
 *
 * Used by the visual timeline editor in /studio/design (auto-saved on edit)
 * and the legacy form in /studio/availability (form submit).
 */
export async function saveAvailabilityRules(rules: AvailabilityRule[]): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const valid: { trainer_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];
  for (const r of rules) {
    if (typeof r.dow !== "number" || r.dow < 0 || r.dow > 6) continue;
    if (!HHMM.test(r.start) || !HHMM.test(r.end)) continue;
    if (r.start >= r.end) continue;
    valid.push({ trainer_id: user.id, day_of_week: r.dow, start_time: r.start, end_time: r.end });
  }

  await supabase.from("availability_rules").delete().eq("trainer_id", user.id);
  if (valid.length > 0) {
    await supabase.from("availability_rules").insert(valid);
  }

  revalidatePath("/studio/availability");
  revalidatePath("/studio/design");
}

/** Legacy form-data adapter for /studio/availability/page.tsx form submit. */
export async function updateAvailability(formData: FormData): Promise<void> {
  const rules: AvailabilityRule[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    if (formData.get(`d${dow}_enabled`) !== "on") continue;
    rules.push({
      dow,
      start: String(formData.get(`d${dow}_start`) ?? ""),
      end: String(formData.get(`d${dow}_end`) ?? ""),
    });
  }
  await saveAvailabilityRules(rules);
}
