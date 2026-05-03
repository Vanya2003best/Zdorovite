"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addService, removeService } from "./service-actions";
import { setItemOrder } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import EditableServiceField from "./EditableServiceField";
import EditableServiceMeta from "./EditableServiceMeta";
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
 * Cozy-styled services editor — mirrors the public Cozy services list.
 * Reorder is via on-card up/down arrows only — HTML5 drag-and-drop was
 * removed because users were dragging by accident while trying to click
 * inline-editable fields. Order persists via override-actions
 * `setItemOrder("service", …)` so the primary page writes to
 * `trainers.customization.serviceOverrides` and secondary pages write to
 * the trainer_pages row.
 */
export default function CozyServicesEditor({
  services,
  overrides,
}: {
  services: Service[];
  overrides: Record<string, ItemOverride>;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();

  const propOrdered = [...services]
    .map((s, idx) => ({
      s,
      ord: typeof overrides[s.id]?.position === "number" ? overrides[s.id]!.position! : idx + 10000,
    }))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.s);

  const [order, setOrder] = useState<Service[]>(propOrdered);

  // Content-aware so AI-apply (which rewrites name/description/duration/price
  // without touching id/order) still triggers the re-seed effect.
  const seedKey =
    propOrdered
      .map((s) => `${s.id}:${s.name}:${s.description}:${s.duration}:${s.price}`)
      .join("|") +
    "::" +
    services.map((s) => `${s.id}:${overrides[s.id]?.position ?? "-"}`).join(",");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(propOrdered);
  }, [seedKey, propOrdered]);

  const onAdd = () => {
    startTransition(async () => {
      await addService();
      router.refresh();
    });
  };

  const commitOrder = (next: Service[]) => {
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

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = order.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    commitOrder(next);
  };

  return (
    <div className="grid gap-2">
      {order.map((svc, i) => (
        <CozyServiceRow
          key={svc.id}
          service={svc}
          metaOverride={overrides[svc.id]?.meta}
          isFirst={i === 0}
          isLast={i === order.length - 1}
          onMoveUp={() => onMove(svc.id, -1)}
          onMoveDown={() => onMove(svc.id, 1)}
        />
      ))}

      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="rounded-2xl px-4 py-3 border-2 border-dashed border-orange-300/60 bg-orange-50/40 text-orange-700 font-medium flex items-center justify-center gap-2 hover:border-orange-500 hover:bg-orange-50/70 transition disabled:opacity-60"
      >
        <span className="text-base leading-none">+</span>
        <span className="text-[12px] uppercase tracking-[0.06em]">
          {pending ? "Dodaję..." : "Dodaj usługę"}
        </span>
      </button>
    </div>
  );
}

function CozyServiceRow({
  service,
  metaOverride,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  service: Service;
  metaOverride?: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
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
    <div className="group relative bg-white rounded-2xl px-4 py-3 shadow-[0_2px_8px_rgba(164,95,30,0.06)] flex justify-between items-center gap-3 transition">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#2d2418]">
          <EditableServiceField
            serviceId={service.id}
            field="name"
            initial={service.name}
          />
        </div>
        <div className="text-[11px] text-[#8a7559] mt-0.5 flex items-center gap-1 flex-wrap">
          <EditableServiceField
            serviceId={service.id}
            field="duration"
            initial={String(service.duration)}
            suffix=" min"
          />
          <span>·</span>
          <EditableServiceMeta
            serviceId={service.id}
            initial={metaOverride}
            defaultValue="sala"
          />
          {service.description && (
            <>
              <span>·</span>
              <EditableServiceField
                serviceId={service.id}
                field="description"
                initial={service.description}
                placeholder="Krótki opis..."
              />
            </>
          )}
        </div>
      </div>

      <span className="bg-[#fef3e0] text-orange-700 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
        <EditableServiceField
          serviceId={service.id}
          field="price"
          initial={String(service.price)}
          suffix=" zł"
        />
      </span>

      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        title="Przesuń wyżej"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition w-7 h-7 rounded-full bg-white border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-orange-600 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        title="Przesuń niżej"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition w-7 h-7 rounded-full bg-white border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-orange-600 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
      </button>
      <button
        ref={aiBtnRef}
        type="button"
        onClick={() => setAiOpen(true)}
        title="Przepisz AI"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition w-7 h-7 rounded-full bg-white border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-violet-600 hover:border-violet-300 shrink-0 text-base"
      >
        ✨
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        title="Usuń usługę"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition w-7 h-7 rounded-full bg-white border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-red-600 hover:border-red-300 disabled:opacity-60 shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        </svg>
      </button>

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
            <div className="text-[14px] font-medium text-[#2d2418]">{String(v.name ?? "")}</div>
            <div className="text-[12.5px] text-[#5e4f3a] leading-[1.5]">{String(v.description ?? "")}</div>
            <div className="text-[11px] text-[#8a7559]">{String(v.duration ?? "")} min</div>
          </div>
        )}
      />
    </div>
  );
}
