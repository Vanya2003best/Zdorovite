"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type AddClientInput = {
  displayName: string;
  email?: string;
  phone?: string;
  goal?: string;
  notes?: string;
  tags?: string[];
};

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true } & T)
  | { error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,20}$/;

/**
 * Add a manual client to the trainer's roster — for cash-paying / off-platform
 * clients that never went through the booking flow. profile_id stays null;
 * display_name/email/phone are the canonical contact.
 */
export async function addManualClient(
  input: AddClientInput,
): Promise<ActionResult<{ id: string }>> {
  const displayName = input.displayName.trim();
  if (!displayName) return { error: "Podaj imię i nazwisko klienta." };
  if (displayName.length > 80) return { error: "Imię i nazwisko max 80 znaków." };

  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  if (email && !EMAIL_RE.test(email)) return { error: "Nieprawidłowy email." };
  if (phone && !PHONE_RE.test(phone)) return { error: "Nieprawidłowy telefon." };

  const goal = input.goal?.trim().slice(0, 200) || null;
  const notes = input.notes?.trim().slice(0, 4000) || null;
  const tags = (input.tags ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { data, error } = await supabase
    .from("trainer_clients")
    .insert({
      trainer_id: user.id,
      profile_id: null,
      display_name: displayName,
      email,
      phone,
      goal,
      notes,
      tags,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Nie udało się dodać klienta." };

  revalidatePath("/studio/klienci");
  return { ok: true, id: data.id };
}

/**
 * Update one or more fields on an existing trainer_clients row. Granular
 * because the detail page edits each field inline (notes / goal / tags
 * / contact) without round-tripping the whole record.
 */
export async function updateClient(
  id: string,
  patch: Partial<AddClientInput> & { archived?: boolean },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) {
    const v = patch.displayName.trim();
    if (!v) return { error: "Imię nie może być puste." };
    if (v.length > 80) return { error: "Max 80 znaków." };
    update.display_name = v;
  }
  if (patch.email !== undefined) {
    const v = patch.email?.trim() || null;
    if (v && !EMAIL_RE.test(v)) return { error: "Nieprawidłowy email." };
    update.email = v;
  }
  if (patch.phone !== undefined) {
    const v = patch.phone?.trim() || null;
    if (v && !PHONE_RE.test(v)) return { error: "Nieprawidłowy telefon." };
    update.phone = v;
  }
  if (patch.goal !== undefined) {
    update.goal = patch.goal?.trim().slice(0, 200) || null;
  }
  if (patch.notes !== undefined) {
    update.notes = patch.notes?.trim().slice(0, 4000) || null;
  }
  if (patch.tags !== undefined) {
    update.tags = patch.tags
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 10);
  }
  if (patch.archived !== undefined) {
    update.archived_at = patch.archived ? new Date().toISOString() : null;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("trainer_clients")
    .update(update)
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/klienci");
  revalidatePath(`/studio/klienci/${id}`);
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error } = await supabase
    .from("trainer_clients")
    .delete()
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/klienci");
  redirect("/studio/klienci");
}
