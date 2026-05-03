"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGalleryPhoto } from "./gallery-actions";
import EditableGalleryItem from "./EditableGalleryItem";
import { useGalleryReorder } from "./use-gallery-reorder";
import { usePreviewTransition } from "./preview-busy";

/**
 * Luxury gallery editor — mirrors the read-only asymmetric 6-grid in editMode.
 * Uses EditableGalleryItem per tile (drag-pan + replace + delete) plus a "+"
 * tile that appends a new photo via addGalleryPhoto.
 *
 * Slot definitions match LuxuryProfile.GAL_SLOTS exactly so the editor and
 * read render look identical. Trainers with fewer than 6 real photos get
 * fewer occupied slots — the editor doesn't pad with stock fallbacks.
 */
const GAL_SLOTS = [
  "@[1024px]:col-span-3 @[1024px]:row-span-2 col-span-2 row-span-2",
  // Mobile slot 2 mirrors LuxuryProfile public render: 2×2 (was 2×1, looked
  // like a missing photo / flat slab on small screens).
  "@[1024px]:col-span-3 @[1024px]:row-span-1 col-span-2 row-span-2",
  "@[1024px]:col-span-3 @[1024px]:row-span-1 col-span-1 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-1 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-2 row-span-1",
  "@[1024px]:col-span-2 @[1024px]:row-span-1 col-span-2 row-span-1",
];

export default function LuxuryGalleryEditor({
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

  const slotFor = (i: number) => GAL_SLOTS[i] ?? GAL_SLOTS[GAL_SLOTS.length - 1];

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-[#d9cfb8] bg-[#fbf8f1] px-4 py-2 text-[13px] text-[#7a7365]">
          {error}
        </div>
      )}
      <div
        className="max-w-[1200px] mx-auto grid grid-cols-2 @[1024px]:grid-cols-6 gap-1"
        style={{ gridAutoRows: "minmax(120px, auto)" }}
      >
        {reorder.orderedItems.slice(0, 6).map((it, i) => (
          <div
            key={it.id}
            {...reorder.getDragProps(it.id)}
            className={`${slotFor(i)} ${reorder.dragClass(it.id)}`}
          >
            <EditableGalleryItem
              id={it.id}
              url={it.url}
              focal={focalMap?.[it.id]}
              accentColor="#8a7346"
              containerClassName="group bg-[#efe7d7] w-full h-full"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04] [filter:saturate(0.9)]"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className={`${slotFor(items.length)} relative border-2 border-dashed border-[#8a7346]/30 bg-[#fbf8f1] hover:border-[#8a7346] hover:bg-[#efe7d7] transition flex items-center justify-center text-[#8a7346] disabled:opacity-60`}
        >
          <span className="flex flex-col items-center gap-2 text-[11px] tracking-[0.18em] uppercase">
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
