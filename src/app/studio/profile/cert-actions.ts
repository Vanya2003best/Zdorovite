"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Certifications CRUD + attachment management for the trainer studio. Phase 1
 * of cert verification: trainer self-attaches a verification URL (issuer's
 * registry page) and/or uploads a PDF/image of the diploma. Public profile
 * shows clickable badges per cert so visitors can self-verify.
 */

export type ActionResult = { ok: true } | { error: string };

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the cert-attachments bucket limit

function extFromMime(m: string): string {
  if (m === "application/pdf") return "pdf";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "bin";
}

export async function addCertification(): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { data: existing } = await supabase
    .from("certifications")
    .select("position")
    .eq("trainer_id", user.id);
  const nextPos = existing?.length ?? 0;

  const { data, error } = await supabase
    .from("certifications")
    .insert({
      trainer_id: user.id,
      position: nextPos,
      text: "Nowa certyfikacja — kliknij, aby edytować",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/studio/profile");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true, id: data.id };
}

export async function removeCertification(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  // Best-effort: delete any attached file under this cert's id from storage.
  // We don't know the extension upfront so try all four.
  await supabase.storage.from("cert-attachments").remove([
    `${user.id}/${id}.pdf`,
    `${user.id}/${id}.jpg`,
    `${user.id}/${id}.png`,
    `${user.id}/${id}.webp`,
  ]);

  const { error } = await supabase
    .from("certifications")
    .delete()
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/profile");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

type CertField = "text" | "verification_url";

export async function updateCertificationField(
  id: string,
  field: CertField,
  value: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const trimmed = value.trim();

  // verification_url — empty string means "clear", any non-empty must look
  // like a URL (we accept both http and https; protocol-relative is also OK
  // but force-prepend https:// in the badge render for safety).
  if (field === "verification_url" && trimmed.length > 0) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return { error: "URL musi zaczynać się od http:// lub https://" };
    }
    if (trimmed.length > 2000) return { error: "URL zbyt długi." };
  }

  if (field === "text") {
    if (trimmed.length === 0) return { error: "Tekst nie może być pusty." };
    if (trimmed.length > 200) return { error: "Tekst zbyt długi (max 200)." };
  }

  const payload: Record<string, string | null> = {
    [field]: trimmed.length === 0 ? null : trimmed,
  };

  const { error } = await supabase
    .from("certifications")
    .update(payload)
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/profile");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

/**
 * Upload (or replace) a PDF/image attached to a specific certification row.
 * Stored at cert-attachments/{user_id}/{cert_id}.{ext} so the path is stable
 * across re-uploads (just overwrites). Cache-busted via ?v=ts on the URL.
 */
export async function uploadCertAttachment(formData: FormData): Promise<{ url?: string; filename?: string } | { error: string }> {
  const certId = formData.get("certId");
  const file = formData.get("file");
  if (typeof certId !== "string" || !certId) return { error: "Brak ID certyfikatu." };
  if (!(file instanceof File)) return { error: "Brak pliku." };

  if (!ALLOWED_MIME.includes(file.type)) return { error: "Tylko PDF, JPG, PNG lub WebP." };
  if (file.size === 0) return { error: "Plik jest pusty." };
  if (file.size > MAX_BYTES) return { error: "Plik za duży (max 10 MB)." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  // Verify ownership of the cert before writing the file so a malicious user
  // can't drop attachments under someone else's cert id.
  const { data: cert } = await supabase
    .from("certifications")
    .select("id")
    .eq("id", certId)
    .eq("trainer_id", user.id)
    .maybeSingle();
  if (!cert) return { error: "Certyfikat nie istnieje lub nie należy do Ciebie." };

  // Remove any previous attachment under a different extension so we don't
  // leave orphan files when the trainer re-uploads as a different format.
  await supabase.storage.from("cert-attachments").remove([
    `${user.id}/${certId}.pdf`,
    `${user.id}/${certId}.jpg`,
    `${user.id}/${certId}.png`,
    `${user.id}/${certId}.webp`,
  ]);

  const ext = extFromMime(file.type);
  const path = `${user.id}/${certId}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("cert-attachments")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("cert-attachments").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await supabase
    .from("certifications")
    .update({ attachment_url: url, attachment_filename: file.name })
    .eq("id", certId)
    .eq("trainer_id", user.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/studio/profile");
  revalidatePath("/trainers/[id]", "page");
  return { url, filename: file.name };
}

export async function removeCertAttachment(certId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  await supabase.storage.from("cert-attachments").remove([
    `${user.id}/${certId}.pdf`,
    `${user.id}/${certId}.jpg`,
    `${user.id}/${certId}.png`,
    `${user.id}/${certId}.webp`,
  ]);

  const { error } = await supabase
    .from("certifications")
    .update({ attachment_url: null, attachment_filename: null })
    .eq("id", certId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/profile");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}
