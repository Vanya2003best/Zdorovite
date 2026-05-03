"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Variant = { text: string; h2: string; sub: string };

type GenerateFn = (
  prompt: string,
) => Promise<{ variants: Variant[] } | { error: string }>;

type TemplateName = "premium" | "cozy" | "studio" | "cinematic" | "luxury" | "signature";

type ApplyFn = (
  text: string,
  h2?: string,
  sub?: string,
  template?: TemplateName,
) => Promise<{ ok: true } | { error: string }>;

const DEFAULT_PILL_CLASS =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition text-[12.5px] font-medium";

/**
 * Section-level text AI for /studio/design — same carousel pattern as the
 * per-item AI on package cards, but applied to a free-text field
 * (typically `trainer.about`, but generic enough for manifesto / metoda /
 * letter-body type fields).
 *
 * Renders ABOVE the section header. Collapsed state is a small `✨ Przepisz
 * AI` pill aligned right; expanded state breaks below into a full-width
 * panel with a roomy textarea so the trainer has real space to type a
 * prompt and compare variants. The component owns its own state and
 * vertical placement — drop it as the very first child of the section.
 *
 * Phases:
 *   collapsed → just the pill (aligned right, full-width row)
 *   prompting → full-width panel: large textarea + Wygeneruj
 *   loading   → spinner panel
 *   preview   → pager (Oryginał · 1 · 2 · 3) + variant text + Zastąp/Anuluj/Regen
 *
 * onGenerate / onApply are server actions provided by the parent — the
 * component itself doesn't know which field it's editing, so the same UI
 * works for any text section.
 */
export default function SectionAITextButton({
  label,
  currentText,
  onGenerate,
  onApply,
  template = "premium",
  pillClassName,
}: {
  /** Short label shown in the panel header ("O mnie", "Manifesto"). */
  label: string;
  /** The existing text — used as the "Oryginał" entry in the pager. */
  currentText: string;
  onGenerate: GenerateFn;
  onApply: ApplyFn;
  /** Routes the section-copy write to the right template bag. */
  template?: TemplateName;
  /** Tailwind classes for the collapsed trigger pill, so each template
   *  can theme it (lime on Cinematic, gold on Luxury, burgundy on
   *  Signature, etc). When omitted, falls back to the universal violet. */
  pillClassName?: string;
}) {
  const router = useRouter();
  type Phase = "collapsed" | "prompting" | "loading" | "preview";
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  // 0 = Oryginał, 1..3 = AI variant
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const reset = () => {
    setPhase("collapsed");
    setPrompt("");
    setVariants([]);
    setIdx(0);
    setError(null);
  };

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
      setIdx(1);
      setPhase("preview");
    });
  };

  const apply = () => {
    if (idx === 0) {
      reset();
      return;
    }
    const v = variants[idx - 1];
    if (!v) return;
    startTransition(async () => {
      const res = await onApply(v.text, v.h2, v.sub, template);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  };

  if (phase === "collapsed") {
    return (
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setPhase("prompting")}
          title={`Przepisz sekcję AI`}
          className={pillClassName ?? DEFAULT_PILL_CLASS}
        >
          <span>✨</span>
          <span>Przepisz AI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700">
          ✨ AI · {label}
        </div>
        {phase === "preview" && (
          <div className="flex items-center gap-1 flex-wrap">
            <PagerPill active={idx === 0} onClick={() => setIdx(0)} label="Oryginał" />
            {variants.map((_, i) => (
              <PagerPill
                key={i}
                active={idx === i + 1}
                onClick={() => setIdx(i + 1)}
                label={`Wariant ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {phase === "prompting" && (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'Np. „Trenuję kobiety 30-50, specjalizuję się w powrocie do formy po ciąży i bólach kręgosłupa. Pracuję metodycznie — najpierw ocena postawy, potem indywidualny plan. Lubię konkrety i mierzalne wyniki."'}
            rows={10}
            className="w-full text-[14px] leading-[1.55] p-4 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 resize-vertical bg-white min-h-[200px]"
          />
          {error && (
            <div className="mt-3 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={runGenerate}
              disabled={busy}
              className="flex-1 py-3 rounded-xl text-[15px] font-medium bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-60"
            >
              Wygeneruj 3 warianty
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="px-5 py-3 rounded-xl text-[15px] font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition disabled:opacity-60"
            >
              Anuluj
            </button>
          </div>
        </>
      )}

      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-violet-700">
            AI generuje 3 warianty...
          </div>
          <div className="text-[12px] text-slate-500">Może chwilę potrwać.</div>
        </div>
      )}

      {phase === "preview" && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-h-[560px] overflow-y-auto">
            {idx === 0 ? (
              <div className="text-[14.5px] text-slate-700 leading-[1.65] whitespace-pre-line">
                {currentText || <span className="italic text-slate-400">(pusty)</span>}
              </div>
            ) : (
              <>
                {/* Section header AI proposes alongside the body — applied
                    together if the trainer accepts. H2 may include <em>
                    accents (rich field). */}
                <div
                  className="text-[22px] font-semibold tracking-tight text-slate-900 mb-1"
                  dangerouslySetInnerHTML={{ __html: variants[idx - 1]?.h2 ?? "" }}
                />
                {variants[idx - 1]?.sub && (
                  <div className="text-[13px] text-slate-500 italic mb-4">
                    {variants[idx - 1]?.sub}
                  </div>
                )}
                <div className="text-[14.5px] text-slate-700 leading-[1.65] whitespace-pre-line border-t border-slate-100 pt-3">
                  {variants[idx - 1]?.text}
                </div>
              </>
            )}
          </div>
          {error && (
            <div className="mt-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-60"
            >
              {idx === 0 ? "Zachowaj oryginał" : busy ? "Zapisuję..." : "Zastąp tym wariantem"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition disabled:opacity-60"
            >
              Anuluj
            </button>
          </div>
          <div className="text-center mt-2">
            <button
              type="button"
              onClick={runGenerate}
              disabled={busy}
              className="text-[12px] text-violet-700 hover:text-violet-900 underline-offset-4 hover:underline disabled:opacity-60"
            >
              ↻ Wygeneruj inny zestaw
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PagerPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
        active
          ? "bg-violet-600 text-white"
          : "bg-white border border-violet-200 text-violet-700 hover:border-violet-400"
      }`}
    >
      {label}
    </button>
  );
}
