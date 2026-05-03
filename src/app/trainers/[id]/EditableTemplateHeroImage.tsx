"use client";

import { useRouter } from "next/navigation";
import EditableImage from "./EditableImage";
import { useEditingPageId } from "./EditingPageContext";
import {
  uploadTemplateImage,
  removeTemplateImage,
  type TemplateImageScope,
} from "@/app/studio/upload-actions";
import { updateLuxuryCopyField } from "./luxury-copy-actions";
import { updateSignatureCopyField } from "./signature-copy-actions";
import { updateCinematicCopyField } from "./cinematic-copy-actions";

/**
 * Per-template hero photo editor. Wraps the generic EditableImage and wires
 * it to the right copy bag (luxuryCopy / signatureCopy / cinematicCopy) plus
 * the right *-copy-actions updater for the focal point. Drop-in replacement
 * for a static hero <img>.
 *
 * Studio has its own EditableStudioImage with the same interface — it
 * predates the generic and supports more fields (about-collage). Once the
 * three template wrappers prove out, EditableStudioImage will be folded onto
 * EditableImage too.
 *
 * The hero photo is per-page-scoped and falls back to whatever the template
 * was already showing (trainer.avatar / trainer.gallery[0] / stock). View
 * mode is byte-identical to the previous static <img>.
 */

type Template = "luxury" | "signature" | "cinematic";

const SCOPE_BY_TEMPLATE: Record<Template, TemplateImageScope> = {
  luxury: "luxuryCopy",
  signature: "signatureCopy",
  cinematic: "cinematicCopy",
};

const ACCENT_BY_TEMPLATE: Record<Template, string> = {
  luxury: "#8a7346",
  signature: "#7d1f1f",
  cinematic: "#d4ff00",
};

export default function EditableTemplateHeroImage({
  template,
  current,
  currentFocal,
  fallback,
  alt,
  className,
  containerClassName,
  editable = true,
}: {
  template: Template;
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
  const scope = SCOPE_BY_TEMPLATE[template];
  const accent = ACCENT_BY_TEMPLATE[template];

  const onUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadTemplateImage(fd, scope, "heroPhoto", pageId);
    if ("ok" in res || "url" in res) {
      router.refresh();
    }
    return res;
  };

  const onRemove = async () => {
    const res = await removeTemplateImage(scope, "heroPhoto", pageId);
    if (!("error" in res)) {
      router.refresh();
      return { ok: true } as const;
    }
    return res;
  };

  const onSetFocal = async (focal: string) => {
    if (template === "luxury") return updateLuxuryCopyField("heroPhotoFocal", focal, pageId);
    if (template === "signature") return updateSignatureCopyField("heroPhotoFocal", focal, pageId);
    return updateCinematicCopyField("heroPhotoFocal", focal, pageId);
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
      accentColor={accent}
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}
