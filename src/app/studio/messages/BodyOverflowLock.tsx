"use client";

import { useEffect } from "react";

/**
 * Locks html/body overflow to `clip` for the lifetime of /studio/messages.
 * Without this, the body still gains a scrollbar even though the messages
 * wrapper is exactly 100dvh — browsers reserve space for the (unused)
 * scrollbar, which leaks ~14px on the right and looks broken next to the
 * three-pane chat layout. Same trick the calendar uses.
 */
export default function BodyOverflowLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "clip";
    body.style.overflow = "clip";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);
  return null;
}
