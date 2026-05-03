"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";
import type { ProfileCustomization } from "@/types";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function extFromMime(m: string): string {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "bin";
}

/**
 * Upload one image into the trainer's gallery. Storage path:
 *   gallery/{uid}/{generated-uuid}.{ext}
 * Then insert a row into gallery_photos linking trainer_id, url, position
 * (appended to end). Returns the new row id so client can target it for delete.
 */
export async function addGalleryPhoto(
  formData: FormData,
): Promise<{ ok: true; id: string; url: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  if (!ALLOWED_MIME.includes(file.type)) return { error: "Tylko JPG, PNG lub WebP." };
  if (file.size > MAX_BYTES) return { error: "Plik za duży (max 10 MB)." };
  if (file.size === 0) return { error: "Plik jest pusty." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Get trainer slug for revalidation, plus current max(position) so we append.
  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) return { error: "Konto trenera nie istnieje" };

  const { data: existing } = await supabase
    .from("gallery_photos")
    .select("position")
    .eq("trainer_id", user.id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  // Insert empty row first to get a stable UUID for the storage path —
  // keeps blob name and DB id in sync, makes orphan cleanup easy.
  const { data: row, error: insertErr } = await supabase
    .from("gallery_photos")
    .insert({ trainer_id: user.id, url: "", position: nextPosition })
    .select("id")
    .single();
  if (insertErr || !row) return { error: insertErr?.message ?? "Nie udało się utworzyć rekordu" };

  const ext = extFromMime(file.type);
  const path = `${user.id}/${row.id}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("gallery")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) {
    // Roll back the empty row so we don't leave a ghost.
    await supabase.from("gallery_photos").delete().eq("id", row.id);
    return { error: upErr.message };
  }

  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from("gallery_photos")
    .update({ url })
    .eq("id", row.id);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/studio/design");
  if (trainer.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true, id: row.id, url };
}

/**
 * Swap the file behind an existing gallery_photos row. The DB id and position
 * stay the same; only the storage object + URL change. Used by the per-tile
 * "Zmień zdjęcie" affordance in the gallery editor.
 *
 * Storage path scheme matches addGalleryPhoto: gallery/{uid}/{id}.{ext}. We
 * delete sibling extensions so a JPG → PNG replacement doesn't leave the old
 * file orphaned.
 */
export async function replaceGalleryPhoto(
  id: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Brak pliku." };
  if (!ALLOWED_MIME.includes(file.type)) return { error: "Tylko JPG, PNG lub WebP." };
  if (file.size > MAX_BYTES) return { error: "Plik za duży (max 10 MB)." };
  if (file.size === 0) return { error: "Plik jest pusty." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Verify ownership before touching storage.
  const { data: row } = await supabase
    .from("gallery_photos")
    .select("id")
    .eq("id", id)
    .eq("trainer_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Zdjęcie nie istnieje" };

  // Wipe any prior file under all known extensions so the swap is clean —
  // ext can change between JPG/PNG/WebP across replacements.
  await supabase.storage.from("gallery").remove([
    `${user.id}/${id}.jpg`, `${user.id}/${id}.png`, `${user.id}/${id}.webp`,
  ]);

  const ext = extFromMime(file.type);
  const path = `${user.id}/${id}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("gallery")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from("gallery_photos")
    .update({ url })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (updateErr) return { error: updateErr.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true, url };
}

/**
 * Soft-hide a gallery photo on the current page. Adds the photo's id to
 * customization.galleryHidden via the snapshot-aware saveCustomization, so
 * the action is undoable. The gallery_photos row and storage file are NOT
 * touched — to free the underlying file the trainer uses the global gallery
 * management at /studio/profile/gallery.
 *
 * No-op when the id is already hidden. Also clears any galleryFocal entry
 * for this id (kept it = stale crop the trainer will re-set on unhide).
 */
export async function hideGalleryPhotoOnPage(
  photoId: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!photoId) return { error: "Brak id zdjęcia." };
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const prev = ctx.customization;
  const hiddenSet = new Set(prev.galleryHidden ?? []);
  if (hiddenSet.has(photoId)) return { ok: true };
  hiddenSet.add(photoId);

  const nextHidden = [...hiddenSet];
  const nextFocal = { ...(prev.galleryFocal ?? {}) };
  delete nextFocal[photoId];

  const next: ProfileCustomization = {
    ...prev,
    galleryHidden: nextHidden,
  };
  if (Object.keys(nextFocal).length === 0) {
    delete next.galleryFocal;
  } else {
    next.galleryFocal = nextFocal;
  }

  return saveCustomization(ctx.userId, prev, next, pageId);
}

/**
 * Reverse of hideGalleryPhotoOnPage. Removes the id from galleryHidden so
 * the photo re-appears on this page. Useful when a UI to manage hidden
 * photos lands; for now exposed for completeness + tests.
 */
export async function unhideGalleryPhotoOnPage(
  photoId: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!photoId) return { error: "Brak id zdjęcia." };
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const prev = ctx.customization;
  const hidden = (prev.galleryHidden ?? []).filter((id) => id !== photoId);
  const next: ProfileCustomization = { ...prev };
  if (hidden.length === 0) delete next.galleryHidden;
  else next.galleryHidden = hidden;
  return saveCustomization(ctx.userId, prev, next, pageId);
}

/**
 * Persist a per-page object-position for a single gallery photo. Stored in
 * customization.galleryFocal at the root (per-page when pageId is set, on
 * trainers.customization for the primary page). Pass empty string to clear
 * back to the default "center".
 */
export async function setGalleryFocal(
  photoId: string,
  focal: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };
  const trimmed = focal.trim();

  const apply = (root: Record<string, unknown>): Record<string, unknown> => {
    const map = { ...((root.galleryFocal as Record<string, string> | undefined) ?? {}) };
    if (trimmed === "") delete map[photoId];
    else map[photoId] = trimmed;
    const next = { ...root };
    if (Object.keys(map).length === 0) delete next.galleryFocal;
    else next.galleryFocal = map;
    return next;
  };

  if (pageId) {
    const { data: page } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (!page) return { error: "Strona nie istnieje" };
    if (page.trainer_id !== user.id) return { error: "Nie należy do Ciebie" };
    const next = apply((page.customization ?? {}) as Record<string, unknown>);
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization: next })
      .eq("id", pageId)
      .eq("trainer_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { data: trainerRow } = await supabase
      .from("trainers")
      .select("customization")
      .eq("id", user.id)
      .maybeSingle();
    const next = apply((trainerRow?.customization ?? {}) as Record<string, unknown>);
    const { error } = await supabase
      .from("trainers")
      .update({ customization: next })
      .eq("id", user.id);
    if (error) return { error: error.message };
  }

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true };
}

/**
 * Reorder gallery photos. Pass the desired ordering as an array of ids; this
 * writes `position: 0..N-1` to each row in gallery_photos. Reorder is GLOBAL
 * (not per-page) — every page that renders the gallery reflects the new
 * order, while per-page hide / focal overrides remain untouched.
 */
export async function setGalleryOrder(
  orderedIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Update each row's position in a single round trip via Promise.all. Each
  // row guards on trainer_id so a malicious client can't shuffle someone
  // else's gallery by sending their photo ids.
  const updates = orderedIds.map((id, idx) =>
    supabase
      .from("gallery_photos")
      .update({ position: idx })
      .eq("id", id)
      .eq("trainer_id", user.id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) return { error: r.error.message };
  }

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true };
}

export async function removeGalleryPhoto(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  // Best-effort: delete every common ext for this id under the user's folder.
  await supabase.storage
    .from("gallery")
    .remove([`${user.id}/${id}.jpg`, `${user.id}/${id}.png`, `${user.id}/${id}.webp`]);

  const { error } = await supabase
    .from("gallery_photos")
    .delete()
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/studio/design");
  if (trainer?.slug) revalidatePath(`/trainers/${trainer.slug}`);
  return { ok: true };
}
