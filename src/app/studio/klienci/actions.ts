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
  | (T extends void ? { ok: true; data?: unknown } : ({ ok: true; data?: T } & T))
  | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,20}$/;

function validateId(id: string): string | { error: string } {
  if (typeof id !== "string" || !id.trim()) return { error: "Brak ID." };
  return id.trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOptionalString(value: unknown, fieldName: string): string | undefined | { error: string } {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return { error: `Nieprawidłowe pole: ${fieldName}.` };
  return value;
}

export async function addManualClient(
  input: AddClientInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!isObject(input)) return { error: "Nieprawidłowe dane klienta." };
    if (typeof input.displayName !== "string") return { error: "Podaj imię i nazwisko klienta." };

    const displayName = input.displayName.trim();
    if (!displayName) return { error: "Podaj imię i nazwisko klienta." };
    if (displayName.length > 80) return { error: "Imię i nazwisko max 80 znaków." };

    const rawEmail = validateOptionalString(input.email, "email");
    if (typeof rawEmail !== "string" && rawEmail !== undefined) return rawEmail;
    const rawPhone = validateOptionalString(input.phone, "telefon");
    if (typeof rawPhone !== "string" && rawPhone !== undefined) return rawPhone;
    const rawGoal = validateOptionalString(input.goal, "cel");
    if (typeof rawGoal !== "string" && rawGoal !== undefined) return rawGoal;
    const rawNotes = validateOptionalString(input.notes, "notatki");
    if (typeof rawNotes !== "string" && rawNotes !== undefined) return rawNotes;

    if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== "string"))) {
      return { error: "Nieprawidłowe tagi." };
    }

    const email = rawEmail?.trim() || null;
    const phone = rawPhone?.trim() || null;
    if (email && !EMAIL_RE.test(email)) return { error: "Nieprawidłowy email." };
    if (phone && !PHONE_RE.test(phone)) return { error: "Nieprawidłowy telefon." };

    const goal = rawGoal?.trim().slice(0, 200) || null;
    const notes = rawNotes?.trim().slice(0, 4000) || null;
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

    if (error || !data?.id) return { error: error?.message ?? "Nie udało się dodać klienta." };

    revalidatePath("/studio/klienci");
    return { ok: true, data: { id: data.id }, id: data.id };
  } catch (err) {
    console.error("addManualClient", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function updateClient(
  id: string,
  patch: Partial<AddClientInput> & { archived?: boolean },
): Promise<ActionResult> {
  try {
    const clientId = validateId(id);
    if (typeof clientId !== "string") return clientId;
    if (!isObject(patch)) return { error: "Nieprawidłowe dane klienta." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    const update: Record<string, unknown> = {};
    if (patch.displayName !== undefined) {
      if (typeof patch.displayName !== "string") return { error: "Nieprawidłowe imię." };
      const v = patch.displayName.trim();
      if (!v) return { error: "Imię nie może być puste." };
      if (v.length > 80) return { error: "Max 80 znaków." };
      update.display_name = v;
    }
    if (patch.email !== undefined) {
      if (typeof patch.email !== "string") return { error: "Nieprawidłowy email." };
      const v = patch.email.trim() || null;
      if (v && !EMAIL_RE.test(v)) return { error: "Nieprawidłowy email." };
      update.email = v;
    }
    if (patch.phone !== undefined) {
      if (typeof patch.phone !== "string") return { error: "Nieprawidłowy telefon." };
      const v = patch.phone.trim() || null;
      if (v && !PHONE_RE.test(v)) return { error: "Nieprawidłowy telefon." };
      update.phone = v;
    }
    if (patch.goal !== undefined) {
      if (typeof patch.goal !== "string") return { error: "Nieprawidłowy cel." };
      update.goal = patch.goal.trim().slice(0, 200) || null;
    }
    if (patch.notes !== undefined) {
      if (typeof patch.notes !== "string") return { error: "Nieprawidłowe notatki." };
      update.notes = patch.notes.trim().slice(0, 4000) || null;
    }
    if (patch.tags !== undefined) {
      if (!Array.isArray(patch.tags) || patch.tags.some((tag) => typeof tag !== "string")) {
        return { error: "Nieprawidłowe tagi." };
      }
      update.tags = patch.tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 30)
        .slice(0, 10);
    }
    if (patch.archived !== undefined) {
      if (typeof patch.archived !== "boolean") return { error: "Nieprawidłowy status archiwum." };
      update.archived_at = patch.archived ? new Date().toISOString() : null;
    }
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase
      .from("trainer_clients")
      .update(update)
      .eq("id", clientId)
      .eq("trainer_id", user.id);
    if (error) return { error: error.message };

    revalidatePath("/studio/klienci");
    revalidatePath(`/studio/klienci/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("updateClient", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function deleteClient(id: string): Promise<ActionResult> {
  let shouldRedirect = false;

  try {
    const clientId = validateId(id);
    if (typeof clientId !== "string") return clientId;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    const { error } = await supabase
      .from("trainer_clients")
      .delete()
      .eq("id", clientId)
      .eq("trainer_id", user.id);
    if (error) return { error: error.message };

    revalidatePath("/studio/klienci");
    shouldRedirect = true;
  } catch (err) {
    console.error("deleteClient", err);
    return { error: DEFAULT_ERROR };
  }

  if (shouldRedirect) redirect("/studio/klienci");
  return { ok: true };
}
