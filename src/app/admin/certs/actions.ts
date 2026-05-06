"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase, getAdminUser } from "@/lib/admin";

type Result = { ok: true } | { error: string };

export async function approveCert(certId: string): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Brak uprawnień." };
  if (!certId) return { error: "Brak ID." };

  const supabase = createAdminSupabase();

  // Pull trainer slug for revalidation, then flip status.
  const { data: row, error: readErr } = await supabase
    .from("certifications")
    .select("trainer_id, trainer:trainers!trainer_id ( slug )")
    .eq("id", certId)
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
    .eq("id", certId);
  if (error) return { error: error.message };

  const slug = (row as unknown as { trainer: { slug: string } | null }).trainer?.slug;
  if (slug) revalidatePath(`/trainers/${slug}`);
  revalidatePath("/admin/certs");
  revalidatePath("/studio/profile");
  return { ok: true };
}

export async function rejectCert(certId: string, reason: string): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Brak uprawnień." };
  if (!certId) return { error: "Brak ID." };
  const trimmed = reason.trim().slice(0, 500);
  if (!trimmed) return { error: "Podaj powód odrzucenia." };

  const supabase = createAdminSupabase();

  const { data: row, error: readErr } = await supabase
    .from("certifications")
    .select("trainer:trainers!trainer_id ( slug )")
    .eq("id", certId)
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
    .eq("id", certId);
  if (error) return { error: error.message };

  const slug = (row as unknown as { trainer: { slug: string } | null } | null)?.trainer?.slug;
  if (slug) revalidatePath(`/trainers/${slug}`);
  revalidatePath("/admin/certs");
  revalidatePath("/studio/profile");
  return { ok: true };
}

/**
 * Re-open a previously rejected/verified row for re-review (admin
 * mistake recovery, or a trainer's appeal). Resets to pending.
 */
export async function reopenCert(certId: string): Promise<Result> {
  const admin = await getAdminUser();
  if (!admin) return { error: "Brak uprawnień." };

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("certifications")
    .update({
      verification_status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      reject_reason: null,
    })
    .eq("id", certId);
  if (error) return { error: error.message };

  revalidatePath("/admin/certs");
  revalidatePath("/studio/profile");
  return { ok: true };
}
