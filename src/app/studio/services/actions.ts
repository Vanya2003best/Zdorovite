"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getTrainerId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("trainers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

function revalidate(slug: string | null) {
  revalidatePath("/studio/services");
  if (slug) revalidatePath(`/trainers/${slug}`);
  revalidatePath("/trainers");
}

async function getSlug(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  return data?.slug ?? null;
}

export async function createService(formData: FormData): Promise<void> {
  const trainerId = await getTrainerId();
  if (!trainerId) return;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const duration = Math.max(0, Math.min(480, Number(formData.get("duration") ?? 60)));
  const price = Math.max(0, Math.min(10000, Number(formData.get("price") ?? 0)));

  if (!name || price <= 0) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("services")
    .select("position")
    .eq("trainer_id", trainerId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  await supabase.from("services").insert({
    trainer_id: trainerId,
    name,
    description,
    duration,
    price,
    position: nextPos,
  });

  revalidate(await getSlug());
}

export async function updateService(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const trainerId = await getTrainerId();
  if (!trainerId) return;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const duration = Math.max(0, Math.min(480, Number(formData.get("duration") ?? 60)));
  const price = Math.max(0, Math.min(10000, Number(formData.get("price") ?? 0)));

  if (!name || price <= 0) return;

  const supabase = await createClient();
  await supabase
    .from("services")
    .update({ name, description, duration, price })
    .eq("id", id)
    .eq("trainer_id", trainerId);

  revalidate(await getSlug());
}

export async function deleteService(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const trainerId = await getTrainerId();
  if (!trainerId) return;

  const supabase = await createClient();
  // Null out any bookings referring to this service so the delete can succeed
  // (check constraint requires exactly one of service_id/package_id — so we flip
  // those bookings to cancelled as a safety net).
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("service_id", id)
    .eq("trainer_id", trainerId);

  await supabase.from("services").delete().eq("id", id).eq("trainer_id", trainerId);

  revalidate(await getSlug());
}
