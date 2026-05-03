"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackage,
  removePackage,
  togglePackageFeatured,
  updatePackageItems,
} from "./package-actions";
import { setItemHidden, setItemOrder, clearItemOverrides } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { useRefreshKeepingScroll } from "./keep-scroll";
import EditablePkgField from "./EditablePkgField";
import InlineEditable from "./InlineEditable";
import { usePreviewTransition } from "./preview-busy";
import PerItemAIPopover from "./PerItemAIPopover";
import { generatePackageVariants, applyPackageVariant } from "./ai-actions";
import type { ItemOverride } from "@/types";

type Pkg = {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period?: string;
  featured?: boolean;
};

/**
 * Edit-mode rendering of the Cinematic packages grid.
 *
 * Pixel-equivalent to the read-only block in CinematicProfile.tsx. On
 * secondary pages each card carries inline ←/→/👁 buttons in the hover
 * cluster, replacing the standalone overrides panel. Reorder + hide are
 * optimistic; server actions fire in the background.
 */
export default function CinematicPackagesEditor({
  packages,
  overrides,
}: {
  packages: Pkg[];
  overrides: Record<string, ItemOverride>;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();

  const propOrdered = !pageId
    ? packages
    : [...packages]
        .map((p, idx) => ({
          p,
          ord: typeof overrides[p.id]?.position === "number" ? overrides[p.id]!.position! : idx + 10000,
        }))
        .sort((a, b) => a.ord - b.ord)
        .map((x) => x.p);

  const [order, setOrder] = useState<Pkg[]>(propOrdered);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const p of packages) if (overrides[p.id]?.hidden) m[p.id] = true;
    return m;
  });

  const seedKey =
    propOrdered
      .map((p) => `${p.id}:${p.name}:${p.description}:${p.items.join("/")}:${p.featured ? 1 : 0}`)
      .join("|") +
    "::" +
    packages.map((p) => `${p.id}:${overrides[p.id]?.hidden ? 1 : 0}:${overrides[p.id]?.position ?? "-"}`).join(",");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(propOrdered);
    const m: Record<string, boolean> = {};
    for (const p of packages) if (overrides[p.id]?.hidden) m[p.id] = true;
    setHiddenMap(m);
  }, [seedKey, propOrdered, packages, overrides]);

  const hasAnyOverride = pageId ? Object.keys(overrides).length > 0 : false;

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
    const prev = order;
    const next = [...order];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setOrder(next);
    setItemOrder("package", next.map((p) => p.id), pageId).then((res) => {
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
    setItemHidden("package", id, nextHidden, pageId).then((res) => {
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
    setOrder(packages);
    clearItemOverrides("package", pageId).then((res) => {
      if ("error" in res) alert(res.error);
      refreshKeepingScroll();
    });
  };

  return (
    <>
      <div className="mx-auto max-w-[1440px] grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-4">
        {order.map((pkg, i) => {
          const hidden = !!hiddenMap[pkg.id];
          return (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              isFirst={i === 0}
              isLast={i === order.length - 1}
              hidden={hidden}
              showOverrideControls={!!pageId}
              onMoveUp={() => onMove(pkg.id, -1)}
              onMoveDown={() => onMove(pkg.id, 1)}
              onToggleHidden={() => onToggleHidden(pkg.id, hidden)}
            />
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          disabled={pending}
          className="rounded-[20px] p-9 flex flex-col items-center justify-center gap-3 min-h-[420px] border-2 border-dashed border-[#d4ff00]/40 bg-[#d4ff00]/[0.02] text-[#d4ff00] hover:border-[#d4ff00] hover:bg-[#d4ff00]/[0.06] transition disabled:opacity-60"
        >
          <span className="text-4xl leading-none">+</span>
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase">
            {pending ? "Dodaję..." : "Dodaj pakiet"}
          </span>
        </button>
      </div>
      {hasAnyOverride && (
        <div className="mx-auto max-w-[1440px] mt-4 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-white/50 hover:text-[#d4ff00] hover:underline transition"
          >
            Resetuj kolejność i widoczność pakietów na tej stronie
          </button>
        </div>
      )}
    </>
  );
}

function PackageCard({
  pkg,
  isFirst,
  isLast,
  hidden,
  showOverrideControls,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: {
  pkg: Pkg;
  isFirst: boolean;
  isLast: boolean;
  hidden: boolean;
  showOverrideControls: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
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
  const [aiOpen, setAiOpen] = useState(false);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div
      className={`group relative rounded-[20px] p-9 flex flex-col min-h-[420px] transition-all duration-300 ${
        pkg.featured
          ? "border border-[#d4ff00] bg-gradient-to-b from-[#d4ff00]/[0.08] to-[#d4ff00]/[0.02] shadow-[0_30px_80px_-40px_rgba(212,255,0,0.35)]"
          : "border border-white/15 bg-white/[0.025] hover:border-white/25"
      } ${hidden ? "opacity-55" : ""}`}
    >
      {/* Hover-only action cluster (top-right). On secondary pages, the
          cluster carries reorder + hide buttons before featured/delete. */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w lewo"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Przesuń w prawo"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
          type="button"
          onClick={onToggleFeatured}
          disabled={pending}
          title={pkg.featured ? "Usuń wyróżnienie" : "Wyróżnij jako Najczęściej wybierany"}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-[#d4ff00] hover:border-[#d4ff00]/60 transition"
        >
          {pkg.featured ? "⭐" : "☆"}
        </button>
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
          title="Usuń pakiet"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center hover:text-red-400 hover:border-red-400/40 transition"
        >
          🗑
        </button>
      </div>

      <PerItemAIPopover
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        itemLabel="pakiet"
        currentTitle={pkg.name}
        onGenerate={(p) => generatePackageVariants(pkg.id, p)}
        onApply={(v) =>
          applyPackageVariant(pkg.id, {
            name: String(v.name ?? ""),
            description: String(v.description ?? ""),
            items: Array.isArray(v.items) ? (v.items as string[]) : pkg.items,
          })
        }
        renderVariantPreview={(v) => (
          <div className="grid gap-2">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-violet-700">
              {String(v.name ?? "")}
            </div>
            <div className="text-[15px] tracking-[-0.02em] font-medium text-slate-900">
              {String(v.description ?? "")}
            </div>
            <ul className="grid gap-1 text-[12px] text-slate-700 mt-1 list-disc pl-4">
              {(Array.isArray(v.items) ? (v.items as string[]) : []).map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}
      />

      {pkg.featured && (
        <span className="absolute -top-3 left-9 bg-[#d4ff00] text-[#0a0a0c] font-mono text-[11px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full">
          ★ NAJCZĘŚCIEJ WYBIERANY
        </span>
      )}

      <div className={`font-mono text-[11px] tracking-[0.2em] uppercase mb-4 ${pkg.featured ? "text-[#d4ff00]" : "text-white/50"}`}>
        <EditablePkgField packageId={pkg.id} field="name" initial={pkg.name} theme="dark" placeholder="NAZWA" />
      </div>

      <div className="text-[24px] sm:text-[28px] tracking-[-0.02em] font-medium leading-[1.15] m-0 mb-4">
        <EditablePkgField
          packageId={pkg.id}
          field="description"
          initial={pkg.description}
          placeholder="Opisz pakiet jednym zdaniem..."
          theme="dark"
        />
      </div>

      <div className="flex items-baseline gap-1.5 mb-4 pb-6 border-b border-white/10 flex-wrap">
        <span
          style={{ fontSize: "clamp(28px, 4cqw, 48px)" }}
          className="font-medium tracking-[-0.03em] leading-none whitespace-nowrap"
        >
          <EditablePkgField
            packageId={pkg.id}
            field="price"
            initial={String(pkg.price)}
            theme="dark"
          />{" "}
          zł
        </span>
        <span className="font-mono text-[13px] text-white/50 whitespace-nowrap">
          /{" "}
          <EditablePkgField
            packageId={pkg.id}
            field="period"
            initial={pkg.period ?? ""}
            placeholder="miesiąc"
            theme="dark"
          />
        </span>
      </div>

      <ul className="list-none p-0 m-0 grid gap-3 mb-8">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2.5 text-[14px] text-white/70 leading-[1.45] items-start">
            <span className={`w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5 ${
              pkg.featured ? "bg-[#d4ff00] text-[#0a0a0c]" : "bg-white/10 text-[#d4ff00]"
            }`}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <InlineEditable
              key={`${pkg.id}-${idx}-${item}`}
              initial={item}
              maxLength={60}
              theme="dark"
              placeholder="Co wchodzi w skład pakietu..."
              className="flex-1 text-[14px] text-white/90 leading-[1.45]"
              onCommit={(next) => onItemCommit(idx, next)}
            />
            <button
              type="button"
              onClick={() => onItemRemove(idx)}
              className="text-white/30 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition shrink-0"
              title="Usuń pozycję"
            >
              ✕
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onItemAdd}
            className="w-full text-left text-[12px] text-[#d4ff00]/80 hover:text-[#d4ff00] font-mono uppercase tracking-[0.15em] py-1.5 px-0.5"
          >
            + Dodaj pozycję
          </button>
        </li>
      </ul>

      <button
        type="button"
        disabled
        title="Podgląd — w trybie edycji nie można rezerwować"
        className={`mt-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full text-[14px] font-medium transition cursor-not-allowed ${
          pkg.featured
            ? "bg-[#d4ff00] text-[#0a0a0c] font-semibold"
            : "border border-white/15 text-white/80"
        }`}
      >
        Wybierz {pkg.name || "pakiet"} →
      </button>
    </div>
  );
}
