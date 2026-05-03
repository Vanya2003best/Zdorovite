"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ImageUpload from "@/app/studio/design/ImageUpload";

/**
 * Hero "play card" for the Cinematic template. Three states:
 *   1. View mode + no video uploaded → decorative card (matches the design mock,
 *      click is a no-op so we don't promise something that doesn't open).
 *   2. View mode + video URL set     → clicking the card opens a fullscreen
 *      lightbox with <video controls autoPlay> (Esc / backdrop click closes).
 *   3. Edit mode                      → card always rendered + upload pill in
 *      the corner so the trainer can attach / replace / remove the clip.
 *
 * Title and subtitle are passed as React.ReactNode by the parent so the parent
 * can stay in charge of the EditableCopy wiring; this component only owns the
 * play-card layout, the click-to-open behaviour, and the lightbox itself.
 */
export default function VideoIntroCard({
  videoUrl,
  editMode,
  title,
  subtitle,
}: {
  videoUrl: string | null;
  editMode: boolean;
  title: React.ReactNode;
  subtitle: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Esc to close — standard lightbox affordance.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Body scroll-lock while modal open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const isClickable = !editMode && !!videoUrl;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={isClickable ? () => setOpen(true) : undefined}
        disabled={!isClickable}
        className={`w-full text-left bg-white/[0.04] border border-white/15 rounded-[18px] p-5 backdrop-blur-md flex gap-3.5 items-center ${isClickable ? "hover:bg-white/[0.07] hover:border-[#d4ff00]/40 transition cursor-pointer" : "cursor-default"}`}
      >
        <div className="relative w-14 h-14 rounded-full bg-[#d4ff00] text-[#0a0a0c] inline-flex items-center justify-center shrink-0">
          {/* Pulsing ring only when there's actually a video to play. */}
          {isClickable && (
            <span className="absolute inset-[-4px] rounded-full border border-[#d4ff00]/40 animate-ping" />
          )}
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="min-w-0 text-left flex-grow">
          <div className="text-[14px] font-medium text-white">{title}</div>
          <div className="text-[12px] text-white/50 mt-0.5">{subtitle}</div>
        </div>
      </button>

      {/* Edit-mode upload pill — sits to the right of the play icon. Mirrors
          the hero cover-upload pill style so the editor surface is consistent. */}
      {editMode && (
        <div className="absolute top-2 right-2">
          <ImageUpload
            variant="video-intro"
            currentUrl={videoUrl}
            removable
            trigger={
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#0a0a0c]/80 backdrop-blur-md border border-white/15 text-white/90 hover:text-[#d4ff00] hover:border-[#d4ff00]/40 transition font-mono text-[10px] uppercase tracking-[0.12em]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                {videoUrl ? "Zmień wideo" : "Dodaj wideo"}
              </span>
            }
          />
        </div>
      )}

      {/* Lightbox — portalled to body so it escapes any parent transform/overflow. */}
      {open && videoUrl && typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[1100px] aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            >
              <video
                src={videoUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-black"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zamknij"
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 border border-white/20 text-white inline-flex items-center justify-center hover:bg-black hover:border-white/40 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
