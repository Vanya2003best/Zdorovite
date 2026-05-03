"use client";

import { useTransition } from "react";

/**
 * Thin wrapper around `useTransition`. Originally this broadcasted a "preview
 * is busy" signal that EditorClient picked up to show a canvas-wide overlay
 * during inline-editor actions (add/delete/etc.). The overlay turned out to be
 * disruptive on every chip-level click, so it was removed — but the 28+ editor
 * files import this hook, so we keep it as a no-op alias rather than churning
 * those imports back to `useTransition` from React.
 */
export function usePreviewTransition(): [
  boolean,
  (cb: () => void | Promise<void>) => void,
] {
  return useTransition();
}
