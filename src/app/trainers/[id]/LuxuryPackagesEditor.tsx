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

const ROMAN = ["", "i", "ii", "iii"];

/**
 * Edit-mode rendering of the Luxury packages grid (3 cards, middle featured).
 *
 * Pixel-equivalent to the read-only block in LuxuryProfile. On secondary
 * pages each card carries inline ←/→/👁 buttons in the hover cluster,
 * replacing the standalone overrides panel. Reorder + hide are optimistic.
 *
 * Visible card slot count stays at 3 (matches public render); reordering /
 * hiding lets the trainer choose WHICH 3 packages occupy the slots on this
 * specific page.
 */
export default function LuxuryPackagesEditor({
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

  // Includes content fields (name/description/items) so AI-apply or any other
  // server-side mutation that updates copy without touching id/order/hidden
  // still triggers a re-seed of local state below — otherwise the card
  // keeps showing the pre-mutation content.
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

  // Public render slices to 3; mirror that here so the editor matches the
  // public layout. Anything past slot 3 is reachable only via reorder.
  const visible = order.slice(0, 3);

  return (
    <>
      <div className="grid @[1024px]:grid-cols-3 max-w-[1100px] mx-auto gap-y-5 @[1024px]:gap-y-0">
        {visible.map((pkg, i) => {
          const hidden = !!hiddenMap[pkg.id];
          return (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              index={i}
              isLastShown={i === visible.length - 1}
              isFirst={order.findIndex((p) => p.id === pkg.id) === 0}
              isLast={order.findIndex((p) => p.id === pkg.id) === order.length - 1}
              hidden={hidden}
              showOverrideControls={!!pageId}
              onMoveUp={() => onMove(pkg.id, -1)}
              onMoveDown={() => onMove(pkg.id, 1)}
              onToggleHidden={() => onToggleHidden(pkg.id, hidden)}
            />
          );
        })}
        {order.length < 3 && (
          <button
            type="button"
            onClick={onAdd}
            disabled={pending}
            className="bg-[#f6f1e8] border-2 border-dashed border-[#8a7346]/40 hover:border-[#8a7346] p-10 sm:p-12 flex flex-col items-center justify-center gap-3 min-h-[420px] text-[#8a7346] hover:bg-[#8a7346]/[0.04] transition disabled:opacity-60"
          >
            <span className="text-3xl leading-none font-serif italic">+</span>
            <span className="font-serif text-[14px] tracking-[0.18em] uppercase">
              {pending ? "Dodaję..." : "Dodaj program"}
            </span>
          </button>
        )}
      </div>
      {hasAnyOverride && (
        <div className="max-w-[1100px] mx-auto mt-4 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-[#7a7365] hover:text-[#8a7346] hover:underline transition"
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
  index,
  isLastShown,
  isFirst,
  isLast,
  hidden,
  showOverrideControls,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: {
  pkg: Pkg;
  index: number;
  isLastShown: boolean;
  isFirst: boolean;
  isLast: boolean;
  hidden: boolean;
  showOverrideControls: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}) {
  const [items, setItems] = useState<string[]>(pkg.items);
  // Re-seed local items when the prop changes (e.g. after AI apply + router
  // refresh). Without this the card keeps showing the pre-AI items because
  // useState only consumes its initial argument on mount.
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
  const r = ROMAN[index + 1] ?? String(index + 1);

  return (
    <div
      className={`group relative flex flex-col gap-6 ${
        featured
          ? "bg-[#1c1a15] text-[#fbf8f1] p-12 @[1024px]:p-12 @[1024px]:py-[68px] @[1024px]:my-[-20px] shadow-[0_24px_60px_-20px_rgba(28,26,21,0.4)]"
          : "bg-[#f6f1e8] p-10 sm:p-12"
      } ${!featured && !isLastShown ? "@[1024px]:border-r border-[#d9cfb8]" : ""} ${hidden ? "opacity-55" : ""}`}
    >
      {/* Hover-only action cluster (top-right). On secondary pages the cluster
          carries reorder + hide buttons in addition to feature/delete. */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w lewo"
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed ${
            featured
              ? "bg-[#fbf8f1]/10 border-[#fbf8f1]/15 text-[#fbf8f1]/70 hover:text-[#b39668] hover:border-[#b39668]/60"
              : "bg-white border-[#d9cfb8] text-[#7a7365] hover:text-[#8a7346] hover:border-[#8a7346]/60"
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
              ? "bg-[#fbf8f1]/10 border-[#fbf8f1]/15 text-[#fbf8f1]/70 hover:text-[#b39668] hover:border-[#b39668]/60"
              : "bg-white border-[#d9cfb8] text-[#7a7365] hover:text-[#8a7346] hover:border-[#8a7346]/60"
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
                hidden
                  ? featured
                    ? "bg-[#fbf8f1]/10 border-[#b39668]/60 text-[#b39668]"
                    : "bg-white border-[#8a7346]/60 text-[#8a7346]"
                  : featured
                    ? "bg-[#fbf8f1]/10 border-[#fbf8f1]/15 text-[#fbf8f1]/70 hover:text-[#b39668] hover:border-[#b39668]/60"
                    : "bg-white border-[#d9cfb8] text-[#7a7365] hover:text-[#8a7346] hover:border-[#8a7346]/60"
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
          title={featured ? "Usuń wyróżnienie" : "Wyróżnij jako Najczęściej wybierany"}
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
            featured
              ? "bg-[#fbf8f1]/10 border-[#fbf8f1]/15 text-[#fbf8f1]/70 hover:text-[#b39668] hover:border-[#b39668]/60"
              : "bg-white border-[#d9cfb8] text-[#7a7365] hover:text-[#8a7346] hover:border-[#8a7346]/60"
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
              ? "bg-[#fbf8f1]/10 border-[#fbf8f1]/15 text-[#fbf8f1]/70 hover:text-violet-300 hover:border-violet-300/60"
              : "bg-white border-[#d9cfb8] text-[#7a7365] hover:text-violet-700 hover:border-violet-400/60"
          }`}
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń program"
          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
            featured
              ? "bg-[#fbf8f1]/10 border-[#fbf8f1]/15 text-[#fbf8f1]/70 hover:text-red-400 hover:border-red-400/40"
              : "bg-white border-[#d9cfb8] text-[#7a7365] hover:text-red-700 hover:border-red-700/40"
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
            <div className="font-serif text-[16px] tracking-[-0.01em] text-[#1c1a15]">
              {String(v.name ?? "")}
            </div>
            <div className="text-[12.5px] text-[#5a5447] leading-[1.5]">
              {String(v.description ?? "")}
            </div>
            <ul className="grid gap-1 text-[12px] text-[#1c1a15] mt-1 list-disc pl-4">
              {(Array.isArray(v.items) ? (v.items as string[]) : []).map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}
      />

      {featured && (
        <span className="absolute top-6 right-6 font-serif italic font-light text-[13px] text-[#b39668] pointer-events-none group-hover:opacity-0 transition">
          Najczęściej wybierany
        </span>
      )}

      <div className={`text-[11px] tracking-[0.24em] uppercase font-medium ${featured ? "text-[#b39668]" : "text-[#8a7346]"}`}>
        Program {r}.
      </div>
      <div className="font-serif font-light text-[30px] sm:text-[38px] leading-[1.1] tracking-[-0.02em] -mt-2">
        <EditablePkgField
          packageId={pkg.id}
          field="name"
          initial={pkg.name}
          theme={featured ? "dark" : "light"}
          placeholder="Nazwa programu"
        />
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={`font-serif font-light text-[36px] sm:text-[44px] tracking-[-0.02em] leading-none whitespace-nowrap ${featured ? "text-[#fbf8f1]" : "text-[#1c1a15]"}`}>
          <EditablePkgField
            packageId={pkg.id}
            field="price"
            initial={String(pkg.price)}
            theme={featured ? "dark" : "light"}
          />{" zł"}
        </span>
        <span className={`text-[12px] tracking-[0.15em] uppercase whitespace-nowrap ${featured ? "text-[#fbf8f1]/55" : "text-[#7a7365]"}`}>
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
      <div className={`font-serif font-light italic text-[14px] leading-[1.65] ${featured ? "text-[#fbf8f1]/75" : "text-[#7a7365]"}`}>
        <EditablePkgField
          packageId={pkg.id}
          field="description"
          initial={pkg.description}
          theme={featured ? "dark" : "light"}
          placeholder="Krótki opis programu..."
        />
      </div>
      <div className={`h-px ${featured ? "bg-[#fbf8f1]/15" : "bg-[#d9cfb8]"}`} />
      <ul className="list-none p-0 m-0 grid gap-3.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`flex gap-3 items-start text-[13px] sm:text-[14px] leading-[1.5] ${featured ? "text-[#fbf8f1]/75" : "text-[#3a3730]"}`}
          >
            <span
              className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0 mt-0.5 border ${featured ? "border-[#b39668] text-[#b39668]" : "border-[#8a7346] text-[#8a7346]"}`}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <InlineEditable
              key={`${pkg.id}-${idx}-${item}`}
              initial={item}
              maxLength={80}
              theme={featured ? "dark" : "light"}
              placeholder="Co wchodzi w skład programu..."
              className="flex-1"
              onCommit={(next) => onItemCommit(idx, next)}
            />
            <button
              type="button"
              onClick={() => onItemRemove(idx)}
              className={`text-sm opacity-0 group-hover:opacity-100 transition shrink-0 ${featured ? "text-[#fbf8f1]/30 hover:text-red-400" : "text-[#7a7365]/40 hover:text-red-700"}`}
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
            className={`w-full text-left text-[12px] tracking-[0.18em] uppercase py-1.5 px-0.5 transition ${featured ? "text-[#b39668]/80 hover:text-[#b39668]" : "text-[#8a7346]/80 hover:text-[#8a7346]"}`}
          >
            + Dodaj pozycję
          </button>
        </li>
      </ul>

      <button
        type="button"
        disabled
        title="Podgląd — w trybie edycji nie można rezerwować"
        className={`mt-auto inline-flex items-center justify-center h-12 px-6 text-[12px] tracking-[0.18em] uppercase font-medium transition cursor-not-allowed ${
          featured
            ? "bg-[#fbf8f1] text-[#1c1a15]"
            : "border border-[#1c1a15] text-[#1c1a15]"
        }`}
      >
        Wybierz program
      </button>
    </div>
  );
}
