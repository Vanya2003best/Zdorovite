"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

function parseInt0(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}

/** Upserts the single health row for the current client. */
export async function updateHealth(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nie zalogowano." };

  const note = String(formData.get("note") ?? "").trim() || null;
  const heightCm = parseInt0(formData.get("height_cm"), 51, 299);
  const fmsScore = parseInt0(formData.get("fms_score"), 0, 21);
  const restingHr = parseInt0(formData.get("resting_hr"), 21, 219);

  const { error } = await supabase
    .from("client_health")
    .upsert(
      {
        client_id: user.id,
        note,
        height_cm: heightCm,
        fms_score: fmsScore,
        resting_hr: restingHr,
      },
      { onConflict: "client_id" },
    );
  if (error) return { error: error.message };

  revalidatePath("/account");
  revalidatePath("/account/progress");
  return { ok: true };
}
