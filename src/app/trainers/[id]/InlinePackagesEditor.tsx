"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackage,
  removePackage,
  togglePackageFeatured,
  updatePackageItems,
} from "./package-actions";
import { setItemOrder } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import EditablePkgField from "./EditablePkgField";
import InlineEditable from "./InlineEditable";
import { generatePackageVariants, applyPackageVariant } from "./ai-actions";
import { usePreviewTransition } from "./preview-busy";

type Pkg = {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period?: string;
  featured?: boolean;
};

type Variant = { name: string; description: string; items: string[] };

/**
 * Edit-mode rendering of the Premium package grid.
 *
 * Matches `PremiumProfile.tsx` public package cards 1:1 — same outer
 * grid (mobile horizontal snap, desktop 3 columns), same featured
 * gradient + ⭐ Popularne badge + @[640px]:-translate-y-1 lift, same item
 * list with circular emerald checkmarks, same bottom "Wybierz pakiet"
 * CTA. Editor-only affordances:
 *   • hover-only delete + featured-toggle + AI buttons (top-right)
 *   • items rendered as inline inputs that look like plain text
 *   • add-pakiet tile shares the same rounded-[20px] frame
 *   • Wybierz pakiet button is disabled (visual parity, no nav)
 *
 * AI state is held HERE (not in each card) so that while one card is in
 * AI preview, sibling cards know to dim — gives the trainer a clear
 * "this is the focus" cue and prevents accidental clicks elsewhere.
 */
export default function InlinePackagesEditor({ packages }: { packages: Pkg[] }) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();

  // Parent already applies packageOverrides → list arrives in committed order.
  // Mirror locally so reorder feels instant before router.refresh.
  const [order, setOrder] = useState<Pkg[]>(packages);
  const seedKey = packages
    .map((p) => `${p.id}:${p.name}:${p.description}:${p.items.join("/")}:${p.featured ? 1 : 0}`)
    .join("|");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(packages);
  }, [seedKey, packages]);

  // Which package (if any) is currently in AI mode. Used to dim siblings.
  const [aiActiveId, setAiActiveId] = useState<string | null>(null);

  const onAdd = () => {
    startTransition(async () => {
      await addPackage();
      router.refresh();
    });
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = order.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    pinScrollFor(1500);
    const prev = order;
    setOrder(next);
    setItemOrder("package", next.map((p) => p.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setOrder(prev);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 @[640px]:grid-cols-2 @[1000px]:grid-cols-3">
      {order.map((pkg, i) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          isFirst={i === 0}
          isLast={i === order.length - 1}
          onMoveLeft={() => onMove(pkg.id, -1)}
          onMoveRight={() => onMove(pkg.id, 1)}
          isAiActive={aiActiveId === pkg.id}
          isAiBlocked={aiActiveId !== null && aiActiveId !== pkg.id}
          onAiStart={() => setAiActiveId(pkg.id)}
          onAiEnd={() => setAiActiveId(null)}
        />
      ))}

      {/* Add card — hidden while another card is in AI preview to keep focus. */}
      {aiActiveId === null && (
        <button
          type="button"
          onClick={onAdd}
          disabled={pending}
          className="flex flex-col items-center justify-center gap-2 rounded-[20px] p-5 @[640px]:p-6 border-2 border-dashed border-emerald-300 bg-emerald-50/30 text-emerald-700 font-medium min-h-[360px] hover:border-emerald-500 hover:bg-emerald-50/60 transition disabled:opacity-60"
        >
          <span className="text-3xl leading-none">+</span>
          <span className="text-sm">{pending ? "Dodaję..." : "Dodaj pakiet"}</span>
        </button>
      )}
    </div>
  );
}

function PackageCard({
  pkg,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  isAiActive,
  isAiBlocked,
  onAiStart,
  onAiEnd,
}: {
  pkg: Pkg;
  isFirst: boolean;
  isLast: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  isAiActive: boolean;
  isAiBlocked: boolean;
  onAiStart: () => void;
  onAiEnd: () => void;
}) {
  const [items, setItems] = useState<string[]>(pkg.items);
  const itemsKey = pkg.items.join(" ");
  const lastItemsKey = useRef(itemsKey);
  useEffect(() => {
    if (lastItemsKey.current === itemsKey) return;
    lastItemsKey.current = itemsKey;
    setItems(pkg.items);
  }, [itemsKey, pkg.items]);
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();

  // ===== AI carousel state =====
  // phase machine:
  //   idle      — normal card render
  //   prompting — textarea overlay; trainer types optional change request
  //   loading   — spinner; Qwen call in flight
  //   preview   — pager (Oryginał · 1 · 2 · 3) cycles between original and 3 variants
  type AiPhase = "idle" | "prompting" | "loading" | "preview";
  const [aiPhase, setAiPhase] = useState<AiPhase>("idle");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiVariants, setAiVariants] = useState<Variant[]>([]);
  // 0 = original, 1..3 = AI variant index
  const [aiIdx, setAiIdx] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, startAiTransition] = usePreviewTransition();

  // Sync external `isAiActive` flag so reset cleans this card too.
  useEffect(() => {
    if (!isAiActive && aiPhase !== "idle") {
      setAiPhase("idle");
      setAiVariants([]);
      setAiIdx(0);
      setAiPrompt("");
      setAiError(null);
    }
  }, [isAiActive, aiPhase]);

  const onDelete = () => {
    startTransition(async () => {
      await removePackage(pkg.id);
      router.refresh();
    });
  };

  const onToggleFeatured = () => {
    startTransition(async () => {
      await togglePackageFeatured(pkg.id);
      router.refresh();
    });
  };

  const updateItems = (next: string[]) => {
    setItems(next);
    startTransition(async () => {
      await updatePackageItems(pkg.id, next);
      router.refresh();
    });
  };

  const onItemCommit = (idx: number, value: string) => {
    if (value === items[idx]) return;
    const next = [...items];
    next[idx] = value;
    updateItems(next);
  };
  const onItemRemove = (idx: number) => updateItems(items.filter((_, i) => i !== idx));
  const onItemAdd = () => updateItems([...items, "Nowa pozycja"]);

  // ===== AI handlers =====
  const startAi = () => {
    setAiPhase("prompting");
    setAiPrompt("");
    setAiError(null);
    onAiStart();
  };

  const cancelAi = () => {
    setAiPhase("idle");
    setAiVariants([]);
    setAiIdx(0);
    setAiPrompt("");
    setAiError(null);
    onAiEnd();
  };

  const runGenerate = () => {
    setAiError(null);
    setAiPhase("loading");
    startAiTransition(async () => {
      const res = await generatePackageVariants(pkg.id, aiPrompt);
      if ("error" in res) {
        setAiError(res.error);
        setAiPhase("prompting");
        return;
      }
      setAiVariants(res.variants);
      // Land on the first variant — trainer can cycle to "Oryginał" via the
      // pager if they want to compare.
      setAiIdx(1);
      setAiPhase("preview");
    });
  };

  const applyCurrentVariant = () => {
    if (aiIdx === 0 || aiIdx > aiVariants.length) {
      // "Oryginał" is selected — nothing to apply, just exit AI mode.
      cancelAi();
      return;
    }
    const variant = aiVariants[aiIdx - 1]!;
    startAiTransition(async () => {
      const res = await applyPackageVariant(pkg.id, variant);
      if ("error" in res) {
        setAiError(res.error);
        return;
      }
      cancelAi();
      router.refresh();
    });
  };

  // The view-mode body (name/price/items) — extracted so we can render it
  // either with edit affordances (idle) or as plain text (when previewing
  // a variant or in another AI phase).
  const variantData: Variant | null =
    aiPhase === "preview" && aiIdx > 0 && aiIdx <= aiVariants.length
      ? aiVariants[aiIdx - 1]!
      : null;

  const cardClassName = `group flex flex-col gap-4 rounded-[20px] p-5 @[640px]:p-6 relative transition ${
    pkg.featured
      ? "bg-gradient-to-b from-white/95 to-emerald-50/90 border border-emerald-300 shadow-[0_22px_48px_-18px_rgba(16,185,129,0.3)] @[1000px]:-translate-y-1"
      : "bg-white/80 backdrop-blur-sm border border-white/70 shadow-sm"
  } ${isAiActive ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#f8fafc]" : ""} ${
    isAiBlocked ? "opacity-50 pointer-events-none" : ""
  }`;

  return (
    <div className={cardClassName}>
      {/* Hover-only toolbar — reorder + featured + AI + delete. Hidden in
          AI mode. Solid white pill with drop shadow + slate-300 border so
          the buttons stay legible against the off-white page bg. */}
      {!isAiActive && (
        <div className="absolute -top-4 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={isFirst}
            title="Przesuń w lewo"
            className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-700 shadow-md inline-flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={isLast}
            title="Przesuń w prawo"
            className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-700 shadow-md inline-flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <button
            type="button"
            onClick={startAi}
            title="Przepisz AI"
            className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-700 shadow-md inline-flex items-center justify-center text-base hover:bg-violet-50 hover:text-violet-700 hover:border-violet-400 transition"
          >
            ✨
          </button>
          <button
            type="button"
            onClick={onToggleFeatured}
            disabled={pending}
            title={pkg.featured ? "Usuń wyróżnienie" : "Wyróżnij jako Popularne"}
            className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-700 shadow-md inline-flex items-center justify-center text-base hover:bg-amber-50 hover:text-amber-600 hover:border-amber-400 transition"
          >
            {pkg.featured ? "⭐" : "☆"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title="Usuń pakiet"
            className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-700 shadow-md inline-flex items-center justify-center text-base hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition"
          >
            🗑
          </button>
        </div>
      )}

      {/* AI mode top bar — pager (preview) or close button (prompting/loading). */}
      {aiPhase === "preview" && (
        <div className="flex items-center gap-1.5 -mx-1 -mt-1 mb-1 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700 mr-1">
            ✨ AI · podgląd
          </span>
          <PagerPill active={aiIdx === 0} onClick={() => setAiIdx(0)} label="Oryginał" />
          {aiVariants.map((_, i) => (
            <PagerPill
              key={i}
              active={aiIdx === i + 1}
              onClick={() => setAiIdx(i + 1)}
              label={`Wariant ${i + 1}`}
            />
          ))}
        </div>
      )}

      {pkg.featured && aiPhase !== "prompting" && aiPhase !== "loading" && (
        <span className="absolute -top-2.5 left-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] px-3 py-1 rounded-full font-semibold uppercase tracking-[0.06em] shadow-sm">
          ⭐ Popularne
        </span>
      )}

      {/* ============== BODY: phase-dependent rendering ============== */}

      {aiPhase === "prompting" && (
        <PromptingBody
          packageName={pkg.name}
          prompt={aiPrompt}
          setPrompt={setAiPrompt}
          onGenerate={runGenerate}
          onCancel={cancelAi}
          error={aiError}
        />
      )}

      {aiPhase === "loading" && <LoadingBody />}

      {(aiPhase === "idle" || aiPhase === "preview") && (
        <>
          <div>
            <div className="text-base font-semibold text-emerald-700">
              {variantData ? (
                <span>{variantData.name}</span>
              ) : (
                <EditablePkgField packageId={pkg.id} field="name" initial={pkg.name} />
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
              <span className="text-[34px] font-semibold tracking-tight whitespace-nowrap">
                {variantData ? (
                  <span>{pkg.price}</span>
                ) : (
                  <EditablePkgField
                    packageId={pkg.id}
                    field="price"
                    initial={String(pkg.price)}
                  />
                )}{" "}
                zł
              </span>
              <span className="text-[13px] text-slate-500 whitespace-nowrap">
                /{" "}
                {variantData ? (
                  <span>{pkg.period}</span>
                ) : (
                  <EditablePkgField
                    packageId={pkg.id}
                    field="period"
                    initial={pkg.period ?? ""}
                    placeholder="miesiąc"
                  />
                )}
              </span>
            </div>
            <div className="text-[13px] text-slate-600 leading-snug mt-2">
              {variantData ? (
                <span>{variantData.description}</span>
              ) : (
                <EditablePkgField
                  packageId={pkg.id}
                  field="description"
                  initial={pkg.description}
                  placeholder="Krótki opis (opcjonalnie)..."
                />
              )}
            </div>
          </div>

          <ul className="space-y-2.5 flex-1">
            {(variantData ? variantData.items : items).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                <span className="w-[18px] h-[18px] rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                {variantData ? (
                  <span className="flex-1 text-sm leading-relaxed">{item}</span>
                ) : (
                  <>
                    <InlineEditable
                      key={`${pkg.id}-${idx}-${item}`}
                      initial={item}
                      maxLength={60}
                      placeholder="Co wchodzi w skład pakietu..."
                      className="flex-1 text-sm leading-relaxed"
                      onCommit={(next) => onItemCommit(idx, next)}
                    />
                    <button
                      type="button"
                      onClick={() => onItemRemove(idx)}
                      className="text-slate-400 hover:text-red-600 text-sm opacity-0 group-hover:opacity-100 transition shrink-0"
                      title="Usuń pozycję"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
            {!variantData && (
              <li>
                <button
                  type="button"
                  onClick={onItemAdd}
                  className="w-full text-left text-[13px] text-emerald-700 hover:text-emerald-900 font-medium py-1.5 px-0.5"
                >
                  + Dodaj pozycję
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      {/* ============== BOTTOM: CTA in idle, AI controls in preview ============== */}

      {aiPhase === "preview" ? (
        <div className="flex flex-col gap-2 mt-auto">
          {aiError && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {aiError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyCurrentVariant}
              disabled={aiBusy}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-60"
            >
              {aiIdx === 0 ? "Zachowaj oryginał" : aiBusy ? "Zapisuję..." : "Zastąp tym wariantem"}
            </button>
            <button
              type="button"
              onClick={cancelAi}
              disabled={aiBusy}
              className="px-3 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition disabled:opacity-60"
            >
              Anuluj
            </button>
          </div>
          <button
            type="button"
            onClick={runGenerate}
            disabled={aiBusy}
            className="text-[12px] text-violet-700 hover:text-violet-900 underline-offset-4 hover:underline self-center disabled:opacity-60"
          >
            ↻ Wygeneruj inny zestaw
          </button>
        </div>
      ) : aiPhase === "idle" ? (
        <button
          type="button"
          disabled
          title="Podgląd — w trybie edycji nie można rezerwować"
          className={`w-full py-3 rounded-xl text-sm font-medium transition mt-auto cursor-not-allowed ${
            pkg.featured
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)]"
              : "bg-white border border-slate-200 text-slate-900"
          }`}
        >
          Wybierz pakiet
        </button>
      ) : null}
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

function PromptingBody({
  packageName,
  prompt,
  setPrompt,
  onGenerate,
  onCancel,
  error,
}: {
  packageName: string;
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 flex-1 justify-center min-h-[280px]">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700">
        ✨ Przepisz AI
      </div>
      <div className="text-[13px] text-slate-600">
        Pakiet: <span className="font-medium text-slate-900">{packageName}</span>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={'Co zmienić? (opcjonalnie) — np. „skróć opis”, „dodaj akcent na powrót formy po porodzie”, „zrób bardziej premium”'}
        rows={4}
        className="w-full text-[13px] p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 resize-vertical"
      />
      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
          {error}
        </div>
      )}
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onGenerate}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition"
        >
          Wygeneruj 3 warianty
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 flex-1 min-h-[280px] text-slate-500">
      <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-violet-700">
        AI generuje 3 warianty...
      </div>
      <div className="text-[12px] text-slate-500">Może chwilę potrwać.</div>
    </div>
  );
}
