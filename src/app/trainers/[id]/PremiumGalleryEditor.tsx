"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGalleryPhoto } from "./gallery-actions";
import EditableGalleryItem from "./EditableGalleryItem";
import { useGalleryReorder } from "./use-gallery-reorder";
import { usePreviewTransition } from "./preview-busy";

/**
 * Premium gallery editor — 3-column 3:2 grid in editMode. Each tile is an
 * EditableGalleryItem; final "+" tile appends a new photo via
 * addGalleryPhoto.
 *
 * The public render in PremiumProfile applies a "+N zdjęć" badge on the last
 * visible tile when there are more photos than slots; that badge is dropped
 * in editMode (the trainer is already managing the full set here).
 */
export default function PremiumGalleryEditor({
  items,
  focalMap,
}: {
  items: { id: string; url: string }[];
  focalMap?: Record<string, string>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = usePreviewTransition();
  const [error, setError] = useState<string | null>(null);
  const reorder = useGalleryReorder(items);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await addGalleryPhoto(fd);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
    e.target.value = "";
  };

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {reorder.orderedItems.map((it) => (
          <div key={it.id} {...reorder.getDragProps(it.id)} className={reorder.dragClass(it.id)}>
            <EditableGalleryItem
              id={it.id}
              url={it.url}
              focal={focalMap?.[it.id]}
              accentColor="#10b981"
              containerClassName="group aspect-[3/2] rounded-2xl border border-white/60 shadow-sm"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="aspect-[3/2] rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:border-emerald-500 hover:bg-emerald-50 transition flex items-center justify-center text-emerald-600 disabled:opacity-60"
        >
          <span className="flex flex-col items-center gap-2 text-[12px] font-semibold">
            <span className="text-3xl leading-none">+</span>
            {pending ? "Wgrywam..." : "Dodaj zdjęcie"}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPickFile}
          className="sr-only"
        />
      </div>
    </div>
  );
}
