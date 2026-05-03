"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGalleryPhoto } from "./gallery-actions";
import EditableGalleryItem from "./EditableGalleryItem";
import { useGalleryReorder } from "./use-gallery-reorder";
import { usePreviewTransition } from "./preview-busy";

/**
 * Edit-mode wrapper for the Cinematic reel grid. Renders the same bento
 * layout as the read-only ReelGrid but with:
 *   - per-tile EditableGalleryItem (drag-pan focal, replace, delete)
 *   - a final "+" tile that opens a file picker to append a new photo
 *
 * Photo-grid slots are repeated once we run past the canonical 9 — keeps
 * the bento rhythm stable as the trainer adds more.
 */
const SLOTS = [
  "col-span-12 sm:col-span-6 row-span-3",
  "col-span-6 sm:col-span-3 row-span-2",
  "col-span-6 sm:col-span-3 row-span-2",
  "col-span-6 sm:col-span-4 row-span-2",
  "col-span-6 sm:col-span-4 row-span-2",
  "col-span-12 sm:col-span-4 row-span-2",
  "col-span-6 sm:col-span-3 row-span-2",
  "col-span-6 sm:col-span-5 row-span-2",
  "col-span-12 sm:col-span-4 row-span-2",
];

export default function CinematicGalleryEditor({
  items,
  focalMap,
}: {
  items: { id: string; url: string }[];
  /** customization.galleryFocal — per-photo object-position keyed by gallery
   *  id. Passed through so each tile can paint its saved crop. */
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

  const slotFor = (i: number) => SLOTS[i % SLOTS.length];

  return (
    <div className="px-6 sm:px-12">
      {error && (
        <div className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}
      <div className="grid grid-cols-12 auto-rows-[140px] gap-3">
        {reorder.orderedItems.map((it, i) => (
          <div
            key={it.id}
            {...reorder.getDragProps(it.id)}
            className={`${slotFor(i)} ${reorder.dragClass(it.id)}`}
          >
            <EditableGalleryItem
              id={it.id}
              url={it.url}
              focal={focalMap?.[it.id]}
              alt=""
              accentColor="#d4ff00"
              containerClassName="group rounded-xl w-full h-full"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          </div>
        ))}

        {/* Upload tile — same slot rhythm as a regular photo. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className={`${slotFor(items.length)} relative rounded-xl border-2 border-dashed border-[#d4ff00]/30 bg-[#d4ff00]/[0.03] hover:border-[#d4ff00] hover:bg-[#d4ff00]/[0.08] transition flex items-center justify-center text-[#d4ff00]/80 hover:text-[#d4ff00] disabled:opacity-60`}
        >
          <span className="flex flex-col items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em]">
            <span className="text-3xl leading-none">+</span>
            {pending ? "Przesyłam..." : "Dodaj zdjęcie"}
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
