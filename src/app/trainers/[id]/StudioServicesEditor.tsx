"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addService, removeService } from "./service-actions";
import { setItemHidden, setItemOrder, clearItemOverrides } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor, useRefreshKeepingScroll } from "./keep-scroll";
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

/** Numbered glyph for the service tile — "01", "02", … padded to 2 digits.
 *  Matches Studio's editorial numbered-section identity (01 / Kim jestem,
 *  02 / Prace, …). */
function indexGlyph(i: number): string {
  return String(i + 1).padStart(2, "0");
}

/**
 * Edit-mode rendering of the Studio services chip grid (2 cols).
 *
 * Pixel-equivalent to the read-only block in StudioProfile: bordered cards
 * with an orange-on-cream icon tile, name + description + duration/price
 * meta strip with a top hairline divider. Hover reveals the override cluster
 * (↑/↓/👁 for secondary pages, plus 🗑) in the top-right.
 *
 * Receives the RAW master service list so hidden rows remain visible — same
 * pattern as the other template editors. Optimistic local state for order +
 * hidden flags; refresh wraps router.refresh in scroll-preserving rAF loop.
 */
export default function StudioServicesEditor({
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
    pinScrollFor(1500);
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
    pinScrollFor(1500);
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
      <div className="grid @[640px]:grid-cols-2 gap-4">
        {order.map((svc, i) => {
          const hidden = !!hiddenMap[svc.id];
          return (
            <ServiceCard
              key={svc.id}
              service={svc}
              index={i}
              metaOverride={overrides[svc.id]?.meta}
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
          className="bg-white border-2 border-dashed border-[#ff5722]/30 rounded-[20px] p-7 flex flex-col gap-3.5 items-start hover:border-[#ff5722] hover:bg-[#ffeadb]/40 transition disabled:opacity-60 text-left text-[#ff5722]"
        >
          <div className="flex gap-3 items-center">
            <div className="w-11 h-11 rounded-xl bg-[#ffeadb] text-[#ff5722] inline-flex items-center justify-center text-[22px]">+</div>
            <div className="text-[20px] tracking-[-0.015em] font-medium">{pending ? "Dodaję..." : "Dodaj usługę"}</div>
          </div>
          <div className="text-[13px] text-[#77756f] leading-[1.55]">
            Każda usługa to oddzielna kategoria — sesja, konsultacja, ocena.
          </div>
        </button>
      </div>
      {hasAnyOverride && (
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-[#77756f] hover:text-[#ff5722] hover:underline transition"
          >
            Resetuj kolejność i widoczność usług na tej stronie
          </button>
        </div>
      )}
    </>
  );
}

function ServiceCard({
  service,
  index,
  metaOverride,
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
  metaOverride?: string;
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
    <div className={`group relative bg-white border border-[#e8e6df] rounded-[20px] p-7 flex flex-col gap-3.5 hover:border-[#141413] transition ${hidden ? "opacity-55" : ""}`}>
      {/* Hover-only override + delete cluster — anchored above the card so
          the chip row doesn't overlap the service title text. -translate-y
          shifts it just outside the card border. */}
      <div className="absolute -top-4 right-3 z-10 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w lewo"
          className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-[#ff5722] hover:border-[#ff5722]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Przesuń w prawo"
          className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-[#ff5722] hover:border-[#ff5722]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
        {showOverrideControls && (
          <>
            <button
              type="button"
              onClick={onToggleHidden}
              title={hidden ? "Pokaż na tej stronie" : "Ukryj na tej stronie"}
              className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
                hidden
                  ? "bg-white border-[#ff5722]/60 text-[#ff5722]"
                  : "bg-white border-[#e8e6df] text-[#77756f] hover:text-[#ff5722] hover:border-[#ff5722]/60"
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
          className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-violet-700 hover:border-violet-400/60 transition text-base"
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń usługę"
          className="w-8 h-8 rounded-full bg-white border border-[#e8e6df] text-[#77756f] inline-flex items-center justify-center hover:text-red-600 hover:border-red-600/40 transition disabled:opacity-60"
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
            <div className="text-[15px] font-medium text-[#141413] tracking-[-0.01em]">{String(v.name ?? "")}</div>
            <div className="text-[12.5px] text-[#3d3d3a] leading-[1.5]">{String(v.description ?? "")}</div>
            <div className="text-[11px] text-[#77756f]">{String(v.duration ?? "")} min</div>
          </div>
        )}
      />

      <div className="flex gap-3 items-center">
        {/* Numbered glyph — "01", "02", … in the same orange tile. Italic +
            tabular-nums + tight tracking → editorial "monogram" feel. */}
        <div
          className="w-11 h-11 rounded-xl bg-[#ffeadb] text-[#ff5722] inline-flex items-center justify-center shrink-0 font-semibold italic tabular-nums"
          style={{ fontSize: 18, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {indexGlyph(index)}
        </div>
        <div className={`text-[20px] tracking-[-0.015em] font-medium ${hidden ? "line-through" : ""}`}>
          <EditableServiceField
            serviceId={service.id}
            field="name"
            initial={service.name}
            theme="light"
            placeholder="Nazwa usługi"
          />
        </div>
      </div>
      <div className="text-[14px] text-[#3d3d3a] leading-[1.55]">
        <EditableServiceField
          serviceId={service.id}
          field="description"
          initial={service.description}
          theme="light"
          placeholder="Krótko opisz usługę..."
        />
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-[#e8e6df] mt-auto gap-3 flex-wrap">
        <span className="text-[12px] text-[#77756f] inline-flex items-center gap-1">
          <EditableServiceField
            serviceId={service.id}
            field="duration"
            initial={String(service.duration)}
            suffix=" min · "
            theme="light"
          />
          <EditableServiceMeta
            serviceId={service.id}
            initial={metaOverride}
            defaultValue="sala"
          />
        </span>
        <span className="text-[18px] font-semibold tracking-[-0.01em]">
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
  );
}
