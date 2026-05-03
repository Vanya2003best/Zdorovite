"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addService, removeService } from "./service-actions";
import { setItemHidden, setItemOrder, clearItemOverrides } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { useRefreshKeepingScroll } from "./keep-scroll";
import EditableServiceField from "./EditableServiceField";
import { usePreviewTransition } from "./preview-busy";
import PerItemAIPopover from "./PerItemAIPopover";
import { generateServiceVariants, applyServiceVariant } from "./ai-actions";
import type { ItemOverride } from "@/types";

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
};

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/**
 * Edit-mode rendering of the Luxury services list.
 *
 * Pixel-equivalent to the read-only "lux-svc-row" layout in LuxuryProfile.
 * On secondary pages, each row exposes inline ↑/↓/👁 in the hover cluster
 * (replacing the standalone overrides panel). Reorder + hide are optimistic.
 */
export default function LuxuryServicesEditor({
  services,
  overrides,
}: {
  services: Service[];
  overrides: Record<string, ItemOverride>;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();

  const propOrdered = !pageId
    ? services
    : [...services]
        .map((s, idx) => ({
          s,
          ord: typeof overrides[s.id]?.position === "number" ? overrides[s.id]!.position! : idx + 10000,
        }))
        .sort((a, b) => a.ord - b.ord)
        .map((x) => x.s);

  const [order, setOrder] = useState<Service[]>(propOrdered);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const s of services) if (overrides[s.id]?.hidden) m[s.id] = true;
    return m;
  });

  // Content-aware seed key — fires re-seed when AI-apply or any server-side
  // mutation rewrites name/description/duration/price without changing the
  // id list. Without this the card stays on its pre-edit content.
  const seedKey =
    propOrdered
      .map((s) => `${s.id}:${s.name}:${s.description}:${s.duration}:${s.price}`)
      .join("|") +
    "::" +
    services.map((s) => `${s.id}:${overrides[s.id]?.hidden ? 1 : 0}:${overrides[s.id]?.position ?? "-"}`).join(",");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(propOrdered);
    const m: Record<string, boolean> = {};
    for (const s of services) if (overrides[s.id]?.hidden) m[s.id] = true;
    setHiddenMap(m);
  }, [seedKey, propOrdered, services, overrides]);

  const hasAnyOverride = pageId ? Object.keys(overrides).length > 0 : false;

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
    const prev = order;
    const next = [...order];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setOrder(next);
    setItemOrder("service", next.map((s) => s.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setOrder(prev);
      } else {
        refreshKeepingScroll();
      }
    });
  };

  const onToggleHidden = (id: string, currentlyHidden: boolean) => {
    if (!pageId) return;
    const nextHidden = !currentlyHidden;
    setHiddenMap((m) => ({ ...m, [id]: nextHidden }));
    setItemHidden("service", id, nextHidden, pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setHiddenMap((m) => ({ ...m, [id]: currentlyHidden }));
      } else {
        refreshKeepingScroll();
      }
    });
  };

  const onResetOverrides = () => {
    if (!pageId) return;
    setHiddenMap({});
    setOrder(services);
    clearItemOverrides("service", pageId).then((res) => {
      if ("error" in res) alert(res.error);
      refreshKeepingScroll();
    });
  };

  return (
    <div className="max-w-[960px] mx-auto">
      {order.map((svc, i) => {
        const hidden = !!hiddenMap[svc.id];
        return (
          <ServiceRow
            key={svc.id}
            service={svc}
            index={i}
            isFirst={i === 0}
            isLast={i === order.length - 1}
            hidden={hidden}
            showOverrideControls={!!pageId}
            onMoveUp={() => onMove(svc.id, -1)}
            onMoveDown={() => onMove(svc.id, 1)}
            onToggleHidden={() => onToggleHidden(svc.id, hidden)}
          />
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="grid grid-cols-[36px_1fr] @[1024px]:grid-cols-[48px_1fr] gap-5 @[1024px]:gap-7 items-center w-full text-left py-6 sm:py-7 border-y border-dashed border-[#8a7346]/40 hover:border-[#8a7346] hover:px-5 transition-all disabled:opacity-60 text-[#8a7346]"
      >
        <div className="font-serif italic text-[16px] sm:text-[18px]">+</div>
        <div className="font-serif font-normal text-[18px] sm:text-[22px] tracking-[-0.015em]">
          {pending ? "Dodaję..." : "Dodaj usługę"}
        </div>
      </button>
      {hasAnyOverride && (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-[#7a7365] hover:text-[#8a7346] hover:underline transition"
          >
            Resetuj kolejność i widoczność usług na tej stronie
          </button>
        </div>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  index,
  isFirst,
  isLast,
  hidden,
  showOverrideControls,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: {
  service: Service;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  hidden: boolean;
  showOverrideControls: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  const onDelete = () => {
    startTransition(async () => {
      await removeService(service.id);
      router.refresh();
    });
  };

  const r = ROMAN[index + 1] ?? String(index + 1);

  return (
    <div className={`group relative grid grid-cols-[36px_1fr] @[1024px]:grid-cols-[48px_1fr_auto_auto] gap-5 @[1024px]:gap-7 items-start @[1024px]:items-center py-6 sm:py-7 border-t border-[#d9cfb8] last:border-b last:border-[#d9cfb8] hover:bg-[#fbf8f1] hover:px-5 transition-all ${hidden ? "opacity-55" : ""}`}>
      {/* Hover-only control cluster — top-right */}
      <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w górę"
          className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-[#8a7346] hover:border-[#8a7346]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Przesuń w dół"
          className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-[#8a7346] hover:border-[#8a7346]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </button>
        {showOverrideControls && (
          <>
            <button
              type="button"
              onClick={onToggleHidden}
              title={hidden ? "Pokaż na tej stronie" : "Ukryj na tej stronie"}
              className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
                hidden
                  ? "bg-[#fbf8f1] border-[#8a7346]/60 text-[#8a7346]"
                  : "bg-[#fbf8f1] border-[#d9cfb8] text-[#7a7365] hover:text-[#8a7346] hover:border-[#8a7346]/60"
              }`}
            >
              {hidden ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </>
        )}
        <button
          ref={aiBtnRef}
          type="button"
          onClick={() => setAiOpen(true)}
          title="Przepisz AI"
          className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-400/60 transition text-base"
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń usługę"
          className="w-8 h-8 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#7a7365] inline-flex items-center justify-center hover:text-red-700 hover:border-red-700/40 transition disabled:opacity-60"
        >
          🗑
        </button>
      </div>

      <PerItemAIPopover
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        itemLabel="usługę"
        currentTitle={service.name}
        onGenerate={(p) => generateServiceVariants(service.id, p)}
        onApply={(v) =>
          applyServiceVariant(service.id, {
            name: String(v.name ?? ""),
            description: String(v.description ?? ""),
            duration: Number(v.duration ?? service.duration),
          })
        }
        renderVariantPreview={(v) => (
          <div className="grid gap-1.5">
            <div className="font-serif text-[16px] tracking-[-0.01em] text-[#1c1a15]">
              {String(v.name ?? "")}
            </div>
            <div className="text-[12.5px] text-[#5a5447] leading-[1.5]">
              {String(v.description ?? "")}
            </div>
            <div className="text-[10.5px] tracking-[0.18em] uppercase text-[#7a7365]">
              {String(v.duration ?? "")} min
            </div>
          </div>
        )}
      />

      <div className="font-serif italic text-[16px] sm:text-[18px] text-[#8a7346] pt-1 @[1024px]:pt-0">
        {r}.
      </div>
      <div>
        <h4 className={`font-serif font-normal text-[19px] sm:text-[24px] tracking-[-0.015em] m-0 mb-1.5 ${hidden ? "line-through" : ""}`}>
          <EditableServiceField
            serviceId={service.id}
            field="name"
            initial={service.name}
            theme="light"
            placeholder="Nazwa usługi"
          />
        </h4>
        <div className="text-[13px] sm:text-[14px] text-[#7a7365] m-0 leading-[1.55] max-w-[520px]">
          <EditableServiceField
            serviceId={service.id}
            field="description"
            initial={service.description}
            theme="light"
            placeholder="Opisz krótko, co dostaje klient..."
          />
        </div>
        <div className="@[1024px]:hidden mt-3 flex items-center gap-3 text-[10px] tracking-[0.2em] uppercase text-[#7a7365]">
          <EditableServiceField
            serviceId={service.id}
            field="duration"
            initial={String(service.duration)}
            suffix=" min"
            theme="light"
          />
          <span className="font-serif text-[16px] tracking-normal text-[#1c1a15]">
            <EditableServiceField
              serviceId={service.id}
              field="price"
              initial={String(service.price)}
              suffix=" zł"
              theme="light"
            />
          </span>
        </div>
      </div>
      <div className="hidden @[1024px]:block text-[11px] tracking-[0.2em] uppercase text-[#7a7365] whitespace-nowrap">
        <EditableServiceField
          serviceId={service.id}
          field="duration"
          initial={String(service.duration)}
          suffix=" min"
          theme="light"
        />{" · sala"}
      </div>
      <div className="hidden @[1024px]:block font-serif text-[22px] font-normal text-[#1c1a15] whitespace-nowrap">
        <em className="not-italic text-[14px] text-[#8a7346] mr-1.5 italic">od</em>
        <EditableServiceField
          serviceId={service.id}
          field="price"
          initial={String(service.price)}
          suffix=" zł"
          theme="light"
        />
      </div>
    </div>
  );
}
