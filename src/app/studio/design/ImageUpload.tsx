"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadAvatar,
  uploadCover,
  uploadFullbleed,
  uploadVideoIntro,
  removeCover,
  removeFullbleed,
  removeVideoIntro,
  type UploadResult,
} from "../upload-actions";
import { useEditingPageId } from "@/app/trainers/[id]/EditingPageContext";

type Variant = "avatar" | "cover" | "fullbleed" | "video-intro";

export default function ImageUpload({
  variant,
  currentUrl,
  trigger,
  className,
  removable = false,
}: {
  variant: Variant;
  currentUrl: string | null;
  trigger: React.ReactNode; // The visible button/UI users click
  className?: string;
  removable?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pageId = useEditingPageId();

  // Avatar is account-level (lives in profiles, not in customization), so it
  // ignores pageId. Cover/fullbleed/video are page-scoped when pageId is set.
  const action =
    variant === "avatar"
      ? (fd: FormData) => uploadAvatar(fd)
      : variant === "fullbleed"
        ? (fd: FormData) => uploadFullbleed(fd, pageId)
        : variant === "video-intro"
          ? (fd: FormData) => uploadVideoIntro(fd, pageId)
          : (fd: FormData) => uploadCover(fd, pageId);
  const removeAction =
    variant === "fullbleed"
      ? () => removeFullbleed(pageId)
      : variant === "video-intro"
        ? () => removeVideoIntro(pageId)
        : () => removeCover(pageId);
  const acceptAttr =
    variant === "video-intro"
      ? "video/mp4,video/webm,video/quicktime"
      : "image/jpeg,image/png,image/webp";

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res: UploadResult = await action(fd);
      if ("error" in res) {
        setError(res.error);
      } else {
        // Revalidation invalidates the server cache, but the editor canvas
        // (a client tree) needs router.refresh() to actually re-fetch and
        // re-render the new image.
        router.refresh();
      }
    });
    // Allow re-uploading the same file
    e.target.value = "";
  };

  const onRemove = () => {
    if (!removable) return;
    setError(null);
    startTransition(async () => {
      const res = await removeAction();
      if ("error" in res) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2 text-[12px]">
            <span className="w-3 h-3 rounded-full border-2 border-emerald-100 border-t-emerald-500 animate-spin" />
            Wgrywanie…
          </span>
        ) : trigger}
      </button>
      {removable && currentUrl && !pending && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-2 text-[11px] text-slate-500 hover:text-red-600 transition"
        >
          Usuń
        </button>
      )}
      {error && (
        <div className="absolute mt-1 text-[11px] text-red-600">{error}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={onPick}
        className="sr-only"
      />
    </div>
  );
}
