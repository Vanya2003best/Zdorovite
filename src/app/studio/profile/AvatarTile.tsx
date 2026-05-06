"use client";

import { useRouter } from "next/navigation";
import EditableImage from "@/app/trainers/[id]/EditableImage";
import { uploadAvatar, removeAvatar, setProfileAvatarFocal } from "../upload-actions";

/**
 * Avatar slot on /studio/profile — wraps the generic `EditableImage` with the
 * three avatar-specific server actions:
 *   - `uploadAvatar(FormData)` for the file picker (wraps File → FormData here)
 *   - `removeAvatar()` for the trash chip (UI hidden via compact + the absent
 *     handler-button on small avatars; the action exists for API parity)
 *   - `setProfileAvatarFocal(string)` for drag-to-pan
 *
 * Sized 16×16 (64px) to match the original page block. Drag works via
 * EditableImage's pointermove handler; the focal point persists to
 * `profiles.avatar_focal` (migration 020). On dev DBs without that column
 * the action returns ok anyway and the focal lasts until refresh — see
 * upload-actions.setProfileAvatarFocal for the 42703 swallow.
 */
type Size = "sm" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "w-16 h-16 rounded-2xl",
  lg: "w-[110px] h-[110px] rounded-full",
};

export default function AvatarTile({
  currentUrl,
  currentFocal,
  size = "sm",
}: {
  currentUrl: string | null;
  currentFocal: string | null;
  size?: Size;
}) {
  const router = useRouter();

  const onUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadAvatar(fd);
    if ("error" in res) return { error: res.error };
    // Refresh so the canonical URL flows back as `current` next render.
    router.refresh();
    return { url: res.url };
  };

  const onRemove = async () => {
    const res = await removeAvatar();
    if ("error" in res) return res;
    router.refresh();
    return { ok: true as const };
  };

  const onSetFocal = async (focal: string) => {
    return setProfileAvatarFocal(focal);
  };

  return (
    <EditableImage
      current={currentUrl ?? undefined}
      currentFocal={currentFocal ?? undefined}
      // Empty fallback URL renders the gradient placeholder via the on-error
      // path inside EditableImage — but we'd rather show our own initial-letter
      // tile when there's no upload. Pass a 1x1 transparent png so the <img>
      // mounts; the placeholder Card-level UX remains unchanged.
      fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      alt="Avatar"
      containerClassName={`${SIZE_CLASSES[size]} overflow-hidden border border-slate-200 shrink-0`}
      className="w-full h-full object-cover"
      compact
      helpText={null}
      onUpload={onUpload}
      onRemove={onRemove}
      onSetFocal={onSetFocal}
    />
  );
}
