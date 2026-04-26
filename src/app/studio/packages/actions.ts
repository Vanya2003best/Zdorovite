"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function trainerContext() {
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

function revalidate(slug: string) {
  revalidatePath("/studio/packages");
  revalidatePath(`/trainers/${slug}`);
  revalidatePath("/trainers");
}

function parseItems(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);
}

export async function createPackage(formData: FormData): Promise<void> {
  const ctx = await trainerContext();
  if (!ctx) return;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? ""));
  const price = Math.max(0, Math.min(100000, Number(formData.get("price") ?? 0)));
  const period = String(formData.get("period") ?? "").trim() || null;
  const featured = formData.get("featured") === "on";

  if (!name || price <= 0 || items.length === 0) return;

  // If featured, unset others first (max 1 featured)
  if (featured) {
    await ctx.supabase
      .from("packages")
      .update({ featured: false })
      .eq("trainer_id", ctx.trainerId);
  }

  const { data: existing } = await ctx.supabase
    .from("packages")
    .select("position")
    .eq("trainer_id", ctx.trainerId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  await ctx.supabase.from("packages").insert({
    trainer_id: ctx.trainerId,
    name,
    description,
    items,
    price,
    period,
    featured,
    position: nextPos,
  });

  revalidate(ctx.slug);
}

export async function updatePackage(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const ctx = await trainerContext();
  if (!ctx) return;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? ""));
  const price = Math.max(0, Math.min(100000, Number(formData.get("price") ?? 0)));
  const period = String(formData.get("period") ?? "").trim() || null;
  const featured = formData.get("featured") === "on";

  if (!name || price <= 0 || items.length === 0) return;

  if (featured) {
    await ctx.supabase
      .from("packages")
      .update({ featured: false })
      .eq("trainer_id", ctx.trainerId)
      .neq("id", id);
  }

  await ctx.supabase
    .from("packages")
    .update({ name, description, items, price, period, featured })
    .eq("id", id)
    .eq("trainer_id", ctx.trainerId);

  revalidate(ctx.slug);
}

export async function deletePackage(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const ctx = await trainerContext();
  if (!ctx) return;

  // Cancel bookings referencing this package (check constraint safety)
  await ctx.supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("package_id", id)
    .eq("trainer_id", ctx.trainerId);

  await ctx.supabase
    .from("packages")
    .delete()
    .eq("id", id)
    .eq("trainer_id", ctx.trainerId);

  revalidate(ctx.slug);
}
