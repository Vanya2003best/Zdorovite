"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateCaseSetVariants,
  applyCaseSet,
  applyCaseSetReplace,
} from "./ai-actions";

type CaseItem = {
  tag: string;
  title: string;
  body: string;
  stat1: string;
  stat1Label: string;
  stat2: string;
  stat2Label: string;
  stat3: string;
  stat3Label: string;
};
type SetVariant = { set: CaseItem[] };

type TemplateName = "premium" | "cozy" | "studio" | "cinematic" | "luxury" | "signature";

const DEFAULT_PILL_CLASS =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition text-[12.5px] font-medium";

/**
 * Section-level AI for the Case Studies block. Same cherry-pick pattern
 * as services/packages: 3 variants of N cases each, click cards across
 * variants to assemble a custom set, then Add or Replace.
 *
 * All five PRO templates share the underlying `studioCopy.cases` array,
 * so this single component covers Cinematic / Luxury / Signature / Studio
 * (Premium has cases hidden by config but the wiring is harmless if
 * exposed). Template prop only routes the H2/Sub copy bag write.
 */
export default function SectionAICasesButton({
  currentCasesCount,
  template = "premium",
  pillClassName,
}: {
  currentCasesCount: number;
  template?: TemplateName;
  pillClassName?: string;
}) {
  const router = useRouter();
  type Phase = "collapsed" | "prompting" | "loading" | "preview";
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<SetVariant[]>([]);
  const [idx, setIdx] = useState(0);
  const [proposedH2, setProposedH2] = useState<string>("");
  const [proposedSub, setProposedSub] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const reset = () => {
    setPhase("collapsed");
    setPrompt("");
    setVariants([]);
    setIdx(0);
    setProposedH2("");
    setProposedSub("");
    setSelectedKeys(new Set());
    setError(null);
  };

  const runGenerate = () => {
    setError(null);
    setPhase("loading");
    startTransition(async () => {
      const res = await generateCaseSetVariants(prompt);
      if ("error" in res) {
        setError(res.error);
        setPhase("prompting");
        return;
      }
      setVariants(res.variants);
      setProposedH2(res.h2);
      setProposedSub(res.sub);
      setIdx(0);
      const defaultSel = new Set<string>();
      (res.variants[0]?.set ?? []).forEach((_, c) => defaultSel.add(`0-${c}`));
      setSelectedKeys(defaultSel);
      setPhase("preview");
    });
  };

  const toggleCard = (vIdx: number, cIdx: number) => {
    const key = `${vIdx}-${cIdx}`;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getSelectedCases = (): CaseItem[] => {
    const out: CaseItem[] = [];
    variants.forEach((v, vIdx) => {
      v.set.forEach((c, cIdx) => {
        if (selectedKeys.has(`${vIdx}-${cIdx}`)) out.push(c);
      });
    });
    return out;
  };

  const applyAppend = () => {
    const picked = getSelectedCases();
    if (picked.length === 0) return;
    startTransition(async () => {
      const res = await applyCaseSet(picked, proposedH2, proposedSub, template);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  };

  const applyReplace = () => {
    const picked = getSelectedCases();
    if (picked.length === 0) return;
    startTransition(async () => {
      const res = await applyCaseSetReplace(picked, proposedH2, proposedSub, template);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  };

  const showingSet = variants[idx]?.set ?? [];
  const selectedCount = selectedKeys.size;

  if (phase === "collapsed") {
    return (
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setPhase("prompting")}
          title="Dodaj kejsy wygenerowane przez AI"
          className={pillClassName ?? DEFAULT_PILL_CLASS}
        >
          <span>✨</span>
          <span>Dodaj kejsy z AI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700">
          ✨ AI · Kejsy
        </div>
        {phase === "preview" && (
          <div className="flex items-center gap-1 flex-wrap">
            {variants.map((_, i) => (
              <PagerPill
                key={i}
                active={idx === i}
                onClick={() => setIdx(i)}
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
            placeholder={'Np. „2 kejsy odchudzania kobiet po porodzie + 1 powrót do siłowni po urazie kolana. Konkretne liczby — kg, tygodnie, częstotliwość."'}
            rows={8}
            className="w-full text-[14px] leading-[1.55] p-4 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 resize-vertical bg-white min-h-[160px]"
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
              Wygeneruj 3 zestawy
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
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-violet-700">
            AI generuje 3 zestawy kejsów...
          </div>
          <div className="text-[12px] text-slate-500">Może chwilę potrwać.</div>
        </div>
      )}

      {phase === "preview" && (
        <>
          {(proposedH2 || proposedSub) && (
            <div className="bg-white border border-violet-200 rounded-xl px-4 py-3 mb-3">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700 mb-1.5">
                Tytuł sekcji (AI)
              </div>
              {proposedH2 && (
                <div
                  className="text-[20px] font-semibold tracking-tight text-slate-900"
                  dangerouslySetInnerHTML={{ __html: proposedH2 }}
                />
              )}
              {proposedSub && (
                <div className="text-[13px] text-slate-500 italic mt-0.5">
                  {proposedSub}
                </div>
              )}
            </div>
          )}
          <div className="text-[12px] text-slate-600 mb-2.5">
            Kliknij kartę, aby ją zaznaczyć/odznaczyć. Możesz wybierać z
            różnych wariantów. Wybrano: <strong className="text-violet-700">{selectedCount}</strong>
          </div>
          {showingSet.length === 0 ? (
            <div className="text-center text-[13px] text-slate-500 italic py-8 bg-white border border-slate-200 rounded-xl">
              Pusty zestaw
            </div>
          ) : (
            <div className="grid @[640px]:grid-cols-2 gap-3.5">
              {showingSet.map((c, i) => {
                const key = `${idx}-${i}`;
                const isSel = selectedKeys.has(key);
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => toggleCard(idx, i)}
                    className={`text-left bg-white/95 backdrop-blur-sm rounded-[18px] p-5 shadow-sm flex flex-col gap-3 transition ${
                      isSel
                        ? "border-2 border-violet-500 ring-2 ring-violet-200"
                        : "border border-white hover:border-violet-300"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {c.tag && (
                          <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-violet-700 mb-1.5">
                            {c.tag}
                          </div>
                        )}
                        <div className="text-[16px] font-semibold tracking-tight text-slate-900 leading-snug">
                          {c.title}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 w-6 h-6 rounded-md border-2 inline-flex items-center justify-center transition ${
                          isSel
                            ? "bg-violet-600 border-violet-600 text-white"
                            : "bg-white border-slate-300"
                        }`}
                        aria-hidden
                      >
                        {isSel && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                        )}
                      </span>
                    </div>
                    {c.body && (
                      <p className="text-[13px] text-slate-600 leading-relaxed m-0">
                        {c.body}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-1 pt-3 border-t border-slate-200">
                      {[
                        { v: c.stat1, l: c.stat1Label },
                        { v: c.stat2, l: c.stat2Label },
                        { v: c.stat3, l: c.stat3Label },
                      ].map((s, si) => (
                        <div key={si}>
                          <div className="text-[15px] font-semibold text-violet-700 leading-none">
                            {s.v || "—"}
                          </div>
                          <div className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                            {s.l}
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <div className="mt-3 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid @[640px]:grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={applyAppend}
              disabled={busy || selectedCount === 0}
              title={selectedCount === 0 ? "Najpierw zaznacz kejsy" : ""}
              className="py-3 rounded-xl text-[15px] font-medium bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy
                ? "Dodaję..."
                : selectedCount === 0
                ? "+ Dodaj zaznaczone"
                : `+ Dodaj ${selectedCount} ${selectedCount === 1 ? "kejs" : selectedCount < 5 ? "kejsy" : "kejsów"}`}
            </button>
            <button
              type="button"
              onClick={applyReplace}
              disabled={busy || currentCasesCount === 0 || selectedCount === 0}
              title={
                currentCasesCount === 0
                  ? "Brak kejsów do zastąpienia"
                  : selectedCount === 0
                  ? "Najpierw zaznacz kejsy"
                  : "Zastąpi obecne kejsy wybranym zestawem"
              }
              className="py-3 rounded-xl text-[15px] font-medium bg-white border-2 border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Zastępuję..." : `↺ Zastąp obecne (${currentCasesCount})`}
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 gap-2 flex-wrap">
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-[12px] text-slate-500 hover:text-slate-700 disabled:opacity-60"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={runGenerate}
              disabled={busy}
              className="text-[12px] text-violet-700 hover:text-violet-900 underline-offset-4 hover:underline disabled:opacity-60"
            >
              ↻ Wygeneruj inny zestaw 3 wariantów
            </button>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            <strong>Dodaj</strong> — nowe kejsy dopisuje się na koniec
            listy, stare zostają.
            <br />
            <strong>Zastąp</strong> — usuwa wszystkie obecne kejsy i
            wstawia wybrane. Zdjęcia nie są generowane przez AI — dodaj
            je ręcznie po wstawieniu.
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
