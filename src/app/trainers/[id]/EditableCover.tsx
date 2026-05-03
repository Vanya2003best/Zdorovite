"use client";

import { useRouter } from "next/navigation";
import EditableImage from "./EditableImage";
import { useEditingPageId } from "./EditingPageContext";
import {
  uploadCover,
  removeCover,
  setCustomizationFocal,
} from "@/app/studio/upload-actions";

/**
 * Generic cover-image editor backed by customization.coverImage at the root
 * of the customization JSONB. Used by templates that surface the cover in a
 * straightforward <img> slot (Premium / Template) — Cinematic has its own
 * `EditableCinematicHero` that uses background mode for the same field.
 *
 * Focal point lives in customization.coverImageFocal, written via the
 * allowlisted setCustomizationFocal helper. Per-page-scoped (pageId pulled
 * from EditingPageContext).
 */
export default function EditableCover({
  current,
  currentFocal,
  fallback,
  alt,
  className,
  containerClassName = "",
  editable = true,
  accentColor = "#10b981",
}: {
  current: string | undefined;
  currentFocal?: string;
  fallback: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  editable?: boolean;
  accentColor?: string;
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
      className={className}
      containerClassName={containerClassName}
      editable={editable}
      accentColor={accentColor}
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}
