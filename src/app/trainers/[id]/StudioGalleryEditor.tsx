"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGalleryPhoto } from "./gallery-actions";
import EditableGalleryItem from "./EditableGalleryItem";
import { useGalleryReorder } from "./use-gallery-reorder";
import { usePreviewTransition } from "./preview-busy";

/**
 * Studio gallery editor — mirrors the read-only 4-column grid in editMode.
 * Each tile is an EditableGalleryItem (drag-pan focal + replace + delete);
 * a final "+" tile picks a file and appends a new photo via addGalleryPhoto.
 *
 * Studio's read render pads with stock fallbacks so a 3-photo trainer still
 * fills 8 slots visually. The editor intentionally does NOT pad — fallbacks
 * are pure decoration; trainers should only see and act on real rows.
 */
export default function StudioGalleryEditor({
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
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 @[640px]:grid-cols-3 @[1024px]:grid-cols-4 gap-4">
        {reorder.orderedItems.map((it) => (
          <div key={it.id} {...reorder.getDragProps(it.id)} className={reorder.dragClass(it.id)}>
            <EditableGalleryItem
              id={it.id}
              url={it.url}
              focal={focalMap?.[it.id]}
              accentColor="#ff5722"
              containerClassName="group rounded-2xl bg-[#e8e6df] aspect-[4/3]"
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="aspect-[4/3] rounded-2xl border-2 border-dashed border-[#ff5722]/30 bg-[#ffeadb]/40 hover:border-[#ff5722] hover:bg-[#ffeadb] transition flex items-center justify-center text-[#ff5722] disabled:opacity-60"
        >
          <span className="flex flex-col items-center gap-2 text-[12px] font-semibold tracking-[0.04em] uppercase">
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
