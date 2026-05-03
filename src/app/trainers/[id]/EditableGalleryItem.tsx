"use client";

import { useRouter } from "next/navigation";
import EditableImage from "./EditableImage";
import { useEditingPageId } from "./EditingPageContext";
import {
  replaceGalleryPhoto,
  hideGalleryPhotoOnPage,
  setGalleryFocal,
} from "./gallery-actions";

/**
 * Single gallery photo tile in editMode. Wraps EditableImage with the gallery
 * actions:
 *   - upload → replaces the existing file under this gallery_photos row
 *   - remove → soft-hides on the current page via customization.galleryHidden;
 *              the underlying gallery_photos row + storage file stay so undo
 *              (which restores customization snapshots) can bring it back.
 *              Permanent deletion lives at /studio/profile/gallery.
 *   - focal  → writes per-page object-position into customization.galleryFocal
 *
 * Layout-agnostic: the parent grid controls aspect/span via containerClassName.
 * In view mode the upload UI is suppressed and the tile renders as a plain
 * <img> with the saved focal point.
 *
 * Per-page focal/hide is intentional — the same gallery photo can be cropped
 * differently or hidden on a B2B vs B2C page without re-uploading.
 */
export default function EditableGalleryItem({
  id,
  url,
  focal,
  alt,
  className,
  containerClassName = "",
  editable = true,
  accentColor = "#10b981",
}: {
  id: string;
  url: string;
  focal?: string;
  alt?: string;
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
    const res = await replaceGalleryPhoto(id, fd);
    if (!("error" in res)) router.refresh();
    return res;
  };

  const onRemove = async () => {
    const res = await hideGalleryPhotoOnPage(id, pageId);
    if (!("error" in res)) {
      router.refresh();
      return { ok: true } as const;
    }
    return res;
  };

  const onSetFocal = async (next: string) => {
    return setGalleryFocal(id, next, pageId);
  };

  return (
    <EditableImage
      current={url}
      currentFocal={focal}
      fallback={url}
      alt={alt ?? ""}
      className={className}
      containerClassName={containerClassName}
      editable={editable}
      accentColor={accentColor}
      compact
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}
