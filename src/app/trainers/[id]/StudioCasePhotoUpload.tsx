"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadStudioCasePhoto,
  removeStudioCasePhoto,
} from "@/app/studio/upload-actions";
import { updateStudioCaseField } from "./studio-copy-actions";
import { useEditingPageId } from "./EditingPageContext";
import { usePreviewTransition } from "./preview-busy";

/**
 * Editable photo zone for a single Studio case study.
 *
 * View: shows the case's photo (uploaded URL or fallback). Hover reveals an
 * overlay with "Zmień zdjęcie" / "Usuń". Click anywhere triggers a hidden
 * file input. Optimistic preview via createObjectURL while the server upload
 * is in flight; revoked + replaced with the real URL on success, restored to
 * fallback on failure.
 *
 * Same image-validation contract as cover/fullbleed (JPG/PNG/WebP, ≤10 MB)
 * — server enforces it again, but we surface the error inline before
 * sending bytes.
 */
export default function StudioCasePhotoUpload({
  caseId,
  current,
  currentFocal,
  hidden = false,
  fallback,
  alt,
}: {
  caseId: string;
  current: string | undefined;
  /** Saved object-position for the photo (e.g. "30% 45%"). Default "center". */
  currentFocal: string | undefined;
  /** Persisted "no photo" flag — set by removing, cleared by uploading. */
  hidden?: boolean;
  fallback: string;
  alt: string;
}) {
  const router = useRouter();
  const pageId = useEditingPageId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = usePreviewTransition();
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);
  const [optimisticDeleted, setOptimisticDeleted] = useState(false);
  const [optimisticFocal, setOptimisticFocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // displayed precedence:
  //   optimisticDeleted (just clicked 🗑) → fallback (instant feedback)
  //   optimisticUrl (just picked file)    → blob preview while server uploads
  //   current (server-saved URL)          → real value from RSC
  //   fallback (gallery / stock)          → last resort
  const displayed = optimisticDeleted
    ? fallback
    : (optimisticUrl ?? current ?? fallback);
  const hasUploaded = optimisticDeleted ? false : (!!optimisticUrl || !!current);
  const focal = optimisticFocal ?? currentFocal ?? "center";
  // Hidden flag kept in the type for backward-compat with already-saved
  // customizations but no longer affects display. See EditableStudioImage.
  void hidden;

  // Reconcile optimistic state with the freshly-arrived `current` prop after
  // router.refresh. When the saved URL changes (or is cleared), drop the
  // optimistic overlays so subsequent renders use the canonical RSC value.
  // Also revokes any leftover blob URL to avoid leaks. Without this the
  // component would happily render a stale blob forever after upload.
  const lastCurrentRef = useRef(current);
  useEffect(() => {
    if (lastCurrentRef.current === current) return;
    lastCurrentRef.current = current;
    if (optimisticUrl) {
      try { URL.revokeObjectURL(optimisticUrl); } catch {}
      setOptimisticUrl(null);
    }
    if (optimisticDeleted && !current) setOptimisticDeleted(false);
  }, [current, optimisticUrl, optimisticDeleted]);

  // Drag-to-pan focal-point picker (like social-media profile-pic adjusters).
  // Pointer-down inside the image area starts a drag; pointer-move updates
  // object-position smoothly; pointer-up commits the final value to the server.
  // Works for mouse, touch, pen via Pointer Events. Uses a ref-based start
  // snapshot so we don't recompute baseline on every move.
  const dragStartRef = useRef<{ mx: number; my: number; fx: number; fy: number; w: number; h: number } | null>(null);

  const parseFocal = (s: string): [number, number] => {
    const m = s.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    return m ? [Number(m[1]), Number(m[2])] : [50, 50];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start drag if the user clicked on a control overlay (chip).
    const t = e.target as HTMLElement;
    if (t.closest("[data-photo-control]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const [fx, fy] = parseFocal(optimisticFocal ?? currentFocal ?? "50% 50%");
    dragStartRef.current = { mx: e.clientX, my: e.clientY, fx, fy, w: rect.width, h: rect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStartRef.current;
    if (!s) return;
    const dx = e.clientX - s.mx;
    const dy = e.clientY - s.my;
    // Drag right → show more of left side → object-position x decreases.
    const nx = Math.min(100, Math.max(0, s.fx - (dx / s.w) * 100));
    const ny = Math.min(100, Math.max(0, s.fy - (dy / s.h) * 100));
    setOptimisticFocal(`${nx.toFixed(1)}% ${ny.toFixed(1)}%`);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStartRef.current;
    if (!s) return;
    dragStartRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (!optimisticFocal) return;
    const finalFocal = optimisticFocal;
    // Fire-and-forget save; we deliberately do NOT clear optimisticFocal here
    // and do NOT call router.refresh. Either of those briefly shows the stale
    // currentFocal between "optimistic cleared" and "RSC refetch arrives" —
    // the image visibly snaps back to its old crop, then to the new one.
    // Keeping the optimistic value in place keeps the display stable; on the
    // next mount/visit the saved currentFocal will load and equal it.
    updateStudioCaseField(caseId, "photoFocal", finalFocal, pageId).then((res) => {
      if ("error" in res) {
        setError(res.error);
        setOptimisticFocal(null);
      }
    });
  };

  const onPick = () => {
    inputRef.current?.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be picked twice
    if (!file) return;

    // Quick client-side check; server re-validates.
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Tylko JPG, PNG lub WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Plik za duży (max 10 MB).");
      return;
    }
    setError(null);

    // Optimistic preview while upload is in flight. The blob URL stays as
    // the displayed value until the useEffect reconciler swaps it for the
    // real server URL — no mid-flight clear, no flash.
    const localUrl = URL.createObjectURL(file);
    setOptimisticDeleted(false);
    setOptimisticUrl(localUrl);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadStudioCasePhoto(fd, caseId, pageId);
      if ("error" in res) {
        setError(res.error);
        try { URL.revokeObjectURL(localUrl); } catch {}
        setOptimisticUrl(null);
        return;
      }
      // Trigger RSC refetch to pull the canonical URL into `current`.
      // The useEffect above will then revoke our local blob.
      router.refresh();
    });
  };

  const onRemove = () => {
    if (!hasUploaded) return;
    setOptimisticDeleted(true);
    if (optimisticUrl) {
      try { URL.revokeObjectURL(optimisticUrl); } catch {}
      setOptimisticUrl(null);
    }
    startTransition(async () => {
      const res = await removeStudioCasePhoto(caseId, pageId);
      if ("error" in res) {
        setError(res.error);
        setOptimisticDeleted(false);
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  const isDragging = dragStartRef.current !== null;

  return (
    <div
      className={`group/photo aspect-[4/3] rounded-2xl overflow-hidden bg-[#e8e6df] relative touch-none select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displayed}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: focal }}
      />
      {!isDragging && (
        <span className="absolute bottom-3 left-3 z-[6] pointer-events-none px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-medium">
          Przeciągnij, aby dopasować kadr
        </span>
      )}

      {/* Camera chip IS a real button (z-20) so clicks here pick a file
          instead of starting a drag. Top-LEFT to leave the case-card's
          top-right controls (↑/↓/🗑) untouched. */}
      <button
        type="button"
        data-photo-control
        onClick={onPick}
        disabled={pending}
        title={hasUploaded ? "Zmień zdjęcie" : "Wgraj zdjęcie"}
        className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[12.5px] font-medium text-[#141413] hover:bg-[#ff5722] hover:text-white transition disabled:opacity-60"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        {pending ? "Wgrywam..." : hasUploaded ? "Zmień zdjęcie" : "Wgraj zdjęcie"}
      </button>

      {hasUploaded && (
        <button
          type="button"
          data-photo-control
          onClick={onRemove}
          disabled={pending}
          title="Usuń zdjęcie"
          className="absolute top-3 right-3 z-20 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[#141413] opacity-0 group-hover/photo:opacity-100 focus-visible:opacity-100 hover:bg-red-600 hover:text-white transition disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
        </button>
      )}

      {error && (
        <div className="absolute bottom-2 left-2 right-2 z-30 px-3 py-1.5 rounded-md bg-red-600 text-white text-[11px] font-medium pointer-events-none">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        // sr-only (NOT `hidden`) so programmatic `.click()` works reliably
        // across browsers — display:none can suppress the file picker dialog
        // in some Chromium quirks.
        className="sr-only"
        onChange={onFile}
      />
    </div>
  );
}
