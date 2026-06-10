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
  revalidatePath("/");
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

export type ServiceActionResult = { ok: true } | { error: string };

const GENERIC_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

type ServiceInput = {
  id?: string;
  name: string;
  description: string;
  duration: number;
  price: number;
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

function parseServiceFormData(
  formData: unknown,
  { requireId }: { requireId: boolean },
): { data: ServiceInput } | { error: string } {
  if (!isFormData(formData)) return { error: "Nieprawidłowe dane formularza." };

  const id = requireId
    ? readText(formData, "id", "ID usługi jest wymagane.", { maxLength: 128 })
    : { value: undefined };
  if ("error" in id) return id;

  const name = readText(formData, "name", "Nazwa usługi jest wymagana.", { maxLength: 160 });
  if ("error" in name) return name;

  const description = readText(
    formData,
    "description",
    "Opis usługi jest nieprawidłowy.",
    { required: false, maxLength: 3000 },
  );
  if ("error" in description) return description;

  const duration = readNumber(formData, "duration", "Czas trwania musi być liczbą od 1 do 480 minut.", {
    min: 1,
    max: 480,
    integer: true,
  });
  if ("error" in duration) return duration;

  const price = readNumber(formData, "price", "Cena musi być większa od 0 i nie większa niż 10000.", {
    min: 0.01,
    max: 10000,
  });
  if ("error" in price) return price;

  return {
    data: {
      id: id.value,
      name: name.value,
      description: description.value,
      duration: duration.value,
      price: price.value,
    },
  };
}

export async function createService(
  formData: FormData
): Promise<ServiceActionResult> {
  try {
    const parsed = parseServiceFormData(formData, { requireId: false });
    if ("error" in parsed) return { error: parsed.error };
    const { name, description, duration, price } = parsed.data;

    const trainerId = await getTrainerId();
    if (!trainerId) return { error: "Niezalogowany." };

    const supabase = await createClient();
    const { data: existing, error: posErr } = await supabase
      .from("services")
      .select("position")
      .eq("trainer_id", trainerId)
      .order("position", { ascending: false })
      .limit(1);

    if (posErr) return { error: posErr.message };
    const nextPos = (existing?.[0]?.position ?? -1) + 1;

    const { error: insertErr } = await supabase.from("services").insert({
      trainer_id: trainerId,
      name,
      description,
      duration,
      price,
      position: nextPos,
    });

    if (insertErr) return { error: insertErr.message };

    revalidate(await getSlug());
    return { ok: true };
  } catch (err) {
    console.error("[studio/services] createService failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function updateService(
  formData: FormData
): Promise<ServiceActionResult> {
  try {
    const parsed = parseServiceFormData(formData, { requireId: true });
    if ("error" in parsed) return { error: parsed.error };
    const { id, name, description, duration, price } = parsed.data;
    if (!id) return { error: "ID usługi jest wymagane." };

    const trainerId = await getTrainerId();
    if (!trainerId) return { error: "Niezalogowany." };

    const supabase = await createClient();
    const { error: updateErr } = await supabase
      .from("services")
      .update({ name, description, duration, price })
      .eq("id", id)
      .eq("trainer_id", trainerId);

    if (updateErr) return { error: updateErr.message };

    revalidate(await getSlug());
    return { ok: true };
  } catch (err) {
    console.error("[studio/services] updateService failed:", err);
    return { error: GENERIC_ERROR };
  }
}

export async function deleteService(
  formData: FormData
): Promise<ServiceActionResult> {
  try {
    if (!isFormData(formData)) return { error: "Nieprawidłowe dane formularza." };
    const parsedId = readText(formData, "id", "ID usługi jest wymagane.", { maxLength: 128 });
    if ("error" in parsedId) return { error: parsedId.error };
    const id = parsedId.value;

    const trainerId = await getTrainerId();
    if (!trainerId) return { error: "Niezalogowany." };

    const supabase = await createClient();
    // Cancel bookings that reference this service so the delete can succeed.
    const { error: cancelErr } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("service_id", id)
      .eq("trainer_id", trainerId);

    if (cancelErr) return { error: cancelErr.message };

    const { error: deleteErr } = await supabase
      .from("services")
      .delete()
      .eq("id", id)
      .eq("trainer_id", trainerId);

    if (deleteErr) return { error: deleteErr.message };

    revalidate(await getSlug());
    return { ok: true };
  } catch (err) {
    console.error("[studio/services] deleteService failed:", err);
    return { error: GENERIC_ERROR };
  }
}
