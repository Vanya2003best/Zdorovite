"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * CRUD for SignatureProfile membership_tiers — Bronze / Silver / Gold tier
 * cards. RLS keeps writes scoped to the trainer's own row, so service-role
 * isn't needed; we go through the user's session.
 */

export type ActionResult = { ok: true } | { error: string };

const TIER_LABELS = ["Bronze", "Silver", "Gold"];

export async function addMembershipTier(): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Pick the next position + tier label based on existing count.
  const { data: existing } = await supabase
    .from("membership_tiers")
    .select("position, tier_label")
    .eq("trainer_id", user.id);
  const nextPos = (existing?.length ?? 0);
  const nextLabel = TIER_LABELS[nextPos] ?? `Tier ${nextPos + 1}`;

  const { data, error } = await supabase
    .from("membership_tiers")
    .insert({
      trainer_id: user.id,
      position: nextPos,
      tier_label: nextLabel,
      name: "Nowe członkostwo",
      description: "",
      price: 1000,
      period: "miesiąc",
      items: ["Pierwszy benefit", "Drugi benefit", "Trzeci benefit"],
      featured: false,
      cta_text: `Dołącz do ${nextLabel} →`,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true, id: data.id };
}

export async function removeMembershipTier(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const { error } = await supabase
    .from("membership_tiers")
    .delete()
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

type TierField = "tier_label" | "name" | "description" | "price" | "period" | "cta_text";

export async function updateMembershipTierField(
  id: string,
  field: TierField,
  value: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Coerce price → integer; everything else stays string.
  const payload: Record<string, string | number> = {};
  if (field === "price") {
    const n = parseInt(value.replace(/\s+/g, "").replace(/[^\d]/g, ""), 10);
    if (Number.isNaN(n) || n < 0) return { error: "Nieprawidłowa cena" };
    payload.price = n;
  } else {
    payload[field] = value;
  }

  const { error } = await supabase
    .from("membership_tiers")
    .update(payload)
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

export async function updateMembershipTierItems(
  id: string,
  items: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  const cleaned = items.map((s) => s.trim()).filter(Boolean).slice(0, 12);

  const { error } = await supabase
    .from("membership_tiers")
    .update({ items: cleaned })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

/**
 * Toggle the gold "Najczęściej wybierane" badge. Only one tier can be
 * featured at a time — flipping one ON flips all siblings OFF.
 */
export async function setMembershipTierFeatured(
  id: string,
  featured: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  if (featured) {
    // Clear any existing featured tier first.
    await supabase
      .from("membership_tiers")
      .update({ featured: false })
      .eq("trainer_id", user.id)
      .eq("featured", true);
  }
  const { error } = await supabase
    .from("membership_tiers")
    .update({ featured })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}
