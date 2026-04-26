"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UploadResult = { url: string } | { error: string };

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function extFromMime(m: string): string {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "bin";
}

function validate(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return "Tylko JPG, PNG lub WebP.";
  if (file.size > MAX_BYTES) return "Plik za duży (max 10 MB).";
  if (file.size === 0) return "Plik jest pusty.";
  return null;
}

export async function uploadAvatar(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  const path = `${user.id}/avatar.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-busting query so browsers re-fetch after replace
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/studio/design");
  revalidatePath("/studio/profile");
  return { url };
}

export async function uploadCover(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  const path = `${user.id}/cover.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await supabase
    .from("trainers")
    .update({ cover_image: url })
    .eq("id", user.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/studio/design");
  revalidatePath("/studio/profile");
  return { url };
}

export async function removeCover(): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  // Best-effort: delete every common ext under the user's folder
  await supabase.storage.from("covers").remove([
    `${user.id}/cover.jpg`, `${user.id}/cover.png`, `${user.id}/cover.webp`,
  ]);

  const { error: dbErr } = await supabase
    .from("trainers")
    .update({ cover_image: null })
    .eq("id", user.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/studio/design");
  revalidatePath("/studio/profile");
  return { url: "" };
}
