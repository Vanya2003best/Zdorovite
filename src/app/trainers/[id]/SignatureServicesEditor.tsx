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

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * Edit-mode rendering of the Signature services list.
 *
 * Pixel-equivalent to the read-only "book of" §I-V row layout in
 * SignatureProfile.tsx. On secondary pages (pageId set), each row also exposes
 * inline ↑/↓ reorder and 👁 hide buttons that write to the page's override map
 * — replacing the old standalone "Widoczność i kolejność" panel which used to
 * live below the list. Hidden items stay rendered (greyed out + line-through)
 * so the trainer can un-hide them.
 *
 * Receives the RAW master service list (not pre-filtered by overrides), since
 * we need to be able to display + un-hide entries that the page has hidden.
 * Display values (name/description/price) ARE override-applied for visual
 * fidelity with the read-only rendering.
 */
export default function SignatureServicesEditor({
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

  // Sort by override.position when on a secondary page; items without an
  // explicit position keep their master order (large offset → end). On the
  // primary page (no pageId) we ignore overrides entirely and show master order.
  const propOrdered = !pageId
    ? services
    : [...services]
        .map((s, idx) => ({
          s,
          ord: typeof overrides[s.id]?.position === "number" ? overrides[s.id]!.position! : idx + 10000,
        }))
        .sort((a, b) => a.ord - b.ord)
        .map((x) => x.s);

  // Optimistic local state for both order and per-item hidden flag. We mirror
  // server-derived values into local state on first render and any time the
  // upstream identity set changes (service added/removed). Reorder + hide
  // clicks update local state INSTANTLY for snappy feedback, then fire the
  // server action in the background; on error we roll back to the pre-click
  // snapshot. Without this every click waited for setItemOrder + router.refresh
  // (~500–1000ms in dev), which felt sluggish during multi-step reorders.
  const [order, setOrder] = useState<Service[]>(propOrdered);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const s of services) if (overrides[s.id]?.hidden) m[s.id] = true;
    return m;
  });

  // Re-seed from props whenever the upstream identity OR override map changes
  // — covers: new service added, service deleted, undo, reset. We compare by
  // a content-aware key so unrelated re-renders don't stomp local edits.
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
    setOrder(next); // instant UI
    setItemOrder("service", next.map((s) => s.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setOrder(prev); // rollback
      } else {
        refreshKeepingScroll();
      }
    });
  };

  const onToggleHidden = (id: string, currentlyHidden: boolean) => {
    if (!pageId) return;
    const nextHidden = !currentlyHidden;
    setHiddenMap((m) => ({ ...m, [id]: nextHidden })); // instant UI
    setItemHidden("service", id, nextHidden, pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setHiddenMap((m) => ({ ...m, [id]: currentlyHidden })); // rollback
      } else {
        refreshKeepingScroll();
      }
    });
  };

  const onResetOverrides = () => {
    if (!pageId) return;
    // Optimistic: clear local hidden + restore master order immediately.
    setHiddenMap({});
    setOrder(services);
    clearItemOverrides("service", pageId).then((res) => {
      if ("error" in res) alert(res.error);
      // No rollback for reset — if it failed, user can re-click; the props
      // re-seed will eventually correct local state on next refresh.
      refreshKeepingScroll();
    });
  };

  return (
    <div>
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
            pending={pending}
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
        className="grid grid-cols-[40px_1fr] @[640px]:grid-cols-[60px_1fr_1fr_140px_120px] @[1024px]:grid-cols-[80px_1fr_1fr_200px_160px] gap-4 @[640px]:gap-6 @[1024px]:gap-8 items-center py-6 @[640px]:py-8 border-y-2 border-dashed border-[#7d1f1f]/30 hover:border-[#7d1f1f] hover:pl-4 transition-all w-full text-left disabled:opacity-60 text-[#7d1f1f]"
      >
        <div className="font-mono text-[12px] @[640px]:text-[13px] tracking-[0.08em] font-medium">§ +++</div>
        <div className="text-[18px] @[640px]:text-[22px] @[1024px]:text-[26px] tracking-[-0.02em] font-normal leading-[1.15]">
          {pending ? "Dodaję..." : "+ Dodaj usługę"}
        </div>
      </button>

      {/* Tiny reset link — only shown on a secondary page when at least one
          service has an override. Mirrors the old PageOverridesPanel's
          "Resetuj" affordance but discreet enough not to compete with the
          editor itself. */}
      {hasAnyOverride && (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            disabled={pending}
            className="text-[11px] text-[#7d7268] hover:text-[#7d1f1f] hover:underline transition disabled:opacity-50"
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
  pending,
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
  pending: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}) {
  const [delPending, startDelTransition] = usePreviewTransition();
  const router = useRouter();
  const [aiOpen, setAiOpen] = useState(false);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  const onDelete = () => {
    startDelTransition(async () => {
      await removeService(service.id);
      router.refresh();
    });
  };

  const r = ROMAN[index + 1] ?? String(index + 1);

  return (
    <div
      className={`group relative grid grid-cols-[40px_1fr] @[640px]:grid-cols-[60px_1fr_1fr_140px_120px] @[1024px]:grid-cols-[80px_1fr_1fr_200px_160px] gap-4 @[640px]:gap-6 @[1024px]:gap-8 items-start @[640px]:items-center py-6 @[640px]:py-8 border-t border-[#e4dccf] last:border-b last:border-[#e4dccf] hover:pl-4 transition-all ${
        hidden ? "opacity-55" : ""
      }`}
    >
      {/* Hover-revealed control strip — top-right. On secondary pages this
          carries reorder + hide controls in addition to delete; on primary
          it's just delete. Each button is its own focusable target so
          keyboard reorder works too. */}
      <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={pending || isFirst}
          title="Przesuń w górę"
          className="w-8 h-8 rounded-full bg-white border border-[#e4dccf] text-[#7d7268] inline-flex items-center justify-center hover:text-[#7d1f1f] hover:border-[#7d1f1f]/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={pending || isLast}
          title="Przesuń w dół"
          className="w-8 h-8 rounded-full bg-white border border-[#e4dccf] text-[#7d7268] inline-flex items-center justify-center hover:text-[#7d1f1f] hover:border-[#7d1f1f]/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </button>
        {showOverrideControls && (
          <>
            <button
              type="button"
              onClick={onToggleHidden}
              disabled={pending}
              title={hidden ? "Pokaż na tej stronie" : "Ukryj na tej stronie"}
              className={`w-8 h-8 rounded-full bg-white border inline-flex items-center justify-center transition disabled:opacity-50 ${
                hidden
                  ? "border-[#7d1f1f]/40 text-[#7d1f1f] hover:bg-[#7d1f1f]/5"
                  : "border-[#e4dccf] text-[#7d7268] hover:text-[#7d1f1f] hover:border-[#7d1f1f]/40"
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
          className="w-8 h-8 rounded-full bg-white border border-[#e4dccf] text-[#7d7268] inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-400/60 transition text-base"
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={delPending}
          title="Usuń usługę"
          className="w-8 h-8 rounded-full bg-white border border-[#e4dccf] text-[#7d7268] inline-flex items-center justify-center hover:text-red-700 hover:border-red-700/40 transition disabled:opacity-60"
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
            <div className="text-[15px] tracking-[-0.015em]">{String(v.name ?? "")}</div>
            <div className="text-[12.5px] text-[#7d7268] leading-[1.5]">{String(v.description ?? "")}</div>
            <div className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-[#7d1f1f]">{String(v.duration ?? "")} min</div>
          </div>
        )}
      />

      <div className="font-mono text-[12px] @[640px]:text-[13px] text-[#7d1f1f] tracking-[0.08em] font-medium pt-1 @[640px]:pt-0">
        § {r}
      </div>
      <div>
        <div className={`text-[18px] @[640px]:text-[22px] @[1024px]:text-[26px] tracking-[-0.02em] font-normal leading-[1.15] ${hidden ? "line-through" : ""}`}>
          <EditableServiceField
            serviceId={service.id}
            field="name"
            initial={service.name}
            theme="light"
            placeholder="Nazwa usługi"
          />
        </div>
        <div className="@[640px]:hidden text-[13px] text-[#7d7268] mt-2 leading-[1.5]">
          <EditableServiceField
            serviceId={service.id}
            field="description"
            initial={service.description}
            theme="light"
            placeholder="Dodaj opis..."
          />
        </div>
        <div className="@[640px]:hidden font-mono text-[11px] text-[#7d7268] tracking-[0.08em] uppercase mt-2">
          <EditableServiceField
            serviceId={service.id}
            field="duration"
            initial={String(service.duration)}
            suffix=" min"
            theme="light"
          />{" · od "}
          <EditableServiceField
            serviceId={service.id}
            field="price"
            initial={String(service.price)}
            suffix=" zł"
            theme="light"
          />
        </div>
      </div>
      <div className="hidden @[640px]:block text-[14px] text-[#7d7268] leading-[1.5]">
        <EditableServiceField
          serviceId={service.id}
          field="description"
          initial={service.description}
          theme="light"
          placeholder="Dodaj opis..."
        />
      </div>
      <div className="hidden @[640px]:block font-mono text-[11px] text-[#7d7268] tracking-[0.08em] uppercase">
        <EditableServiceField
          serviceId={service.id}
          field="duration"
          initial={String(service.duration)}
          suffix=" min"
          theme="light"
        />{" · studio"}
      </div>
      <div className="hidden @[640px]:block text-right text-[20px] @[1024px]:text-[22px] tracking-[-0.015em] font-medium">
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
