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
import { pinScrollFor, useRefreshKeepingScroll } from "./keep-scroll";
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

const TIER_DEFAULTS = ["Start", "Powrót do gry", "Performance"];

/**
 * Edit-mode rendering of the Studio packages grid (3 cols, middle dark when
 * featured). Each card carries inline ←/→/👁 + ⭐/🗑 in the hover cluster.
 * Optimistic local state for order + hidden — same pattern as the rest.
 */
export default function StudioPackagesEditor({
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
    pinScrollFor(1500);
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
    pinScrollFor(1500);
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
      <div className="grid @[1024px]:grid-cols-3 gap-4">
        {order.map((pkg, i) => {
          const hidden = !!hiddenMap[pkg.id];
          return (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              tierLabel={TIER_DEFAULTS[i] ?? `Tier ${i + 1}`}
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
          className="bg-white border-2 border-dashed border-[#ff5722]/30 rounded-[24px] p-8 flex flex-col items-center justify-center gap-3 min-h-[420px] text-[#ff5722] hover:border-[#ff5722] hover:bg-[#ffeadb]/40 transition disabled:opacity-60"
        >
          <span className="text-4xl leading-none">+</span>
          <span className="text-[13px] font-semibold tracking-[0.04em] uppercase">
            {pending ? "Dodaję..." : "Dodaj pakiet"}
          </span>
        </button>
      </div>
      {hasAnyOverride && (
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-[#77756f] hover:text-[#ff5722] hover:underline transition"
          >
            Resetuj kolejność i widoczność programów na tej stronie
          </button>
        </div>
      )}
    </>
  );
}

function PackageCard({
  pkg,
  tierLabel,
  isFirst,
  isLast,
  hidden,
  showOverrideControls,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: {
  pkg: Pkg;
  tierLabel: string;
  isFirst: boolean;
  isLast: boolean;
  hidden: boolean;
  showOverrideControls: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}) {
  const [items, setItems] = useState<string[]>(pkg.items);
  // Re-seed local items when prop changes (AI apply, undo, etc.)
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

  const featured = !!pkg.featured;

  return (
    <div
      className={`group relative rounded-[24px] p-8 flex flex-col gap-4.5 transition ${
        featured
          ? "bg-[#141413] text-white border border-[#141413]"
          : "bg-white border border-[#e8e6df]"
      } ${hidden ? "opacity-55" : ""}`}
    >
      {/* Hover-only action cluster */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w lewo"
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed ${
            featured
              ? "bg-white/10 border-white/15 text-white/70 hover:text-[#dbff3c] hover:border-[#dbff3c]/60"
              : "bg-white border-[#e8e6df] text-[#77756f] hover:text-[#ff5722] hover:border-[#ff5722]/60"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Przesuń w prawo"
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed ${
            featured
              ? "bg-white/10 border-white/15 text-white/70 hover:text-[#dbff3c] hover:border-[#dbff3c]/60"
              : "bg-white border-[#e8e6df] text-[#77756f] hover:text-[#ff5722] hover:border-[#ff5722]/60"
          }`}
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
                featured
                  ? hidden
                    ? "bg-white/10 border-[#dbff3c]/60 text-[#dbff3c]"
                    : "bg-white/10 border-white/15 text-white/70 hover:text-[#dbff3c] hover:border-[#dbff3c]/60"
                  : hidden
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
          type="button"
          onClick={onToggleFeatured}
          disabled={pending}
          title={featured ? "Usuń wyróżnienie" : "Wyróżnij jako Polecany"}
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
            featured
              ? "bg-white/10 border-white/15 text-white/70 hover:text-[#dbff3c] hover:border-[#dbff3c]/60"
              : "bg-white border-[#e8e6df] text-[#77756f] hover:text-[#ff5722] hover:border-[#ff5722]/60"
          }`}
        >
          {featured ? "⭐" : "☆"}
        </button>
        <button
          ref={aiBtnRef}
          type="button"
          onClick={() => setAiOpen(true)}
          title="Przepisz AI"
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition text-base ${
            featured
              ? "bg-white/10 border-white/15 text-white/70 hover:text-violet-300 hover:border-violet-300/60"
              : "bg-white border-[#e8e6df] text-[#77756f] hover:text-violet-700 hover:border-violet-400/60"
          }`}
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń pakiet"
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
            featured
              ? "bg-white/10 border-white/15 text-white/70 hover:text-red-400 hover:border-red-400/40"
              : "bg-white border-[#e8e6df] text-[#77756f] hover:text-red-600 hover:border-red-600/40"
          }`}
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
            <div className="text-[16px] font-medium tracking-[-0.015em] text-[#141413]">{String(v.name ?? "")}</div>
            <div className="text-[12.5px] text-[#3d3d3a] leading-[1.5]">{String(v.description ?? "")}</div>
            <ul className="grid gap-1 text-[12px] text-[#141413] mt-1 list-disc pl-4">
              {(Array.isArray(v.items) ? (v.items as string[]) : []).map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}
      />

      {featured && (
        <span className="absolute top-5 right-5 px-2.5 py-[5px] rounded-full bg-[#dbff3c] text-[#141413] text-[11px] font-semibold inline-flex items-center gap-[5px] pointer-events-none group-hover:opacity-0 transition">
          ★ Polecany
        </span>
      )}

      <div className={`text-[13px] tracking-[0.04em] uppercase font-semibold ${featured ? "text-[#dbff3c]" : "text-[#ff5722]"}`}>
        {tierLabel}
      </div>
      <div className="text-[30px] tracking-[-0.025em] font-medium leading-none -mt-1">
        <EditablePkgField
          packageId={pkg.id}
          field="name"
          initial={pkg.name}
          theme={featured ? "dark" : "light"}
          placeholder="Nazwa pakietu"
        />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[42px] tracking-[-0.03em] font-medium leading-none">
          <EditablePkgField
            packageId={pkg.id}
            field="price"
            initial={String(pkg.price)}
            theme={featured ? "dark" : "light"}
          />{" zł"}
        </span>
        <span className={`text-[13px] ${featured ? "text-white/50" : "text-[#77756f]"}`}>
          /{" "}
          <EditablePkgField
            packageId={pkg.id}
            field="period"
            initial={pkg.period ?? ""}
            theme={featured ? "dark" : "light"}
            placeholder="miesiąc"
          />
        </span>
      </div>
      <div className={`text-[14px] leading-[1.55] ${featured ? "text-white/70" : "text-[#3d3d3a]"}`}>
        <EditablePkgField
          packageId={pkg.id}
          field="description"
          initial={pkg.description}
          theme={featured ? "dark" : "light"}
          placeholder="Krótki opis pakietu..."
        />
      </div>
      <div className={`h-px ${featured ? "bg-white/15" : "bg-[#e8e6df]"}`} />
      <ul className="list-none p-0 m-0 grid gap-2.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`flex gap-2.5 items-start text-[14px] leading-[1.45] ${featured ? "text-white/85" : "text-[#3d3d3a]"}`}
          >
            <span
              className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0 mt-[1px] ${
                featured ? "bg-[#dbff3c] text-[#141413]" : "bg-[#ffeadb] text-[#ff5722]"
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <InlineEditable
              key={`${pkg.id}-${idx}-${item}`}
              initial={item}
              maxLength={80}
              theme={featured ? "dark" : "light"}
              placeholder="Co wchodzi w skład pakietu..."
              className="flex-1"
              onCommit={(next) => onItemCommit(idx, next)}
            />
            <button
              type="button"
              onClick={() => onItemRemove(idx)}
              className={`text-sm opacity-0 group-hover:opacity-100 transition shrink-0 ${
                featured ? "text-white/30 hover:text-red-400" : "text-[#77756f]/50 hover:text-red-600"
              }`}
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
            className={`w-full text-left text-[12px] py-1 px-0.5 transition ${
              featured ? "text-[#dbff3c]/80 hover:text-[#dbff3c]" : "text-[#ff5722]/80 hover:text-[#ff5722]"
            }`}
          >
            + Dodaj pozycję
          </button>
        </li>
      </ul>

      <button
        type="button"
        disabled
        title="Podgląd — w trybie edycji nie można rezerwować"
        className={`mt-auto inline-flex justify-center items-center h-11 px-5 rounded-full text-[14px] font-medium transition cursor-not-allowed ${
          featured
            ? "bg-[#ff5722] text-white border border-[#ff5722]"
            : "bg-transparent text-[#141413] border border-[#d4d1c7]"
        }`}
      >
        Wybierz →
      </button>
    </div>
  );
}
