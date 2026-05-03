"use client";

import { useRouter } from "next/navigation";
import EditableImage from "./EditableImage";
import { useEditingPageId } from "./EditingPageContext";
import {
  uploadCover,
  removeCover,
  uploadFullbleed,
  removeFullbleed,
  setCustomizationFocal,
} from "@/app/studio/upload-actions";

/**
 * Cinematic-template image editors. Two slots, both backed by EXISTING
 * customization root fields (coverImage / cinematicFullbleedImage) — we
 * don't add a per-template copy-bag key here because Cinematic already had
 * its own dedicated cover and fullbleed uploads before the multi-template
 * editable-image work; reusing them avoids a data migration.
 *
 * Both wrappers wire EditableImage to those existing actions. Focal points
 * are NEW: stored in customization.{cover,cinematicFullbleed}Focal at the
 * root via the small allowlisted setCustomizationFocal helper.
 *
 * `EditableCinematicHero` uses background mode — Cinematic's hero already
 * paints the photo as a backgroundImage so we can layer the existing
 * darkening gradient on top in the same element.
 *
 * `EditableCinematicFullbleed` uses img mode — that section is a plain
 * <img> with a separate side-overlay grid, so an inline image fits cleanly.
 */

const ACCENT = "#d4ff00";

export function EditableCinematicHero({
  current,
  currentFocal,
  fallback,
  alt,
  containerClassName = "",
  editable = true,
  /** CSS overlay rendered above the image (e.g. the dimming gradient). The
   *  caller wraps it as a single CSS expression — `linear-gradient(...)`. */
  overlay,
}: {
  current: string | undefined;
  currentFocal?: string;
  fallback: string;
  alt: string;
  containerClassName?: string;
  editable?: boolean;
  overlay?: string;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();

  const onUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadCover(fd, pageId);
    if (!("error" in res)) router.refresh();
    return res;
  };

  const onRemove = async () => {
    const res = await removeCover(pageId);
    if (!("error" in res)) {
      router.refresh();
      return { ok: true } as const;
    }
    return res;
  };

  const onSetFocal = async (focal: string) => {
    return setCustomizationFocal("coverImageFocal", focal, pageId);
  };

  return (
    <EditableImage
      current={current}
      currentFocal={currentFocal}
      fallback={fallback}
      alt={alt}
      containerClassName={containerClassName}
      editable={editable}
      mode="background"
      backgroundOverlay={overlay}
      accentColor={ACCENT}
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}

export function EditableCinematicFullbleed({
  current,
  currentFocal,
  fallback,
  alt,
  className,
  containerClassName = "",
  editable = true,
}: {
  current: string | undefined;
  currentFocal?: string;
  fallback: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  editable?: boolean;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();

  const onUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadFullbleed(fd, pageId);
    if (!("error" in res)) router.refresh();
    return res;
  };

  const onRemove = async () => {
    const res = await removeFullbleed(pageId);
    if (!("error" in res)) {
      router.refresh();
      return { ok: true } as const;
    }
    return res;
  };

  const onSetFocal = async (focal: string) => {
    return setCustomizationFocal("cinematicFullbleedFocal", focal, pageId);
  };

  return (
    <EditableImage
      current={current}
      currentFocal={currentFocal}
      fallback={fallback}
      alt={alt}
      className={className}
      containerClassName={containerClassName}
      editable={editable}
      accentColor={ACCENT}
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}
