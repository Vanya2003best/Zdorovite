"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Scroll-preservation utilities for the editor preview canvas.
 *
 * The problem: every save in inline editors triggers a fresh RSC payload,
 * which re-runs the imperative section-reorder useEffect in EditorClient —
 * and that useEffect's insertBefore calls reset scroll-anchor tracking,
 * scrolling the canvas back to the top. Optimistic local-state reorders
 * (cases / services / packages) cause an additional anchor shift even before
 * the refresh, when React reconciles the moved DOM nodes.
 *
 * The only context where these utilities run is /studio/design — there is no
 * in-page editing on the public profile, so the scroller is always the
 * canvas <section overflow-y-auto> in EditorClient. We find it by walking up
 * from a [data-section-id] element.
 *
 * `pinScrollFor` snapshots the current scroll position and re-pins it for
 * `durationMs` via BOTH a rAF tick AND a 'scroll' event listener
 * (belt-and-suspenders — rAF catches mutation-driven shifts between frames,
 * 'scroll' catches synchronous programmatic writes). Call it BEFORE the
 * mutation. 1500-2000ms covers dev-mode RSC commit + the imperative reorder
 * useEffect that fires post-commit on slow rebuilds.
 *
 * `useRefreshKeepingScroll` is the common pattern: pin, then router.refresh.
 */
function findScrollContainer(start: Element | null): HTMLElement | null {
  let el: HTMLElement | null = start instanceof HTMLElement ? start : null;
  while (el) {
    const cs = window.getComputedStyle(el);
    if (
      (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function findCanvasScroller(): HTMLElement | null {
  // Preferred: EditorClient stamps the inner scroll div with this attribute.
  // Cheaper than the walk-up below and immune to template-internal scrollers
  // (e.g. an inner overflow-auto wrapper a template might add) being picked
  // up first. Falls back to the walk-up for safety.
  const stamped = document.querySelector<HTMLElement>("[data-canvas-scroller]");
  if (stamped) return stamped;
  const start: Element | null =
    document.querySelector("[data-section-id]") ||
    (document.activeElement instanceof HTMLElement ? document.activeElement : null) ||
    document.body;
  return findScrollContainer(start);
}

/**
 * Snapshot scrollTop now and re-pin it for `durationMs`. Call this immediately
 * before any state change that could shift the canvas (optimistic reorders,
 * router.refresh, etc.). No-op if no canvas scroller is found (e.g. a callsite
 * runs outside the editor preview — harmless).
 */
export function pinScrollFor(durationMs: number = 1500): void {
  const scroller = findCanvasScroller();
  if (!scroller) return;
  const target = scroller.scrollTop;
  const startTs = performance.now();

  const onScroll = () => {
    if (Math.abs(scroller.scrollTop - target) > 1) {
      scroller.scrollTop = target;
    }
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });

  const tick = () => {
    if (!scroller.isConnected) {
      scroller.removeEventListener("scroll", onScroll);
      return;
    }
    if (Math.abs(scroller.scrollTop - target) > 1) {
      scroller.scrollTop = target;
    }
    if (performance.now() - startTs < durationMs) {
      requestAnimationFrame(tick);
    } else {
      scroller.removeEventListener("scroll", onScroll);
    }
  };
  requestAnimationFrame(tick);
}

export function useRefreshKeepingScroll() {
  const router = useRouter();
  return useCallback(() => {
    pinScrollFor(1500);
    router.refresh();
  }, [router]);
}
