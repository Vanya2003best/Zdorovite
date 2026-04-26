"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export async function updateAvailability(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Build new rule set from form
  const rules: { trainer_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    const enabled = formData.get(`d${dow}_enabled`) === "on";
    if (!enabled) continue;
    const start = String(formData.get(`d${dow}_start`) ?? "");
    const end = String(formData.get(`d${dow}_end`) ?? "");
    if (!HHMM.test(start) || !HHMM.test(end)) continue;
    if (start >= end) continue;
    rules.push({ trainer_id: user.id, day_of_week: dow, start_time: start, end_time: end });
  }

  // Replace all rules for this trainer
  await supabase.from("availability_rules").delete().eq("trainer_id", user.id);
  if (rules.length > 0) {
    await supabase.from("availability_rules").insert(rules);
  }

  revalidatePath("/studio/availability");
}
