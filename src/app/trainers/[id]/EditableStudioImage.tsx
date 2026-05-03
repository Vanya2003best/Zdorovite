"use client";

import { useRouter } from "next/navigation";
import EditableImage from "./EditableImage";
import {
  uploadStudioImage,
  removeStudioImage,
} from "@/app/studio/upload-actions";
import { updateStudioCopyField } from "./studio-copy-actions";
import { useEditingPageId } from "./EditingPageContext";

/**
 * Editable image zone for any string-URL field inside customization.studioCopy
 * (currently `heroPhoto` and `aboutCollagePhoto`). Thin wrapper around the
 * generic EditableImage primitive — wires Studio's actions for upload /
 * remove / focal-point persistence and supplies the orange accent.
 */
type StudioImageField = "heroPhoto" | "aboutCollagePhoto";

export default function EditableStudioImage({
  field,
  current,
  currentFocal,
  hidden = false,
  fallback,
  alt,
  className,
  containerClassName = "",
  editable = true,
}: {
  field: StudioImageField;
  current: string | undefined;
  currentFocal?: string;
  /** Persisted "intentionally empty" flag from earlier UX. Kept in props for
   *  backward compatibility but not consulted — fallback always shows when no
   *  upload exists. */
  hidden?: boolean;
  fallback: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  editable?: boolean;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();
  void hidden;

  const onUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadStudioImage(fd, field, pageId);
    if (!("error" in res)) router.refresh();
    return res;
  };

  const onRemove = async () => {
    const res = await removeStudioImage(field, pageId);
    if (!("error" in res)) {
      router.refresh();
      return { ok: true } as const;
    }
    return res;
  };

  const onSetFocal = async (focal: string) => {
    const focalField = `${field}Focal` as const;
    return updateStudioCopyField(focalField, focal, pageId);
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
      accentColor="#ff5722"
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}
