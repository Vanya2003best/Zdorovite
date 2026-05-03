"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ImageUpload from "@/app/studio/design/ImageUpload";

/**
 * Universal "Watch intro video" pill — used by every template except Cinematic
 * (which keeps its bespoke `VideoIntroCard` for the hero layout). Cinematic
 * was the original design reference; this is a smaller / more universal port
 * that drops into any template's hero / meta strip.
 *
 * Three states (mirrors VideoIntroCard):
 *   1. View, no video → button is hidden entirely (no point teasing
 *      something that doesn't exist).
 *   2. View, video URL set → click opens fullscreen lightbox with controls.
 *   3. Edit mode → button always rendered with an upload chip on hover so
 *      the trainer can attach / replace / remove the clip without leaving
 *      the editor canvas.
 *
 * Theme + accentColor let each template style the play icon background and
 * label tone to match its palette without duplicating the modal logic.
 */
export default function VideoIntroButton({
  videoUrl,
  editMode,
  theme = "light",
  accentColor,
  label = "Obejrzyj film o mnie",
  className = "",
}: {
  videoUrl: string | null;
  editMode: boolean;
  theme?: "light" | "dark";
  /** Background of the play icon. Defaults: dark theme = template accent
   *  via prop, light theme = #ff5722 (Studio orange) when not provided. */
  accentColor?: string;
  /** Button label. Pass the template's editable-copy component (e.g. <Stu />,
   *  <Lux />, <Sig />) so the trainer can rename "Obejrzyj film o mnie" → "Mój
   *  rozdział filmowy" / "Wideo z treningu" / etc. inline. String fallback
   *  works for non-editable callers. */
  label?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // View mode + no video → render nothing. We don't want a "Brak filmu"
  // placeholder cluttering the public profile.
  if (!editMode && !videoUrl) return null;

  const isDark = theme === "dark";
  const accent = accentColor ?? (isDark ? "#d4ff00" : "#ff5722");
  const isClickable = !editMode && !!videoUrl;

  // Build the pill. In dark mode (Cinematic-style hero overlay) the pill is
  // white/10 with backdrop blur. Light mode uses solid white with a subtle
  // border so it pops against gallery-grid / hero-portrait backdrops.
  const pillBaseClass = isDark
    ? "bg-white/10 border-white/15 text-white hover:bg-white/15"
    : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-[0_4px_16px_rgba(2,6,23,0.06)]";

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={isClickable ? () => setOpen(true) : undefined}
        disabled={!isClickable}
        className={`group/intro inline-flex items-center gap-3 h-12 pl-2 pr-5 rounded-full border transition ${pillBaseClass} ${isClickable ? "cursor-pointer hover:-translate-y-px" : "cursor-default"}`}
      >
        {/* Circle play icon — pulsing ring whenever there's a real video to
            click on, so the button reads as clearly interactive. */}
        <span
          className="relative w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0"
          style={{ background: accent, color: isDark ? "#0a0a0c" : "#ffffff" }}
        >
          {isClickable && (
            <span
              className="absolute inset-[-3px] rounded-full opacity-50 animate-ping"
              style={{ borderWidth: 1, borderStyle: "solid", borderColor: accent }}
            />
          )}
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-[13px] sm:text-[14px] font-medium tracking-tight">{label}</span>
      </button>

      {/* Edit-mode upload chip — sits to the right of the pill in editor
          preview. Clicking opens the file picker via ImageUpload's
          `variant="video-intro"` which routes to uploadVideoIntro. */}
      {editMode && (
        <span className="ml-2 inline-flex">
          <ImageUpload
            variant="video-intro"
            currentUrl={videoUrl}
            removable
            trigger={
              <span
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12px] font-medium transition ${
                  isDark
                    ? "bg-[#0a0a0c]/80 backdrop-blur-md border-white/15 text-white/90 hover:text-white hover:border-white/40"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                {videoUrl ? "Zmień" : "Wgraj wideo"}
              </span>
            }
          />
        </span>
      )}

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
