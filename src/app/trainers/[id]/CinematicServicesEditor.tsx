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

/**
 * Edit-mode rendering of the Cinematic services list.
 *
 * Pixel-equivalent to the read-only block in CinematicProfile.tsx. On
 * secondary pages (pageId set) each row also exposes inline ↑/↓/👁 buttons
 * in the hover cluster, replacing the standalone "Widoczność i kolejność"
 * panel. Reorder + hide are optimistic — local state updates instantly and
 * the server action fires in the background.
 *
 * Receives the RAW master service list (un-filtered) so hidden rows remain
 * visible in the editor. Display values stay master-sourced (no override
 * application here) — same as the rest of the inline editor surface.
 */
export default function CinematicServicesEditor({
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

  // Content-aware so AI rewrites surface without an id/order change.
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
    <>
      <div className="grid gap-px bg-white/10 border-y border-white/10 mt-10">
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
          className="bg-[#0a0a0c] grid grid-cols-[60px_minmax(0,1fr)_auto] @[640px]:grid-cols-[120px_minmax(0,1fr)] gap-4 @[640px]:gap-8 items-center py-7 @[640px]:py-9 px-2 hover:px-4 @[640px]:hover:px-6 transition-all border-2 border-dashed border-[#d4ff00]/30 hover:border-[#d4ff00] disabled:opacity-60 text-left"
        >
          <span className="font-mono text-[12px] sm:text-[13px] text-[#d4ff00] tracking-[0.1em]">/ +++</span>
          <span className="text-[18px] sm:text-[22px] tracking-[-0.02em] font-medium leading-tight text-[#d4ff00]">
            {pending ? "Dodaję..." : "+ Dodaj usługę"}
          </span>
        </button>
      </div>
      {hasAnyOverride && (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-white/50 hover:text-[#d4ff00] hover:underline transition"
          >
            Resetuj kolejność i widoczność usług na tej stronie
          </button>
        </div>
      )}
    </>
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

  return (
    <div className={`group relative bg-[#0a0a0c] grid grid-cols-[60px_minmax(0,1fr)_auto] @[640px]:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_180px] gap-4 @[640px]:gap-8 items-center py-7 @[640px]:py-9 px-2 ${hidden ? "opacity-55" : ""}`}>
      {/* Hover-only control cluster — top-right */}
      <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w górę"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Przesuń w dół"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                  ? "bg-white/5 border-[#d4ff00]/60 text-[#d4ff00]"
                  : "bg-white/5 border-white/15 text-white/70 hover:text-[#d4ff00] hover:border-[#d4ff00]/60"
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
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-violet-300 hover:border-violet-300/60 transition text-base"
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń usługę"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-60"
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
            <div className="text-[15px] font-medium tracking-[-0.01em]">{String(v.name ?? "")}</div>
            <div className="text-[12.5px] text-slate-700 leading-[1.5]">{String(v.description ?? "")}</div>
            <div className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-slate-500">{String(v.duration ?? "")} min</div>
          </div>
        )}
      />

      <div className="font-mono text-[12px] sm:text-[13px] text-white/50 tracking-[0.1em]">
        / {String(index + 1).padStart(3, "0")}
      </div>
      <div
        style={{ fontSize: "clamp(14px, 2cqw, 28px)" }}
        className={`tracking-[-0.02em] font-medium leading-tight ${hidden ? "line-through" : ""}`}
      >
        <EditableServiceField
          serviceId={service.id}
          field="name"
          initial={service.name}
          theme="dark"
          placeholder="Nazwa usługi"
        />
      </div>
      <div
        style={{ fontSize: "clamp(11px, 1.2cqw, 14px)" }}
        className="hidden @[640px]:block text-white/70 leading-[1.55]"
      >
        <EditableServiceField
          serviceId={service.id}
          field="description"
          initial={service.description}
          placeholder="Dodaj opis..."
          theme="dark"
        />
      </div>
      <div className="text-right flex flex-col gap-0.5 shrink-0 pr-10">
        <div
          style={{ fontSize: "clamp(14px, 1.8cqw, 26px)" }}
          className="tracking-[-0.02em] font-medium"
        >
          <EditableServiceField
            serviceId={service.id}
            field="price"
            initial={String(service.price)}
            suffix=" zł"
            theme="dark"
          />
        </div>
        <div className="font-mono text-[10px] @[640px]:text-[11px] text-white/50 tracking-[0.08em] uppercase">
          <EditableServiceField
            serviceId={service.id}
            field="duration"
            initial={String(service.duration)}
            suffix=" min"
            theme="dark"
          />
        </div>
      </div>
    </div>
  );
}
