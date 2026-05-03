"use client";

import { useCallback, useState } from "react";

/**
 * State + handlers for an image lightbox bound to a gallery array. Returns
 * imperative `open(idx)`, `close`, `prev`, `next` plus the current `activeIdx`
 * (null when closed). Designed to be plumbed into the controlled
 * `<Lightbox>` modal component.
 */
export function useLightbox(galleryLength: number) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const open = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= galleryLength) return;
      setActiveIdx(idx);
    },
    [galleryLength],
  );
  const close = useCallback(() => setActiveIdx(null), []);
  const next = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i + 1) % galleryLength)),
    [galleryLength],
  );
  const prev = useCallback(
    () => setActiveIdx((i) => (i === null ? null : (i - 1 + galleryLength) % galleryLength)),
    [galleryLength],
  );

  return { activeIdx, open, close, prev, next };
}
