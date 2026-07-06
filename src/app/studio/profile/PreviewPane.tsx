"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live preview of the trainer's public profile — a scaled-down iframe
 * onto /trainers/[slug]?embed=1 (the middleware strips site chrome via
 * the x-embed header, same mechanism as /studio/profile/preview).
 *
 * The page is rendered at the desktop design width (1200px) and scaled
 * with a CSS transform to fit the pane, so the trainer sees the real
 * template — not a squeezed mobile fallback.
 *
 * Refresh: every save in the left column runs a server action that
 * calls revalidatePath + router.refresh(), which re-renders the page's
 * Server Components. page.tsx derives `stamp` from all preview-relevant
 * data, so when the prop changes the iframe reloads (debounced) — no
 * full page reload, no wiring inside the individual forms.
 *
 * sandbox="allow-same-origin" keeps auth-aware rendering (the owner
 * sees their draft) while blocking scripts/navigation — the preview is
 * naturally read-only, but still scrollable.
 */
const DESIGN_WIDTH = 1200;

export default function PreviewPane({ src, stamp }: { src: string; stamp: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const isFirstStamp = useRef(true);

  // Measure the pane (ResizeObserver also fires when the pane becomes
  // visible on mobile after the Podgląd tab is selected).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const reload = useCallback(() => {
    setRefreshing(true);
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        // Same-origin reload keeps the scroll position of the preview.
        win.location.reload();
        return;
      }
    } catch {
      // Sandbox/origin edge case — fall through to a hard remount.
    }
    setFrameKey((k) => k + 1);
  }, []);

  // Debounced reload when the server data stamp changes (a save landed).
  useEffect(() => {
    if (isFirstStamp.current) {
      isFirstStamp.current = false;
      return;
    }
    const t = setTimeout(reload, 350);
    return () => clearTimeout(t);
  }, [stamp, reload]);

  const scale = size ? Math.min(size.w / DESIGN_WIDTH, 1) : 0.5;
  const frameHeight = size ? Math.ceil(size.h / scale) : 800;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-200 bg-slate-50/70 shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[12.5px] font-semibold text-slate-700">Podgląd na żywo</span>
        <span className="text-[12px] text-slate-500 truncate hidden sm:inline">
          · tak klienci widzą Twój profil
        </span>
        <button
          type="button"
          onClick={reload}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 transition"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={refreshing ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 11-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          {refreshing ? "Odświeżam…" : "Odśwież"}
        </button>
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0 bg-slate-100">
        {size && (
          <iframe
            key={frameKey}
            ref={iframeRef}
            src={src}
            title="Podgląd publicznego profilu"
            sandbox="allow-same-origin"
            onLoad={() => setRefreshing(false)}
            style={{
              width: DESIGN_WIDTH,
              height: frameHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="absolute top-0 left-0 border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}
