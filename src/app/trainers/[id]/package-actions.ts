"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("trainers")
    .select("id, slug")
    .eq("id", user.id)
    .maybeSingle();
  return data ? { supabase, trainerId: data.id, slug: data.slug } : null;
}

function bust(slug: string) {
  revalidatePath(`/trainers/${slug}`);
  revalidatePath("/studio/profile");
  revalidatePath("/studio/packages");
}

const SCALAR = new Set(["name", "description", "price", "period"] as const);

export async function updatePackageField(
  packageId: string,
  field: string,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  if (!SCALAR.has(field as "name" | "description" | "price" | "period")) return { error: "Invalid field." };
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  let patch: Record<string, string | number | null> = {};
  if (field === "name") {
    const v = value.trim();
    if (!v) return { error: "Nazwa nie może być pusta." };
    if (v.length > 60) return { error: "Max 60 znaków." };
    patch = { name: v };
  } else if (field === "description") {
    const v = value.trim();
    if (v.length > 200) return { error: "Max 200 znaków." };
    patch = { description: v };
  } else if (field === "price") {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) return { error: "Cena > 0, max 100 000 zł." };
    patch = { price: Math.round(n) };
  } else if (field === "period") {
    const v = value.trim();
    if (v.length > 30) return { error: "Max 30 znaków." };
    patch = { period: v || null };
  }

  const { error } = await c.supabase
    .from("packages")
    .update(patch)
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  bust(c.slug);
  return { ok: true };
}

export async function updatePackageItems(
  packageId: string,
  items: string[],
): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  const clean = items.map((s) => String(s).trim()).filter(Boolean).slice(0, 15);

  const { error } = await c.supabase
    .from("packages")
    .update({ items: clean })
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  bust(c.slug);
  return { ok: true };
}

export async function togglePackageFeatured(
  packageId: string,
): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  const { data: pkg } = await c.supabase
    .from("packages")
    .select("featured")
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId)
    .maybeSingle();
  if (!pkg) return { error: "Nie znaleziono pakietu." };

  if (!pkg.featured) {
    // unset others
    await c.supabase
      .from("packages")
      .update({ featured: false })
      .eq("trainer_id", c.trainerId);
  }

  const { error } = await c.supabase
    .from("packages")
    .update({ featured: !pkg.featured })
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  bust(c.slug);
  return { ok: true };
}

export async function addPackage(): Promise<{ ok: true; id: string } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  const { data: existing } = await c.supabase
    .from("packages")
    .select("position")
    .eq("trainer_id", c.trainerId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await c.supabase
    .from("packages")
    .insert({
      trainer_id: c.trainerId,
      name: "Nowy pakiet",
      description: "",
      items: ["Pozycja 1"],
      price: 500,
      period: "miesiąc",
      featured: false,
      position: nextPos,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Błąd." };

  bust(c.slug);
  return { ok: true, id: data.id };
}

export async function removePackage(
  packageId: string,
): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  await c.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("package_id", packageId)
    .eq("trainer_id", c.trainerId);

  const { error } = await c.supabase
    .from("packages")
    .delete()
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  bust(c.slug);
  return { ok: true };
}
