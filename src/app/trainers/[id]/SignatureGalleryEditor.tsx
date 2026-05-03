"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGalleryPhoto } from "./gallery-actions";
import EditableGalleryItem from "./EditableGalleryItem";
import { useGalleryReorder } from "./use-gallery-reorder";
import { usePreviewTransition } from "./preview-busy";

/**
 * Signature gallery editor — mirrors the read-only 6-photo bento in editMode.
 * Slot definitions match SignatureProfile's inline `slots` array exactly.
 * Each tile is an EditableGalleryItem; final "+" tile appends a new photo.
 */
const SLOTS = [
  "col-span-2 row-span-2 @[640px]:col-span-2 @[640px]:row-span-2",
  // Slot 2 used to be 1×1 (small flat tile) which read as a placeholder vs
  // its tall 1×2 neighbour. Matching it to slot 3's height keeps the row
  // visually balanced.
  "col-span-1 row-span-2",
  "col-span-1 row-span-2",
  "col-span-2 row-span-1",
  "col-span-2 row-span-2",
  "col-span-2 row-span-1",
];

export default function SignatureGalleryEditor({
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

  const slotFor = (i: number) => SLOTS[i] ?? SLOTS[SLOTS.length - 1];

  return (
    <div>
      {error && (
        <div className="max-w-[1340px] mx-auto mb-4 rounded-sm border border-[#cfc3b0] bg-white px-4 py-2 text-[13px] text-[#7d1f1f]">
          {error}
        </div>
      )}
      <div
        className="max-w-[1340px] mx-auto grid grid-cols-2 @[640px]:grid-cols-4 gap-3"
        style={{ gridAutoRows: "120px" }}
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
              accentColor="#7d1f1f"
              containerClassName="group rounded-sm w-full h-full"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className={`${slotFor(items.length)} relative rounded-sm border-2 border-dashed border-[#7d1f1f]/30 bg-[#f6f1ea] hover:border-[#7d1f1f] hover:bg-[#ede4d6] transition flex items-center justify-center text-[#7d1f1f] disabled:opacity-60`}
        >
          <span className="flex flex-col items-center gap-2 text-[11px] tracking-[0.18em] uppercase font-medium">
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
