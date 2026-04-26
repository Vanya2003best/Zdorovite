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
  revalidatePath("/studio/services");
}

const ALLOWED = new Set(["name", "description", "duration", "price"] as const);

export async function updateServiceField(
  serviceId: string,
  field: string,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ALLOWED.has(field as "name" | "description" | "duration" | "price")) return { error: "Invalid field." };
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  let patch: Record<string, string | number> = {};
  if (field === "name") {
    const v = value.trim();
    if (!v) return { error: "Nazwa nie może być pusta." };
    if (v.length > 80) return { error: "Max 80 znaków." };
    patch = { name: v };
  } else if (field === "description") {
    const v = value.trim();
    if (v.length > 250) return { error: "Max 250 znaków." };
    patch = { description: v };
  } else if (field === "duration") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 480) return { error: "Zakres 0–480 min." };
    patch = { duration: Math.round(n) };
  } else if (field === "price") {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > 10000) return { error: "Cena > 0, max 10 000 zł." };
    patch = { price: Math.round(n) };
  }

  const { error } = await c.supabase
    .from("services")
    .update(patch)
    .eq("id", serviceId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  bust(c.slug);
  return { ok: true };
}

export async function addService(): Promise<{ ok: true; id: string } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  const { data: existing } = await c.supabase
    .from("services")
    .select("position")
    .eq("trainer_id", c.trainerId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await c.supabase
    .from("services")
    .insert({
      trainer_id: c.trainerId,
      name: "Nowa usługa",
      description: "",
      duration: 60,
      price: 100,
      position: nextPos,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Błąd." };

  bust(c.slug);
  return { ok: true, id: data.id };
}

export async function removeService(
  serviceId: string,
): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Nie zalogowano." };

  // Cancel bookings first (bookings_check1 requires one of service/package non-null)
  await c.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("service_id", serviceId)
    .eq("trainer_id", c.trainerId);

  const { error } = await c.supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("trainer_id", c.trainerId);
  if (error) return { error: error.message };

  bust(c.slug);
  return { ok: true };
}
