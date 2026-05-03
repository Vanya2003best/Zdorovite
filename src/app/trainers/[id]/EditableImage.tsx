"use client";

import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Generic editable image slot — upload + replace + remove + drag-to-pan
 * focal point. Template-agnostic: callbacks own the persistence layer so
 * Studio / Luxury / Signature / Cinematic each wire their own actions
 * (different copy bags, different storage paths, different revalidation).
 *
 * Behaviour:
 *  - View mode (`editable=false`): plain <img> with the resolved URL +
 *    object-position from focal. Identical to a static asset.
 *  - Edit mode: click anywhere → file picker. Drag → reposition focal point;
 *    saves on pointer-up. Trash chip removes the trainer's upload (fallback
 *    URL re-appears below).
 *
 * Validation contract for uploaded files: JPG / PNG / WebP, ≤10 MB. Enforced
 * client-side here for instant feedback; the server action is the canonical
 * gate (this component only uploads via the supplied `onUpload`).
 *
 * Optimistic state lives entirely inside this component. The reconciler
 * useEffect snaps optimistic flags back to the canonical `current` whenever
 * it changes — same pattern as StudioCasePhotoUpload.
 *
 * Buttons sit top-LEFT (camera + trash). Studio's case-card cluster (↑/↓/🗑
 * for reorder/delete) sits top-right, so they don't overlap.
 */
type Props = {
  /** Saved photo URL, or undefined when nothing uploaded yet. */
  current: string | undefined;
  /** Saved focal point, e.g. "30% 45%". Defaults to "center". */
  currentFocal?: string;
  /** Fallback URL shown when no upload exists (trainer.avatar / gallery / stock). */
  fallback: string;
  /** Image alt text. */
  alt: string;
  /** Tailwind classes applied to the inner <img> in img mode (ignored in
   *  background mode — the wrapper itself paints the picture there). */
  className?: string;
  /** Tailwind classes applied to the outer wrapper (sizing/rounding). */
  containerClassName?: string;
  /** When false (public render), upload UI is suppressed. */
  editable?: boolean;
  /** Hex color used for the upload chip's hover state. Defaults to a neutral
   *  emerald — pass the template's accent so the chip feels native. */
  accentColor?: string;
  /** Helper text shown over the image while NOT dragging. Pass null to hide. */
  helpText?: string | null;
  /** "img" (default) renders an inner <img> with object-position. "background"
   *  paints the photo onto the wrapper itself via background-image and uses
   *  background-position for focal — needed for full-bleed hero sections that
   *  already layer overlays on the same element. */
  mode?: "img" | "background";
  /** Extra CSS to layer on top of the background image (e.g. a darkening
   *  gradient). Only meaningful in background mode. Concatenated BEFORE the
   *  url() so the gradient sits above the photo. */
  backgroundOverlay?: string;
  /** Compact controls — icon-only buttons + trash on the top-RIGHT. Use on
   *  small tiles (gallery slots ~200px) where the standard "Wgraj zdjęcie"
   *  chip would eat half the visible area and the default trash position
   *  (left-[160px]) would be clipped by overflow-hidden. */
  compact?: boolean;
  /** File picker handler. Returns the canonical URL on success — caller is
   *  responsible for triggering router.refresh() so the new URL flows back as
   *  the next `current` prop. Throw / return error string on failure. */
  onUpload: (file: File) => Promise<{ url: string } | { error: string }>;
  /** Remove the uploaded photo. Returns void on success or error string. */
  onRemove: () => Promise<{ ok: true } | { error: string }>;
  /** Persist the new focal point (object-position string). Fire-and-forget
   *  semantics: the optimistic value already paints; this just commits to DB. */
  onSetFocal: (focal: string) => Promise<{ ok: true } | { error: string }>;
};

export default function EditableImage({
  current,
  currentFocal,
  fallback,
  alt,
  className = "w-full h-full object-cover",
  containerClassName = "",
  editable = true,
  accentColor = "#10b981",
  helpText = "Przeciągnij, aby dopasować kadr",
  mode = "img",
  backgroundOverlay,
  compact = false,
  onUpload,
  onRemove,
  onSetFocal,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);
  const [optimisticDeleted, setOptimisticDeleted] = useState(false);
  const [optimisticFocal, setOptimisticFocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the current `displayed` URL failed to load. When true, we
  // swap to `fallback`. Reset whenever displayed changes so a fresh upload
  // gets a fair retry. Without this, deleting an old photo (whose storage file
  // is gone but URL is still cached on the prop) leaves the slot empty —
  // EditableImage would render src=brokenUrl and the browser shows nothing.
  const [imgError, setImgError] = useState(false);

  // `||` instead of `??` so empty-string `current` (which can sneak in from
  // pre-cleanup data) falls through to fallback. Empty string is truthy for
  // nullish-coalescing but renders as a broken image.
  const safeCurrent = current && current.length > 0 ? current : undefined;
  const primaryUrl = optimisticDeleted
    ? fallback
    : (optimisticUrl || safeCurrent || fallback);
  // If the primary URL failed to load, swap to the fallback. If fallback
  // itself fails, we surrender — the alt text still describes the slot.
  const displayed = imgError && primaryUrl !== fallback ? fallback : primaryUrl;
  const hasUploaded = optimisticDeleted ? false : (!!optimisticUrl || !!safeCurrent);
  const focal = optimisticFocal ?? currentFocal ?? "center";

  // Reconcile optimistic state with the canonical RSC `current` after refresh.
  // When a new server-rendered URL arrives, drop the local blob preview +
  // clear the deleted flag so subsequent uploads start fresh.
  const lastCurrentRef = useRef(current);
  useEffect(() => {
    if (lastCurrentRef.current === current) return;
    lastCurrentRef.current = current;
    setImgError(false); // give the new URL a fresh chance
    if (optimisticUrl) {
      try { URL.revokeObjectURL(optimisticUrl); } catch {}
      setOptimisticUrl(null);
    }
    if (optimisticDeleted && !current) setOptimisticDeleted(false);
  }, [current, optimisticUrl, optimisticDeleted]);

  const bgImageCss = (url: string): string => {
    const layers = backgroundOverlay ? `${backgroundOverlay}, url('${url}')` : `url('${url}')`;
    return layers;
  };

  // See positioning note below in the editable branch — same Tailwind cascade
  // hazard applies to the read-only render. Inline `position` only when the
  // caller didn't already specify one in containerClassName.
  const hasViewPositioningClass = /(?:^|\s)(absolute|fixed|sticky|relative)(?:\s|$)/.test(containerClassName);
  const viewPositionStyle: React.CSSProperties = hasViewPositioningClass ? {} : { position: "relative" };

  if (!editable) {
    if (mode === "background") {
      return (
        <div
          className={containerClassName}
          style={{
            ...viewPositionStyle,
            backgroundImage: bgImageCss(displayed),
            backgroundSize: "cover",
            backgroundPosition: focal,
          }}
          aria-label={alt}
          role="img"
        />
      );
    }
    return (
      <div className={`overflow-hidden ${containerClassName}`} style={viewPositionStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayed}
          alt={alt}
          className={className}
          style={{ objectPosition: focal }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Drag-to-pan focal point. We track the original mouse + focal coordinates
  // on pointer-down, then for each move event compute a delta in the
  // image-relative coordinate system. Saves on pointer-up; the optimistic
  // value stays painted across the brief async commit window so the image
  // doesn't snap back to a stale `currentFocal`.
  const dragStartRef = useRef<{
    mx: number; my: number; fx: number; fy: number; w: number; h: number;
  } | null>(null);

  const parseFocal = (s: string): [number, number] => {
    const m = s.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    return m ? [Number(m[1]), Number(m[2])] : [50, 50];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    onSetFocal(finalFocal).then((res) => {
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
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Tylko JPG, PNG lub WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Plik za duży (max 10 MB).");
      return;
    }
    setError(null);

    const localUrl = URL.createObjectURL(file);
    setOptimisticDeleted(false);
    setOptimisticUrl(localUrl);

    startTransition(async () => {
      const res = await onUpload(file);
      if ("error" in res) {
        setError(res.error);
        try { URL.revokeObjectURL(localUrl); } catch {}
        setOptimisticUrl(null);
        return;
      }
      // Caller is expected to router.refresh() so the canonical URL flows in
      // as the next `current`; the reconciler effect drops our blob.
    });
  };

  const onRemoveClick = () => {
    if (!hasUploaded) return;
    setOptimisticDeleted(true);
    if (optimisticUrl) {
      try { URL.revokeObjectURL(optimisticUrl); } catch {}
      setOptimisticUrl(null);
    }
    startTransition(async () => {
      const res = await onRemove();
      if ("error" in res) {
        setError(res.error);
        setOptimisticDeleted(false);
        return;
      }
      setError(null);
    });
  };

  const isDragging = dragStartRef.current !== null;
  // Tailwind v4 generates `.absolute` BEFORE `.relative` in source order, so
  // when both classes appear on the same element `.relative` wins (later in
  // CSS). That breaks callers like `containerClassName="absolute inset-0"`
  // (Signature/Cinematic/Premium hero) — the wrapper would silently fall back
  // to position: relative with zero size, hiding the photo. Inline style with
  // priority based on what the caller passed sidesteps the cascade fight:
  //   - if containerClassName includes a non-static positioning utility, let
  //     it apply via the class — inline style stays unset
  //   - otherwise force `position: relative` inline so the absolute children
  //     (upload chip, trash, drag handlers) anchor here.
  const hasPositioningClass = /(?:^|\s)(absolute|fixed|sticky|relative)(?:\s|$)/.test(containerClassName);
  const positionStyle: React.CSSProperties = hasPositioningClass ? {} : { position: "relative" };

  return (
    <div
      className={`overflow-hidden touch-none select-none ${containerClassName} ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={
        mode === "background"
          ? {
              ...positionStyle,
              backgroundImage: bgImageCss(displayed),
              backgroundSize: "cover",
              backgroundPosition: focal,
            }
          : positionStyle
      }
      aria-label={mode === "background" ? alt : undefined}
      role={mode === "background" ? "img" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {mode === "img" && displayed && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={displayed}
          alt={alt}
          draggable={false}
          className={`${className} pointer-events-none`}
          style={{ objectPosition: focal }}
          onError={() => setImgError(true)}
        />
      )}

      {!isDragging && helpText && !compact && (
        <span className="absolute bottom-3 left-3 z-[6] pointer-events-none px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-medium">
          {helpText}
        </span>
      )}

      <button
        type="button"
        data-photo-control
        onClick={onPick}
        disabled={pending}
        title={hasUploaded ? "Zmień zdjęcie" : "Wgraj zdjęcie"}
        style={{ ["--accent" as string]: accentColor }}
        className={
          compact
            ? "absolute top-2 left-2 z-20 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[#141413] hover:bg-[var(--accent)] hover:text-white transition disabled:opacity-60"
            : "absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[12.5px] font-medium text-[#141413] hover:bg-[var(--accent)] hover:text-white transition disabled:opacity-60"
        }
      >
        <svg width={compact ? 13 : 14} height={compact ? 13 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        {!compact && (pending ? "Wgrywam..." : hasUploaded ? "Zmień zdjęcie" : "Wgraj zdjęcie")}
      </button>

      {hasUploaded && (
        <button
          type="button"
          data-photo-control
          onClick={onRemoveClick}
          disabled={pending}
          title="Usuń zdjęcie"
          className={
            compact
              ? "absolute top-2 right-2 z-20 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[#141413] hover:bg-red-600 hover:text-white transition disabled:opacity-60"
              : "absolute top-3 left-[160px] z-20 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[#141413] hover:bg-red-600 hover:text-white transition disabled:opacity-60"
          }
        >
          <svg width={compact ? 13 : 14} height={compact ? 13 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          </svg>
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
        className="sr-only"
        onChange={onFile}
      />
    </div>
  );
}
