"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase, getAdminUser } from "@/lib/admin";

type Result = { ok: true; data?: Record<string, never> } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

function validateCertId(certId: string): string | { error: string } {
  if (typeof certId !== "string" || !certId.trim()) return { error: "Brak ID." };
  return certId.trim();
}

function trainerSlugFrom(row: unknown): string | null {
  const trainer = (row as { trainer?: { slug?: unknown } | null } | null)?.trainer;
  return typeof trainer?.slug === "string" && trainer.slug ? trainer.slug : null;
}

export async function approveCert(certId: string): Promise<Result> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { error: "Brak uprawnień." };

    const id = validateCertId(certId);
    if (typeof id !== "string") return id;

    const supabase = createAdminSupabase();

    const { data: row, error: readErr } = await supabase
      .from("certifications")
      .select("trainer_id, trainer:trainers!trainer_id ( slug )")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { error: readErr.message };
    if (!row) return { error: "Nie znaleziono certyfikatu." };

    const { error } = await supabase
      .from("certifications")
      .update({
        verification_status: "verified",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        reject_reason: null,
      })
      .eq("id", id);
    if (error) return { error: error.message };

    const slug = trainerSlugFrom(row);
    if (slug) revalidatePath(`/trainers/${slug}`);
    revalidatePath("/admin/certs");
    revalidatePath("/studio/profile");
    return { ok: true };
  } catch (err) {
    console.error("approveCert", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function rejectCert(certId: string, reason: string): Promise<Result> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { error: "Brak uprawnień." };

    const id = validateCertId(certId);
    if (typeof id !== "string") return id;
    if (typeof reason !== "string") return { error: "Podaj powód odrzucenia." };

    const trimmed = reason.trim().slice(0, 500);
    if (!trimmed) return { error: "Podaj powód odrzucenia." };

    const supabase = createAdminSupabase();

    const { data: row, error: readErr } = await supabase
      .from("certifications")
      .select("trainer:trainers!trainer_id ( slug )")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { error: readErr.message };

    const { error } = await supabase
      .from("certifications")
      .update({
        verification_status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        reject_reason: trimmed,
      })
      .eq("id", id);
    if (error) return { error: error.message };

    const slug = trainerSlugFrom(row);
    if (slug) revalidatePath(`/trainers/${slug}`);
    revalidatePath("/admin/certs");
    revalidatePath("/studio/profile");
    return { ok: true };
  } catch (err) {
    console.error("rejectCert", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function reopenCert(certId: string): Promise<Result> {
  try {
    const admin = await getAdminUser();
    if (!admin) return { error: "Brak uprawnień." };

    const id = validateCertId(certId);
    if (typeof id !== "string") return id;

    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("certifications")
      .update({
        verification_status: "pending",
        reviewed_at: null,
        reviewed_by: null,
        reject_reason: null,
      })
      .eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/certs");
    revalidatePath("/studio/profile");
    return { ok: true };
  } catch (err) {
    console.error("reopenCert", err);
    return { error: DEFAULT_ERROR };
  }
}
