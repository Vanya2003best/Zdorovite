"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addService, removeService } from "./service-actions";
import { setItemOrder } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import EditableServiceField from "./EditableServiceField";
import { generateServiceVariants, applyServiceVariant } from "./ai-actions";
import { usePreviewTransition } from "./preview-busy";

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
};

type Variant = { name: string; description: string; duration: number };

/**
 * Edit-mode rendering of the Premium service grid.
 *
 * Layout & styling match `PremiumProfile.tsx` public service cards 1:1
 * (`bg-white/80 backdrop-blur-sm border border-white/70 rounded-[18px] p-5 @[640px]:p-5.5 shadow-sm`).
 * Hover affordances per card: reorder ← →, ✨ AI rewrite, 🗑 delete. While
 * one card is in AI preview, sibling cards dim — same focus-locking pattern
 * as InlinePackagesEditor.
 */
export default function InlineServicesEditor({ services }: { services: Service[] }) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();

  // Parent already applies serviceOverrides, so the incoming list is in the
  // committed order — we just mirror it locally so optimistic moves render
  // before router.refresh round-trips.
  const [order, setOrder] = useState<Service[]>(services);
  const seedKey = services
    .map((s) => `${s.id}:${s.name}:${s.description}:${s.duration}:${s.price}`)
    .join("|");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(services);
  }, [seedKey, services]);

  const [aiActiveId, setAiActiveId] = useState<string | null>(null);

  const onAdd = () => {
    startTransition(async () => {
      await addService();
      router.refresh();
    });
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = order.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    pinScrollFor(1500);
    const prev = order;
    setOrder(next);
    setItemOrder("service", next.map((s) => s.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setOrder(prev);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="grid @[640px]:grid-cols-2 gap-3.5">
      {order.map((svc, i) => (
        <ServiceCard
          key={svc.id}
          service={svc}
          isFirst={i === 0}
          isLast={i === order.length - 1}
          onMoveLeft={() => onMove(svc.id, -1)}
          onMoveRight={() => onMove(svc.id, 1)}
          isAiActive={aiActiveId === svc.id}
          isAiBlocked={aiActiveId !== null && aiActiveId !== svc.id}
          onAiStart={() => setAiActiveId(svc.id)}
          onAiEnd={() => setAiActiveId(null)}
        />
      ))}

      {/* Add card — hidden while a card is in AI preview to keep focus. */}
      {aiActiveId === null && (
        <button
          type="button"
          onClick={onAdd}
          disabled={pending}
          className="bg-emerald-50/40 backdrop-blur-sm border-2 border-dashed border-emerald-300 rounded-[18px] p-5 @[640px]:p-5.5 shadow-sm flex flex-col items-center justify-center gap-2 text-emerald-700 font-medium min-h-[220px] hover:border-emerald-500 hover:bg-emerald-50/70 transition disabled:opacity-60"
        >
          <span className="text-3xl leading-none">+</span>
          <span className="text-sm">{pending ? "Dodaję..." : "Dodaj usługę"}</span>
        </button>
      )}
    </div>
  );
}

function ServiceCard({
  service,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  isAiActive,
  isAiBlocked,
  onAiStart,
  onAiEnd,
}: {
  service: Service;
  isFirst: boolean;
  isLast: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  isAiActive: boolean;
  isAiBlocked: boolean;
  onAiStart: () => void;
  onAiEnd: () => void;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();

  type AiPhase = "idle" | "prompting" | "loading" | "preview";
  const [aiPhase, setAiPhase] = useState<AiPhase>("idle");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiVariants, setAiVariants] = useState<Variant[]>([]);
  const [aiIdx, setAiIdx] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, startAiTransition] = usePreviewTransition();

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
      await removeService(service.id);
      router.refresh();
    });
  };

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
      const res = await generateServiceVariants(service.id, aiPrompt);
      if ("error" in res) {
        setAiError(res.error);
        setAiPhase("prompting");
        return;
      }
      setAiVariants(res.variants);
      setAiIdx(1);
      setAiPhase("preview");
    });
  };

  const applyCurrent = () => {
    if (aiIdx === 0 || aiIdx > aiVariants.length) {
      cancelAi();
      return;
    }
    const variant = aiVariants[aiIdx - 1]!;
    startAiTransition(async () => {
      const res = await applyServiceVariant(service.id, variant);
      if ("error" in res) {
        setAiError(res.error);
        return;
      }
      cancelAi();
      router.refresh();
    });
  };

  const variantData: Variant | null =
    aiPhase === "preview" && aiIdx > 0 && aiIdx <= aiVariants.length
      ? aiVariants[aiIdx - 1]!
      : null;

  const cardClassName = `group relative bg-white/80 backdrop-blur-sm border border-white/70 rounded-[18px] p-5 @[640px]:p-5.5 shadow-sm flex flex-col gap-2.5 transition ${
    isAiActive ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#f8fafc]" : ""
  } ${isAiBlocked ? "opacity-50 pointer-events-none" : ""}`;

  return (
    <div className={cardClassName}>
      {/* Hover toolbar — hidden in AI mode. Sits ABOVE the card edge so it
          doesn't clash with the title/price row at the top of the card.
          Solid white pill, drop shadow + slate-300 border so the buttons
          read clearly against the off-white page bg. */}
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
            onClick={onDelete}
            disabled={pending}
            title="Usuń usługę"
            className="w-9 h-9 rounded-full bg-white border border-slate-300 text-slate-700 shadow-md inline-flex items-center justify-center text-base hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition disabled:opacity-60"
          >
            🗑
          </button>
        </div>
      )}

      {/* AI mode top bar. */}
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

      {/* ============== BODY: phase-dependent ============== */}

      {aiPhase === "prompting" && (
        <PromptingBody
          serviceName={service.name}
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
          <div className="flex justify-between items-baseline gap-3">
            <div className="text-[17px] font-semibold tracking-tight flex-1">
              {variantData ? (
                <span>{variantData.name}</span>
              ) : (
                <EditableServiceField
                  serviceId={service.id}
                  field="name"
                  initial={service.name}
                />
              )}
            </div>
            <div className="text-base font-semibold text-emerald-700 whitespace-nowrap">
              {variantData ? (
                <span>{service.price} zł</span>
              ) : (
                <EditableServiceField
                  serviceId={service.id}
                  field="price"
                  initial={String(service.price)}
                  suffix=" zł"
                />
              )}
            </div>
          </div>
          <div className="text-sm text-slate-600 leading-snug">
            {variantData ? (
              <span>{variantData.description}</span>
            ) : (
              <EditableServiceField
                serviceId={service.id}
                field="description"
                initial={service.description}
                placeholder="Dodaj opis..."
              />
            )}
          </div>
          <div className="flex gap-3.5 text-xs text-slate-500 mt-auto pt-2.5 border-t border-slate-200">
            <span className="inline-flex items-center gap-1">
              ⏱{" "}
              {variantData ? (
                <span>{variantData.duration} min</span>
              ) : (
                <EditableServiceField
                  serviceId={service.id}
                  field="duration"
                  initial={String(service.duration)}
                  suffix=" min"
                />
              )}
            </span>
            <span className="inline-flex items-center gap-1">📍 Sala</span>
          </div>
        </>
      )}

      {/* ============== BOTTOM: CTA in idle, AI controls in preview ============== */}

      {aiPhase === "preview" ? (
        <div className="flex flex-col gap-2 mt-1">
          {aiError && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {aiError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyCurrent}
              disabled={aiBusy}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-60"
            >
              {aiIdx === 0 ? "Zachowaj oryginał" : aiBusy ? "Zapisuję..." : "Zastąp tym wariantem"}
            </button>
            <button
              type="button"
              onClick={cancelAi}
              disabled={aiBusy}
              className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition disabled:opacity-60"
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
          className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white mt-1 cursor-not-allowed"
        >
          Zarezerwuj →
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
  serviceName,
  prompt,
  setPrompt,
  onGenerate,
  onCancel,
  error,
}: {
  serviceName: string;
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 flex-1 justify-center min-h-[180px]">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-violet-700">
        ✨ Przepisz AI
      </div>
      <div className="text-[13px] text-slate-600">
        Usługa: <span className="font-medium text-slate-900">{serviceName}</span>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={'Co zmienić? (opcjonalnie) — np. „skróć opis", „dodaj akcent na przygotowanie do biegów"'}
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
          className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition"
        >
          Wygeneruj 3 warianty
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 flex-1 min-h-[180px] text-slate-500">
      <div className="w-7 h-7 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-violet-700">
        AI generuje 3 warianty...
      </div>
    </div>
  );
}
