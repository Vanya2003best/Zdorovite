"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Generic per-item AI popover. Used across every editor (services / packages
 * / cases) to give the trainer a small "rewrite this one item" flow without
 * needing per-template inline UI in every editor file.
 *
 * The card editor renders a ✨ button that flips `open` to true and supplies:
 *   - the current item's values (so the trainer sees what they're replacing),
 *   - `onGenerate(prompt)` — server action returning 3 variants,
 *   - `onApply(variant)` — server action committing the chosen variant.
 *
 * On apply the popover calls `router.refresh()` so the canvas re-renders with
 * the new copy. Positions itself with `absolute` above its nearest
 * `position: relative` ancestor (the card) and dismisses on Esc only — outside
 * clicks were too eager and closed the panel when the trainer touched any
 * editor chrome (Pełny widok, template cards, etc.) mid-edit.
 */

type Variant = Record<string, unknown>;

type Props<V extends Variant> = {
  open: boolean;
  onClose: () => void;
  /** Used in the prompt placeholder + heading. e.g. "usługę" / "pakiet" / "kejs". */
  itemLabel: string;
  /** Display the current item's headline text in the popover so the trainer
   *  sees what they're rewriting. */
  currentTitle: string;
  /** Server action: takes a free-text prompt, returns 3 variants. */
  onGenerate: (prompt: string) => Promise<{ variants: V[] } | { error: string }>;
  /** Server action: commits the chosen variant. */
  onApply: (variant: V) => Promise<{ ok: true } | { error: string }>;
  /** Renders one variant's preview (the parent knows the variant's shape and
   *  controls how to display it — e.g. service variant shows name + desc +
   *  duration; package variant shows name + items list; case variant shows
   *  tag/title/body/stats). */
  renderVariantPreview: (variant: V) => React.ReactNode;
};

export default function PerItemAIPopover<V extends Variant>({
  open,
  onClose,
  itemLabel,
  currentTitle,
  onGenerate,
  onApply,
  renderVariantPreview,
}: Props<V>) {
  type Phase = "prompting" | "loading" | "preview";
  const [phase, setPhase] = useState<Phase>("prompting");
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<V[]>([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const popRef = useRef<HTMLDivElement>(null);

  // Reset phase on open. Each open of the popover starts a fresh flow — the
  // previous flow's variants/prompt would otherwise stick around.
  useEffect(() => {
    if (!open) return;
    setPhase("prompting");
    setPrompt("");
    setVariants([]);
    setIdx(0);
    setError(null);
  }, [open]);

  // Esc to dismiss. We DON'T listen for outside clicks — the panel sits in
  // the page flow above its card, and any click on editor chrome (Pełny
  // widok, template card, sidebar toggle, etc.) used to dismiss the panel
  // mid-edit, which felt jumpy. Now the trainer closes explicitly via the
  // ✕ button, the Anuluj button, or Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const runGenerate = () => {
    setError(null);
    setPhase("loading");
    startTransition(async () => {
      const res = await onGenerate(prompt);
      if ("error" in res) {
        setError(res.error);
        setPhase("prompting");
        return;
      }
      setVariants(res.variants);
      setIdx(0);
      setPhase("preview");
    });
  };

  const runApply = () => {
    const variant = variants[idx];
    if (!variant) return;
    setError(null);
    startTransition(async () => {
      const res = await onApply(variant);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    // Inline panel — sits ABOVE the card it was opened from, full-width of
    // the card, in the page flow (not a floating popover). Anchored to the
    // nearest `position: relative` ancestor (every editor card already has
    // it for the hover toolbar). Same visual language as the section-level
    // AI panels: white card, violet outline, soft shadow.
    <div
      ref={popRef}
      className="absolute left-0 right-0 bottom-full mb-3 z-30 bg-white rounded-2xl border border-violet-200 shadow-[0_12px_32px_rgba(76,29,149,0.14)] p-5 grid gap-3"
      role="dialog"
      aria-label="AI rewrite"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700">
          ✨ AI · przepisz {itemLabel}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-slate-500 hover:text-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="text-[12.5px] text-slate-600 -mt-1 line-clamp-1">
        Obecnie: <span className="font-medium text-slate-900">{currentTitle || "(brak)"}</span>
      </div>

      {phase === "prompting" && (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Co zmienić? (opcjonalnie) — np. „skróć opis", „dodaj akcent na sportowców"`}
            rows={3}
            className="w-full text-[13px] p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 resize-vertical"
          />
          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runGenerate}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition"
            >
              Wygeneruj 3 warianty
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition"
            >
              Anuluj
            </button>
          </div>
        </>
      )}

      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-slate-500">
          <div className="w-7 h-7 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-violet-700">
            AI generuje 3 warianty...
          </div>
        </div>
      )}

      {phase === "preview" && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {variants.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  idx === i
                    ? "bg-violet-600 text-white"
                    : "bg-white border border-violet-200 text-violet-700 hover:border-violet-400"
                }`}
              >
                Wariant {i + 1}
              </button>
            ))}
          </div>
          <div className="bg-violet-50/40 border border-violet-100 rounded-lg p-3 max-h-[280px] overflow-auto">
            {variants[idx] ? renderVariantPreview(variants[idx]!) : null}
          </div>
          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runApply}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition"
            >
              Zastąp tym wariantem
            </button>
            <button
              type="button"
              onClick={() => setPhase("prompting")}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition"
            >
              Inny prompt
            </button>
          </div>
        </>
      )}
    </div>
  );
}
