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
  revalidatePath("/");
}

function parseItems(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);
}

export type PackageActionResult = { ok: true } | { error: string };

const GENERIC_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

type PackageInput = {
  id?: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period: string | null;
  featured: boolean;
  sessionsTotal: number | null;
};

function isFormData(value: unknown): value is FormData {
  return value instanceof FormData;
}

function readText(
  formData: FormData,
  field: string,
  message: string,
  { required = true, maxLength = 1000 }: { required?: boolean; maxLength?: number } = {},
): { value: string } | { error: string } {
  const raw = formData.get(field);
  if (raw === null) {
    if (!required) return { value: "" };
    return { error: message };
  }
  if (typeof raw !== "string") return { error: message };

  const value = raw.trim();
  if (required && !value) return { error: message };
  if (value.length > maxLength) return { error: message };

  return { value };
}

function readNumber(
  formData: FormData,
  field: string,
  message: string,
  { min, max, integer = false }: { min: number; max: number; integer?: boolean },
): { value: number } | { error: string } {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw.trim()) return { error: message };

  const value = Number(raw);
  if (!Number.isFinite(value)) return { error: message };
  if (integer && !Number.isInteger(value)) return { error: message };
  if (value < min || value > max) return { error: message };

  return { value };
}

function readFeatured(formData: FormData): { value: boolean } | { error: string } {
  const raw = formData.get("featured");
  if (raw === null) return { value: false };
  if (typeof raw !== "string") return { error: "Wyróżnienie pakietu ma nieprawidłową wartość." };

  if (raw === "on" || raw === "true") return { value: true };
  if (raw === "off" || raw === "false" || raw === "") return { value: false };

  return { error: "Wyróżnienie pakietu ma nieprawidłową wartość." };
}

function readSessionsTotal(formData: FormData): { value: number | null } | { error: string } {
  const raw = formData.get("sessions_total");
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: "Liczba sesji ma nieprawidłową wartość." };

  const text = raw.trim();
  if (!text) return { value: null };

  const value = Number(text);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0 || value > 200) {
    return { error: "Liczba sesji musi być liczbą całkowitą od 1 do 200." };
  }

  return { value };
}

function parsePackageFormData(
  formData: unknown,
  { requireId }: { requireId: boolean },
): { data: PackageInput } | { error: string } {
  if (!isFormData(formData)) return { error: "Nieprawidłowe dane formularza." };

  const id = requireId
    ? readText(formData, "id", "ID pakietu jest wymagane.", { maxLength: 128 })
    : { value: undefined };
  if ("error" in id) return id;

  const name = readText(formData, "name", "Nazwa pakietu jest wymagana.", { maxLength: 160 });
  if ("error" in name) return name;

  const description = readText(
    formData,
    "description",
    "Opis pakietu jest nieprawidłowy.",
    { required: false, maxLength: 3000 },
  );
  if ("error" in description) return description;

  const rawItems = readText(formData, "items", "Dodaj co najmniej jeden element.", { maxLength: 3000 });
  if ("error" in rawItems) return rawItems;
  const items = parseItems(rawItems.value);
  if (items.length === 0) return { error: "Dodaj co najmniej jeden element." };

  const price = readNumber(formData, "price", "Cena musi być większa od 0 i nie większa niż 100000.", {
    min: 0.01,
    max: 100000,
  });
  if ("error" in price) return price;

  const period = readText(formData, "period", "Okres pakietu jest nieprawidłowy.", {
    required: false,
    maxLength: 80,
  });
  if ("error" in period) return period;

  const featured = readFeatured(formData);
  if ("error" in featured) return featured;

  const sessionsTotal = readSessionsTotal(formData);
  if ("error" in sessionsTotal) return sessionsTotal;

  return {
    data: {
      id: id.value,
      name: name.value,
      description: description.value,
      items,
      price: price.value,
      period: period.value || null,
      featured: featured.value,
      sessionsTotal: sessionsTotal.value,
    },
  };
}

export async function createPackage(
  formData: FormData
): Promise<PackageActionResult> {
  try {
    const parsed = parsePackageFormData(formData, { requireId: false });
    if ("error" in parsed) return { error: parsed.error };
    const { name, description, items, price, period, featured, sessionsTotal } = parsed.data;

    const ctx = await trainerContext();
    if (!ctx) return { error: "Niezalogowany." };

    // If featured, unset others first (max 1 featured).
    if (featured) {
      const { error: unsetErr } = await ctx.supabase
        .from("packages")
        .update({ featured: false })
        .eq("trainer_id", ctx.trainerId);
      if (unsetErr) return { error: unsetErr.message };
    }

    const { data: existing, error: posErr } = await ctx.supabase
      .from("packages")
      .select("position")
      .eq("trainer_id", ctx.trainerId)
      .order("position", { ascending: false })
      .limit(1);

    if (posErr) return { error: posErr.message };
    const nextPos = (existing?.[0]?.position ?? -1) + 1;

    const { error: insertErr } = await ctx.supabase.from("packages").insert({
      trainer_id: ctx.trainerId,
      name,
      description,
      items,
      price,
      period,
      featured,
      sessions_total: sessionsTotal,
      position: nextPos,
    });

    if (insertErr) return { error: insertErr.message };

    revalidate(ctx.slug);
    return { ok: true };
  } catch (err) {
    console.error("[studio/packages] createPackage failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function updatePackage(
  formData: FormData
): Promise<PackageActionResult> {
  try {
    const parsed = parsePackageFormData(formData, { requireId: true });
    if ("error" in parsed) return { error: parsed.error };
    const { id, name, description, items, price, period, featured, sessionsTotal } = parsed.data;
    if (!id) return { error: "ID pakietu jest wymagane." };

    const ctx = await trainerContext();
    if (!ctx) return { error: "Niezalogowany." };

    if (featured) {
      const { error: unsetErr } = await ctx.supabase
        .from("packages")
        .update({ featured: false })
        .eq("trainer_id", ctx.trainerId)
        .neq("id", id);
      if (unsetErr) return { error: unsetErr.message };
    }

    const { error: updateErr } = await ctx.supabase
      .from("packages")
      .update({ name, description, items, price, period, featured, sessions_total: sessionsTotal })
      .eq("id", id)
      .eq("trainer_id", ctx.trainerId);

    if (updateErr) return { error: updateErr.message };

    revalidate(ctx.slug);
    return { ok: true };
  } catch (err) {
    console.error("[studio/packages] updatePackage failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function deletePackage(
  formData: FormData
): Promise<PackageActionResult> {
  try {
    if (!isFormData(formData)) return { error: "Nieprawidłowe dane formularza." };
    const parsedId = readText(formData, "id", "ID pakietu jest wymagane.", { maxLength: 128 });
    if ("error" in parsedId) return { error: parsedId.error };
    const id = parsedId.value;

    const ctx = await trainerContext();
    if (!ctx) return { error: "Niezalogowany." };

    // Cancel bookings referencing this package (check constraint safety).
    const { error: cancelErr } = await ctx.supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("package_id", id)
      .eq("trainer_id", ctx.trainerId);

    if (cancelErr) return { error: cancelErr.message };

    const { error: deleteErr } = await ctx.supabase
      .from("packages")
      .delete()
      .eq("id", id)
      .eq("trainer_id", ctx.trainerId);

    if (deleteErr) return { error: deleteErr.message };

    revalidate(ctx.slug);
    return { ok: true };
  } catch (err) {
    console.error("[studio/packages] deletePackage failed:", err);
    return { error: GENERIC_ERROR };
  }
}
