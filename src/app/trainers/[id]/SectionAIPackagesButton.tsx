"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generatePackageSetVariants,
  applyPackageSet,
  applyPackageSetReplace,
} from "./ai-actions";

type PackageItem = {
  name: string;
  description: string;
  items: string[];
  period: string;
};
type SetVariant = { set: PackageItem[] };

/**
 * Section-level AI for the Packages block — same shape as the services
 * section AI: prompt → 3 variants → cherry-pick across variants → Add or
 * Replace. Selection key is `${variantIdx}-${cardIdx}` so cards are
 * unique across variants. Default selection = whole variant 0.
 *
 * AI does NOT set price (per the consistent rule for all generators).
 * Period IS in scope ("4 tygodnie", "12 tygodni" etc.) because that's a
 * marketing-relevant decision the model should propose.
 *
 * Replace mode is safe even when packages have linked bookings — booking
 * snapshots (migration 018) keep historical records intact.
 */
type TemplateName = "premium" | "cozy" | "studio" | "cinematic" | "luxury" | "signature";

const DEFAULT_PILL_CLASS =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition text-[12.5px] font-medium";

export default function SectionAIPackagesButton({
  currentPackagesCount,
  template = "premium",
  pillClassName,
}: {
  currentPackagesCount: number;
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
      const res = await generatePackageSetVariants(prompt);
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

  const getSelectedPackages = (): PackageItem[] => {
    const out: PackageItem[] = [];
    variants.forEach((v, vIdx) => {
      v.set.forEach((p, cIdx) => {
        if (selectedKeys.has(`${vIdx}-${cIdx}`)) out.push(p);
      });
    });
    return out;
  };

  const applyAppend = () => {
    const picked = getSelectedPackages();
    if (picked.length === 0) return;
    startTransition(async () => {
      const res = await applyPackageSet(picked, proposedH2, proposedSub, template);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  };

  const applyReplace = () => {
    const picked = getSelectedPackages();
    if (picked.length === 0) return;
    startTransition(async () => {
      const res = await applyPackageSetReplace(picked, proposedH2, proposedSub, template);
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
          title="Dodaj pakiety wygenerowane przez AI"
          className={pillClassName ?? DEFAULT_PILL_CLASS}
        >
          <span>✨</span>
          <span>Dodaj pakiety z AI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700">
          ✨ AI · Pakiety
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
            placeholder={'Np. „Mam klientów którzy chcą wrócić do formy po porodzie. Daj mi 2 pakiety — krótki starter i głęboka transformacja."'}
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
            AI generuje 3 zestawy...
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
            <div className="grid @[640px]:grid-cols-2 @[1000px]:grid-cols-3 gap-3.5">
              {showingSet.map((p, i) => {
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
                      <div>
                        <div className="text-base font-semibold text-emerald-700">{p.name}</div>
                        <div className="text-[12px] text-slate-500 mt-0.5">{p.period}</div>
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
                    {p.description && (
                      <div className="text-[13px] text-slate-600 leading-snug">
                        {p.description}
                      </div>
                    )}
                    <ul className="space-y-1.5 flex-1 mt-1">
                      {p.items.slice(0, 7).map((it, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-[13px] text-slate-700 leading-snug"
                        >
                          <span className="w-[16px] h-[16px] rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </span>
                          {it}
                        </li>
                      ))}
                    </ul>
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
              title={selectedCount === 0 ? "Najpierw zaznacz pakiety" : ""}
              className="py-3 rounded-xl text-[15px] font-medium bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy
                ? "Dodaję..."
                : selectedCount === 0
                ? "+ Dodaj zaznaczone"
                : `+ Dodaj ${selectedCount} ${selectedCount === 1 ? "pakiet" : selectedCount < 5 ? "pakiety" : "pakietów"}`}
            </button>
            <button
              type="button"
              onClick={applyReplace}
              disabled={busy || currentPackagesCount === 0 || selectedCount === 0}
              title={
                currentPackagesCount === 0
                  ? "Brak pakietów do zastąpienia"
                  : selectedCount === 0
                  ? "Najpierw zaznacz pakiety"
                  : "Zastąpi obecne pakiety wybranym zestawem"
              }
              className="py-3 rounded-xl text-[15px] font-medium bg-white border-2 border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Zastępuję..." : `↺ Zastąp obecne (${currentPackagesCount})`}
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
            <strong>Dodaj</strong> — nowe pakiety dopisuje się na koniec
            listy, stare zostają.
            <br />
            <strong>Zastąp</strong> — usuwa wszystkie obecne pakiety i
            wstawia wybrane. Aktywne rezerwacje pozostają — klient i Ty
            dalej widzicie w nich oryginalną nazwę pakietu, ale na
            publicznym profilu znikną.
            <br />
            Cena każdego nowego pakietu to 0 zł — wpisz ją ręcznie po
            dodaniu.
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
