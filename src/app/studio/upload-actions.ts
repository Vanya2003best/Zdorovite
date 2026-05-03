"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StudioCaseStudy, StudioCopy } from "@/types";

export type UploadResult = { url: string } | { error: string };

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB — matches the videos bucket cap

function extFromMime(m: string): string {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "video/mp4") return "mp4";
  if (m === "video/webm") return "webm";
  if (m === "video/quicktime") return "mov";
  return "bin";
}

function validate(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return "Tylko JPG, PNG lub WebP.";
  if (file.size > MAX_BYTES) return "Plik za duży (max 10 MB).";
  if (file.size === 0) return "Plik jest pusty.";
  return null;
}

function validateVideo(file: File): string | null {
  if (!ALLOWED_VIDEO_MIME.includes(file.type)) return "Tylko MP4, WebM lub MOV.";
  if (file.size > MAX_VIDEO_BYTES) return "Plik za duży (max 50 MB).";
  if (file.size === 0) return "Plik jest pusty.";
  return null;
}

/**
 * Read+modify+write a single key in the customization JSONB. Centralises the
 * page-vs-trainer routing so each upload action body stays small. Pass `null`
 * to delete the key (used by remove* actions).
 *
 * Phase 3 page-scoped uploads: when pageId is set, the URL goes into the
 * specific trainer_pages row's customization. When omitted, legacy path —
 * trainers.customization (= primary page).
 */
async function setCustomizationKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string | undefined,
  key: string,
  value: string | null,
): Promise<{ ok: true; slug: string | null } | { error: string }> {
  if (pageId) {
    const { data: page } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (!page) return { error: "Strona nie istnieje" };
    if (page.trainer_id !== userId) return { error: "Nie należy do Ciebie" };
    const customization = (page.customization ?? {}) as Record<string, unknown>;
    if (value === null) delete customization[key];
    else customization[key] = value;
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
    // Look up trainer slug for revalidation.
    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("slug")
      .eq("id", userId)
      .maybeSingle();
    return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
  }
  // Legacy primary path
  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("customization, slug")
    .eq("id", userId)
    .maybeSingle();
  const customization = (trainerRow?.customization ?? {}) as Record<string, unknown>;
  if (value === null) delete customization[key];
  else customization[key] = value;
  const { error } = await supabase
    .from("trainers")
    .update({ customization })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
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

/**
 * Persist the avatar focal point (CSS object-position string, e.g. "30% 45%").
 * Tolerates the column being absent — if migration 020 hasn't been applied
 * the write returns 42703 and we silently swallow it; the focal still paints
 * locally via optimistic state, but won't survive a refresh until the
 * migration lands. Same fallback shape as page.tsx for ai_context.
 */
export async function setProfileAvatarFocal(
  focal: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = String(focal).trim().slice(0, 32);
  // Accept "<n>% <n>%" (with optional decimals — EditableImage emits one
  // decimal place via toFixed(1)), single keywords (center / top / left /
  // etc.), or empty string (= reset to default).
  if (
    trimmed !== "" &&
    !/^[a-z]+$/i.test(trimmed) &&
    !/^\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/.test(trimmed)
  ) {
    return { error: "Nieprawidłowy format pozycji obrazka." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_focal: trimmed || null })
    .eq("id", user.id);
  // 42703 = column does not exist (migration 020 not applied). Treat as a
  // soft success so the optimistic UI doesn't show an error toast.
  if (error && error.code !== "42703") return { error: error.message };

  revalidatePath("/studio/profile");
  revalidatePath("/studio/design");
  return { ok: true };
}

/**
 * Remove the trainer's avatar — clears `profiles.avatar_url` and deletes the
 * storage file. Required by EditableImage's API even if the UI hides the
 * trash button (it still wires the prop through). Failing to remove from
 * storage is non-fatal — the URL is what matters.
 */
export async function removeAvatar(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  // Try common extensions — we don't track which one was uploaded.
  await Promise.all(
    ["jpg", "jpeg", "png", "webp"].map((ext) =>
      supabase.storage.from("avatars").remove([`${user.id}/avatar.${ext}`]),
    ),
  );

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/design");
  revalidatePath("/studio/profile");
  return { ok: true };
}

export async function uploadCover(formData: FormData, pageId?: string): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  // Path for primary cover stays the same (one cover per user). For page-
  // scoped uploads, namespace the file by page id so different pages can
  // hold different covers without overwriting each other.
  const path = pageId
    ? `${user.id}/p/${pageId}/cover.${ext}`
    : `${user.id}/cover.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const res = await setCustomizationKey(supabase, user.id, pageId, "coverImage", url);
  if ("error" in res) return res;

  // Primary cover ALSO syncs to trainers.cover_image column (used by listing
  // cards). Page-scoped covers don't propagate there — they only matter when
  // the page is rendered.
  if (!pageId) {
    await supabase.from("trainers").update({ cover_image: url }).eq("id", user.id);
  }

  revalidatePath("/studio/design");
  revalidatePath("/studio/profile");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url };
}

export async function removeCover(pageId?: string): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const prefix = pageId ? `${user.id}/p/${pageId}/cover` : `${user.id}/cover`;
  await supabase.storage.from("covers").remove([
    `${prefix}.jpg`, `${prefix}.png`, `${prefix}.webp`,
  ]);

  const res = await setCustomizationKey(supabase, user.id, pageId, "coverImage", null);
  if ("error" in res) return res;

  if (!pageId) {
    await supabase.from("trainers").update({ cover_image: null }).eq("id", user.id);
  }

  revalidatePath("/studio/design");
  revalidatePath("/studio/profile");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url: "" };
}

/** Upload (or replace) the Cinematic-template fullbleed editorial image.
 *  Saves to customization.cinematicFullbleedImage. */
export async function uploadFullbleed(formData: FormData, pageId?: string): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  const path = pageId
    ? `${user.id}/p/${pageId}/fullbleed.${ext}`
    : `${user.id}/fullbleed.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const res = await setCustomizationKey(supabase, user.id, pageId, "cinematicFullbleedImage", url);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url };
}

export async function removeFullbleed(pageId?: string): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const prefix = pageId ? `${user.id}/p/${pageId}/fullbleed` : `${user.id}/fullbleed`;
  await supabase.storage.from("covers").remove([
    `${prefix}.jpg`, `${prefix}.png`, `${prefix}.webp`,
  ]);

  const res = await setCustomizationKey(supabase, user.id, pageId, "cinematicFullbleedImage", null);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url: "" };
}

/** Upload (or replace) the Cinematic-template hero intro video. */
export async function uploadVideoIntro(formData: FormData, pageId?: string): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validateVideo(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  const path = pageId
    ? `${user.id}/p/${pageId}/intro.${ext}`
    : `${user.id}/intro.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("videos")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("videos").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const res = await setCustomizationKey(supabase, user.id, pageId, "cinematicVideoIntroUrl", url);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url };
}

export async function removeVideoIntro(pageId?: string): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const prefix = pageId ? `${user.id}/p/${pageId}/intro` : `${user.id}/intro`;
  await supabase.storage.from("videos").remove([
    `${prefix}.mp4`, `${prefix}.webm`, `${prefix}.mov`,
  ]);

  const res = await setCustomizationKey(supabase, user.id, pageId, "cinematicVideoIntroUrl", null);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url: "" };
}



/**
 * Update one case study inside customization.studioCopy.cases. Used by both
 * upload + remove case-photo actions to mutate the per-case `photo` field
 * without overwriting the rest of the array. Centralised here (rather than in
 * studio-copy-actions) so the upload action body stays compact.
 */
/** Mutates a single case in customization.studioCopy.cases — sets/clears the
 *  uploaded photo URL only. The deprecated `photoHidden` flag was an early
 *  attempt at "intentionally empty" slots; we revert to letting the fallback
 *  show whenever no upload exists. We DO still clear an existing hidden flag
 *  on upload so legacy data doesn't keep slots blank after a fresh upload. */
async function setStudioCasePhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string | undefined,
  caseId: string,
  url: string | null,
): Promise<{ ok: true; slug: string | null } | { error: string }> {
  const applyToCase = (c: StudioCaseStudy): StudioCaseStudy => {
    const next = { ...c };
    if (url === null) {
      delete next.photo;
    } else {
      next.photo = url;
      delete next.photoHidden;
    }
    return next;
  };

  if (pageId) {
    const { data: page } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (!page) return { error: "Strona nie istnieje" };
    if (page.trainer_id !== userId) return { error: "Nie należy do Ciebie" };
    const customization = (page.customization ?? {}) as Record<string, unknown> & {
      studioCopy?: StudioCopy;
    };
    const studioCopy: StudioCopy = { ...(customization.studioCopy ?? {}) };
    const cases = [...(studioCopy.cases ?? [])];
    const idx = cases.findIndex((c: StudioCaseStudy) => c.id === caseId);
    if (idx === -1) return { error: "Case study nie istnieje." };
    cases[idx] = applyToCase(cases[idx]!);
    studioCopy.cases = cases;
    customization.studioCopy = studioCopy;
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("slug")
      .eq("id", userId)
      .maybeSingle();
    return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
  }
  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("customization, slug")
    .eq("id", userId)
    .maybeSingle();
  const customization = (trainerRow?.customization ?? {}) as Record<string, unknown> & {
    studioCopy?: StudioCopy;
  };
  const studioCopy: StudioCopy = { ...(customization.studioCopy ?? {}) };
  const cases = [...(studioCopy.cases ?? [])];
  const idx = cases.findIndex((c: StudioCaseStudy) => c.id === caseId);
  if (idx === -1) return { error: "Case study nie istnieje." };
  cases[idx] = applyToCase(cases[idx]!);
  studioCopy.cases = cases;
  customization.studioCopy = studioCopy;
  const { error } = await supabase
    .from("trainers")
    .update({ customization })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
}

/** Upload (or replace) the photo for a single Studio case study. Stored in
 *  the `covers` bucket at `{userId}/p/{pageId}/case-{caseId}.{ext}` (or
 *  `{userId}/case-{caseId}.{ext}` for the primary page). The public URL is
 *  saved into customization.studioCopy.cases[idx].photo. */
export async function uploadStudioCasePhoto(
  formData: FormData,
  caseId: string,
  pageId?: string,
): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };
  if (!caseId) return { error: "Brak caseId." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  const path = pageId
    ? `${user.id}/p/${pageId}/case-${caseId}.${ext}`
    : `${user.id}/case-${caseId}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const res = await setStudioCasePhoto(supabase, user.id, pageId, caseId, url);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url };
}

/** Remove a case-study photo: deletes from storage and clears the URL from
 *  customization. */
export async function removeStudioCasePhoto(
  caseId: string,
  pageId?: string,
): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const prefix = pageId
    ? `${user.id}/p/${pageId}/case-${caseId}`
    : `${user.id}/case-${caseId}`;
  await supabase.storage.from("covers").remove([
    `${prefix}.jpg`, `${prefix}.png`, `${prefix}.webp`,
  ]);

  const res = await setStudioCasePhoto(supabase, user.id, pageId, caseId, null);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url: "" };
}

/**
 * Generic uploader for a string image-URL field inside `customization.studioCopy`.
 * Used for hero photo, about-collage photo, and any future Studio-template
 * image overrides that fall back to the trainer's gallery/avatar but should
 * be per-page-overridable. The field name doubles as the storage filename
 * stem, so the buckets stay tidy.
 */
type StudioCopyImageField = "heroPhoto" | "aboutCollagePhoto";

async function setStudioCopyKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string | undefined,
  field: StudioCopyImageField,
  url: string | null,
): Promise<{ ok: true; slug: string | null } | { error: string }> {
  if (pageId) {
    const { data: page } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (!page) return { error: "Strona nie istnieje" };
    if (page.trainer_id !== userId) return { error: "Nie należy do Ciebie" };
    const customization = (page.customization ?? {}) as Record<string, unknown> & {
      studioCopy?: StudioCopy;
    };
    const studioCopy: StudioCopy = { ...(customization.studioCopy ?? {}) };
    const hiddenKey = `${field}Hidden`;
    if (url === null) {
      delete (studioCopy as Record<string, unknown>)[field];
      // Don't set hidden flag on remove — fallback should re-appear.
      delete (studioCopy as Record<string, unknown>)[hiddenKey];
    } else {
      (studioCopy as Record<string, unknown>)[field] = url;
      delete (studioCopy as Record<string, unknown>)[hiddenKey];
    }
    customization.studioCopy = studioCopy;
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("slug")
      .eq("id", userId)
      .maybeSingle();
    return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
  }
  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("customization, slug")
    .eq("id", userId)
    .maybeSingle();
  const customization = (trainerRow?.customization ?? {}) as Record<string, unknown> & {
    studioCopy?: StudioCopy;
  };
  const studioCopy: StudioCopy = { ...(customization.studioCopy ?? {}) };
  if (url === null) delete (studioCopy as Record<string, unknown>)[field];
  else (studioCopy as Record<string, unknown>)[field] = url;
  customization.studioCopy = studioCopy;
  const { error } = await supabase
    .from("trainers")
    .update({ customization })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
}

export async function uploadStudioImage(
  formData: FormData,
  field: StudioCopyImageField,
  pageId?: string,
): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  const path = pageId
    ? `${user.id}/p/${pageId}/${field}.${ext}`
    : `${user.id}/${field}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const res = await setStudioCopyKey(supabase, user.id, pageId, field, url);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url };
}

export async function removeStudioImage(
  field: StudioCopyImageField,
  pageId?: string,
): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const prefix = pageId
    ? `${user.id}/p/${pageId}/${field}`
    : `${user.id}/${field}`;
  await supabase.storage.from("covers").remove([
    `${prefix}.jpg`, `${prefix}.png`, `${prefix}.webp`,
  ]);

  const res = await setStudioCopyKey(supabase, user.id, pageId, field, null);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url: "" };
}

/* =================================================================
 * Generic per-template image uploader.
 *
 * Used by Luxury / Signature / Cinematic for their per-page hero photo
 * (and any future image fields they add). Studio has its own dedicated
 * uploadStudioImage above because it predates the generic; refactoring it
 * onto this is a no-behaviour-change cleanup left for later.
 *
 * The "scope" arg names which copy-bag the URL lives in. The field arg is
 * the key inside that bag. Storage path: {userId}/p/{pageId}/{scope}-{field}.{ext}
 * (or without /p/{pageId} for primary). The scope-prefix keeps Cinematic's
 * "heroPhoto" from colliding with Luxury's on disk if they ever both apply
 * to the same trainer (multi-page setup).
 * ================================================================= */
export type TemplateImageScope = "luxuryCopy" | "signatureCopy" | "cinematicCopy";
export type TemplateImageField = "heroPhoto";

async function setTemplateCopyKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string | undefined,
  scope: TemplateImageScope,
  field: TemplateImageField,
  url: string | null,
): Promise<{ ok: true; slug: string | null } | { error: string }> {
  const apply = (root: Record<string, unknown>): Record<string, unknown> => {
    const bag = { ...((root[scope] as Record<string, unknown> | undefined) ?? {}) };
    if (url === null) delete bag[field];
    else bag[field] = url;
    return { ...root, [scope]: bag };
  };

  if (pageId) {
    const { data: page } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (!page) return { error: "Strona nie istnieje" };
    if (page.trainer_id !== userId) return { error: "Nie należy do Ciebie" };
    const next = apply((page.customization ?? {}) as Record<string, unknown>);
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization: next })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("slug")
      .eq("id", userId)
      .maybeSingle();
    return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
  }

  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("customization, slug")
    .eq("id", userId)
    .maybeSingle();
  const next = apply((trainerRow?.customization ?? {}) as Record<string, unknown>);
  const { error } = await supabase
    .from("trainers")
    .update({ customization: next })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true, slug: (trainerRow?.slug as string | null) ?? null };
}

export async function uploadTemplateImage(
  formData: FormData,
  scope: TemplateImageScope,
  field: TemplateImageField,
  pageId?: string,
): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  const err = validate(file);
  if (err) return { error: err };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const ext = extFromMime(file.type);
  // scope-prefixed filename so Luxury's hero doesn't overwrite Signature's on
  // disk when a trainer has multi-template multi-page setups.
  const stem = `${scope}-${field}`;
  const path = pageId
    ? `${user.id}/p/${pageId}/${stem}.${ext}`
    : `${user.id}/${stem}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const res = await setTemplateCopyKey(supabase, user.id, pageId, scope, field, url);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url };
}

/**
 * Set (or clear with empty string) a root-level customization string field.
 * Used for focal-point fields that live on the root rather than in a copy
 * bag — e.g. coverImageFocal, cinematicFullbleedFocal. Allowlisted to keep
 * trainers from writing arbitrary keys.
 */
const ROOT_FOCAL_FIELDS: ReadonlySet<string> = new Set([
  "coverImageFocal",
  "cinematicFullbleedFocal",
]);

export async function setCustomizationFocal(
  field: string,
  focal: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ROOT_FOCAL_FIELDS.has(field)) return { error: "Nieznane pole" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };
  const trimmed = focal.trim();
  const res = await setCustomizationKey(
    supabase,
    user.id,
    pageId,
    field,
    trimmed === "" ? null : trimmed,
  );
  if ("error" in res) return res;
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { ok: true };
}

export async function removeTemplateImage(
  scope: TemplateImageScope,
  field: TemplateImageField,
  pageId?: string,
): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const stem = `${scope}-${field}`;
  const prefix = pageId ? `${user.id}/p/${pageId}/${stem}` : `${user.id}/${stem}`;
  await supabase.storage.from("covers").remove([
    `${prefix}.jpg`, `${prefix}.png`, `${prefix}.webp`,
  ]);

  const res = await setTemplateCopyKey(supabase, user.id, pageId, scope, field, null);
  if ("error" in res) return res;

  revalidatePath("/studio/design");
  if (res.slug) revalidatePath(`/trainers/${res.slug}`);
  return { url: "" };
}
