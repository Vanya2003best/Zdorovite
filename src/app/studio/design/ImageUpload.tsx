"use client";

import { useRef, useState, useTransition } from "react";
import { uploadAvatar, uploadCover, removeCover, type UploadResult } from "../upload-actions";

type Variant = "avatar" | "cover";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const action = variant === "avatar" ? uploadAvatar : uploadCover;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res: UploadResult = await action(fd);
      if ("error" in res) setError(res.error);
      // success → revalidate happens server-side, page re-renders with new url
    });
    // Allow re-uploading the same file
    e.target.value = "";
  };

  const onRemove = () => {
    if (!removable) return;
    setError(null);
    startTransition(async () => {
      const res = await removeCover();
      if ("error" in res) setError(res.error);
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
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="sr-only"
      />
    </div>
  );
}
