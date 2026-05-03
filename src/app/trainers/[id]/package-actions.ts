"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pushDeleteTombstone } from "@/lib/db/page-customization";

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

  const { data: before } = await c.supabase
    .from("packages")
    .select("name, description, price, period, is_placeholder")
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId)
    .maybeSingle();
  if (!before) return { error: "Pakiet nie istnieje." };

  let patch: Record<string, string | number | boolean | null> = {};
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
  patch.is_placeholder = false;

  const { error } = await c.supabase
    .from("packages")
    .update(patch)
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  await pushDeleteTombstone(c.trainerId, {
    kind: "packageUpdated",
    id: packageId,
    before: before as Record<string, unknown>,
    after: { ...(before as Record<string, unknown>), ...patch },
  });

  bust(c.slug);
  return { ok: true };
}

export async function updatePackageItems(
  packageId: string,
  items: string[],
): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  const { data: before } = await c.supabase
    .from("packages")
    .select("items, is_placeholder")
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId)
    .maybeSingle();
  if (!before) return { error: "Pakiet nie istnieje." };

  const clean = items.map((s) => String(s).trim()).filter(Boolean).slice(0, 15);

  const { error } = await c.supabase
    .from("packages")
    .update({ items: clean, is_placeholder: false })
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  await pushDeleteTombstone(c.trainerId, {
    kind: "packageUpdated",
    id: packageId,
    before: before as Record<string, unknown>,
    after: { ...(before as Record<string, unknown>), items: clean, is_placeholder: false },
  });

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

  await pushDeleteTombstone(c.trainerId, {
    kind: "packageUpdated",
    id: packageId,
    before: { featured: pkg.featured },
    after: { featured: !pkg.featured },
  });

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
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Błąd." };

  await pushDeleteTombstone(c.trainerId, {
    kind: "packageCreated",
    row: data as Record<string, unknown>,
  });

  bust(c.slug);
  return { ok: true, id: data.id };
}

export async function removePackage(
  packageId: string,
): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  const { data: row } = await c.supabase
    .from("packages")
    .select("*")
    .eq("id", packageId)
    .eq("trainer_id", c.trainerId)
    .maybeSingle();
  if (!row) return { error: "Pakiet nie istnieje." };

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

  await pushDeleteTombstone(c.trainerId, {
    kind: "packageDeleted",
    row: row as Record<string, unknown>,
  });

  bust(c.slug);
  return { ok: true };
}
