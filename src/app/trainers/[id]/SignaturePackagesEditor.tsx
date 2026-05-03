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
import EditableSigCopy from "./EditableSigCopy";
import { usePreviewTransition } from "./preview-busy";
import PerItemAIPopover from "./PerItemAIPopover";
import { generatePackageVariants, applyPackageVariant } from "./ai-actions";
import InlineEditable from "./InlineEditable";
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

const TIER_DEFAULTS = ["Bronze", "Silver", "Gold"];

/**
 * Edit-mode rendering of the Signature membership tiers grid.
 *
 * Pixel-equivalent to the read-only Bronze / Silver / Gold dark cards. On
 * secondary pages (pageId set) each card also carries inline ↑/↓/👁 buttons
 * in the hover cluster, replacing the standalone "Widoczność i kolejność"
 * panel that used to sit below the grid. Hidden tiers stay rendered (greyed
 * out) so they can be un-hidden.
 *
 * Reorder + hide are optimistic: local state updates instantly on click and
 * the server action fires in the background. Without this, every click had
 * to wait ~500–1000ms for setItemOrder + router.refresh, which felt sluggish
 * during multi-step reorders.
 *
 * Receives the RAW master package list (un-filtered) so hidden cards remain
 * visible in the editor.
 */
export default function SignaturePackagesEditor({
  packages,
  tierLabels,
  overrides,
}: {
  packages: Pkg[];
  /** Already-resolved labels (signatureCopy override → fallback). Length 3.
   *  Indexed by card slot. Editing dispatches signature-copy actions for the
   *  matching tierNLabel field. */
  tierLabels: string[];
  overrides: Record<string, ItemOverride>;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();

  // Sort by override.position only on a secondary page; on primary the
  // overrides are pointless and we render master order.
  const propOrdered = !pageId
    ? packages
    : [...packages]
        .map((p, idx) => ({
          p,
          ord: typeof overrides[p.id]?.position === "number" ? overrides[p.id]!.position! : idx + 10000,
        }))
        .sort((a, b) => a.ord - b.ord)
        .map((x) => x.p);

  // Optimistic local state mirrored from props. See SignatureServicesEditor
  // for the full rationale — same pattern, both fields tracked in parallel.
  const [order, setOrder] = useState<Pkg[]>(propOrdered);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const p of packages) if (overrides[p.id]?.hidden) m[p.id] = true;
    return m;
  });

  // Re-seed when upstream identity OR overrides change (add/remove/undo/reset).
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
      <div className="max-w-[1340px] mx-auto grid @[1024px]:grid-cols-3 gap-5">
        {order.map((pkg, i) => {
          const hidden = !!hiddenMap[pkg.id];
          return (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              index={i}
              tierLabel={tierLabels[i] ?? TIER_DEFAULTS[i] ?? `Tier ${i + 1}`}
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
          className="rounded-sm p-8 @[640px]:p-10 flex flex-col items-center justify-center gap-3 min-h-[520px] @[640px]:min-h-[580px] border-2 border-dashed border-[#a68b5b]/40 bg-[#a68b5b]/[0.02] text-[#a68b5b] hover:border-[#a68b5b] hover:bg-[#a68b5b]/[0.06] transition disabled:opacity-60"
        >
          <span className="text-4xl leading-none">+</span>
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase">
            {pending ? "Dodaję..." : "Dodaj członkostwo"}
          </span>
        </button>
      </div>

      {/* Reset link — only on secondary pages with at least one override. */}
      {hasAnyOverride && (
        <div className="max-w-[1340px] mx-auto mt-4 text-right">
          <button
            type="button"
            onClick={onResetOverrides}
            className="text-[11px] text-[#ede4d6]/50 hover:text-[#a68b5b] hover:underline transition"
          >
            Resetuj kolejność i widoczność członkostw na tej stronie
          </button>
        </div>
      )}
    </>
  );
}

function PackageCard({
  pkg,
  index,
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
  index: number;
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

  const tierLabelKey = `tier${index + 1}Label` as const;
  const tierLabelDefault = TIER_DEFAULTS[index] ?? `Tier ${index + 1}`;

  return (
    <div
      className={`group relative rounded-sm p-8 @[640px]:p-10 flex flex-col min-h-[520px] @[640px]:min-h-[580px] border transition-all ${
        pkg.featured
          ? "bg-gradient-to-b from-[#a68b5b]/[0.12] to-transparent border-[#a68b5b]"
          : "border-[#ede4d6]/15"
      } ${hidden ? "opacity-55" : ""}`}
    >
      {/* Hover-only action cluster (top-right). On secondary pages the cluster
          carries reorder + hide buttons in addition to feature/delete. */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Przesuń w lewo"
          className="w-8 h-8 rounded-full bg-[#ede4d6]/10 border border-[#ede4d6]/15 text-[#ede4d6]/70 inline-flex items-center justify-center hover:text-[#a68b5b] hover:border-[#a68b5b]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Przesuń w prawo"
          className="w-8 h-8 rounded-full bg-[#ede4d6]/10 border border-[#ede4d6]/15 text-[#ede4d6]/70 inline-flex items-center justify-center hover:text-[#a68b5b] hover:border-[#a68b5b]/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
        {showOverrideControls && (
          <>
            <button
              type="button"
              onClick={onToggleHidden}
              title={hidden ? "Pokaż na tej stronie" : "Ukryj na tej stronie"}
              className={`w-8 h-8 rounded-full bg-[#ede4d6]/10 border inline-flex items-center justify-center transition ${
                hidden
                  ? "border-[#a68b5b]/60 text-[#a68b5b]"
                  : "border-[#ede4d6]/15 text-[#ede4d6]/70 hover:text-[#a68b5b] hover:border-[#a68b5b]/60"
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
          title={pkg.featured ? "Usuń wyróżnienie" : "Wyróżnij jako Najczęściej wybierane"}
          className="w-8 h-8 rounded-full bg-[#ede4d6]/10 border border-[#ede4d6]/15 text-[#ede4d6]/70 inline-flex items-center justify-center hover:text-[#a68b5b] hover:border-[#a68b5b]/60 transition"
        >
          {pkg.featured ? "⭐" : "☆"}
        </button>
        <button
          ref={aiBtnRef}
          type="button"
          onClick={() => setAiOpen(true)}
          title="Przepisz AI"
          className="w-8 h-8 rounded-full bg-[#ede4d6]/10 border border-[#ede4d6]/15 text-[#ede4d6]/70 inline-flex items-center justify-center hover:text-violet-300 hover:border-violet-300/60 transition text-base"
        >
          ✨
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń członkostwo"
          className="w-8 h-8 rounded-full bg-[#ede4d6]/10 border border-[#ede4d6]/15 text-[#ede4d6]/70 inline-flex items-center justify-center hover:text-red-400 hover:border-red-400/40 transition"
        >
          🗑
        </button>
      </div>

      <PerItemAIPopover
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        itemLabel="członkostwo"
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
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#a68b5b]">
              {String(v.name ?? "")}
            </div>
            <div className="text-[14px] text-slate-900 leading-[1.5]">{String(v.description ?? "")}</div>
            <ul className="grid gap-1 text-[12px] text-slate-700 mt-1 list-disc pl-4">
              {(Array.isArray(v.items) ? (v.items as string[]) : []).map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}
      />

      {pkg.featured && (
        <span className="absolute -top-3 left-8 bg-[#a68b5b] text-[#1a1613] font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-3.5 py-1.5 rounded-full">
          Najczęściej wybierane
        </span>
      )}

      <div className="font-mono text-[11px] text-[#a68b5b] tracking-[0.25em] uppercase mb-3.5">
        <EditableSigCopy
          field={tierLabelKey}
          initial={tierLabel === tierLabelDefault ? undefined : tierLabel}
          defaultValue={tierLabelDefault}
          maxLength={20}
          rich={false}
          theme="dark"
          accentColor="#a68b5b"
        />
      </div>
      <div className="text-[26px] @[640px]:text-[32px] leading-[1.1] tracking-[-0.02em] font-normal mb-5 text-[#ede4d6]">
        <EditablePkgField
          packageId={pkg.id}
          field="name"
          initial={pkg.name}
          theme="dark"
          placeholder="Nazwa członkostwa"
        />
      </div>

      <div className="flex items-baseline gap-1.5 mb-4 pb-7 border-b border-[#ede4d6]/15 flex-wrap">
        <span className="text-[40px] @[640px]:text-[52px] tracking-[-0.03em] text-[#ede4d6] leading-none whitespace-nowrap">
          <EditablePkgField
            packageId={pkg.id}
            field="price"
            initial={String(pkg.price)}
            theme="dark"
          />{" zł"}
        </span>
        <span className="text-[13px] text-[#ede4d6]/50 font-mono whitespace-nowrap">
          /{" "}
          <EditablePkgField
            packageId={pkg.id}
            field="period"
            initial={pkg.period ?? ""}
            theme="dark"
            placeholder="miesiąc"
          />
        </span>
      </div>

      <div className="text-[14px] leading-[1.55] text-[#ede4d6]/70 m-0 mb-7">
        <EditablePkgField
          packageId={pkg.id}
          field="description"
          initial={pkg.description}
          theme="dark"
          placeholder="Krótki opis członkostwa..."
        />
      </div>

      <ul className="list-none p-0 m-0 mb-8 grid gap-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-3 text-[13px] text-[#ede4d6]/85 leading-[1.5] items-start">
            <span className="w-3.5 h-3.5 border border-[#a68b5b] rounded-full text-[#a68b5b] inline-flex items-center justify-center shrink-0 mt-0.5 text-[8px]">
              ✓
            </span>
            <InlineEditable
              key={`${pkg.id}-${idx}-${item}`}
              initial={item}
              maxLength={80}
              theme="dark"
              placeholder="Co wchodzi w skład członkostwa..."
              className="flex-1"
              onCommit={(next) => onItemCommit(idx, next)}
            />
            <button
              type="button"
              onClick={() => onItemRemove(idx)}
              className="text-[#ede4d6]/30 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition shrink-0"
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
            className="w-full text-left text-[12px] text-[#a68b5b]/80 hover:text-[#a68b5b] font-mono uppercase tracking-[0.15em] py-1.5 px-0.5"
          >
            + Dodaj pozycję
          </button>
        </li>
      </ul>

      <button
        type="button"
        disabled
        title="Podgląd — w trybie edycji nie można dołączyć"
        className={`mt-auto inline-flex justify-center items-center h-12 rounded-full text-[13px] font-medium transition border cursor-not-allowed ${
          pkg.featured
            ? "bg-[#a68b5b] text-[#1a1613] border-[#a68b5b]"
            : "border-[#ede4d6]/25 text-[#ede4d6]"
        }`}
      >
        Dołącz do {tierLabel || tierLabelDefault} →
      </button>
    </div>
  );
}
