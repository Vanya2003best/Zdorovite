"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackage,
  removePackage,
  togglePackageFeatured,
  updatePackageItems,
} from "./package-actions";
import { setItemOrder } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { pinScrollFor } from "./keep-scroll";
import EditablePkgField from "./EditablePkgField";
import InlineEditable from "./InlineEditable";
import { usePreviewTransition } from "./preview-busy";
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
 * Cozy-styled packages editor — mirrors the public Cozy render
 * (PackagesSection w/ s.name === "cozy"): warm peach/orange cards on
 * `#fdf6ec` page bg, "✨ Ulubione" pill on the featured tile, leaf-prefixed
 * `🌿` item rows, soft `rgba(164,95,30,0.06)` shadow. Same package-actions
 * as the Premium editor — editing here feels native to Cozy.
 *
 * Reorder is via on-card left/right arrows only — HTML5 drag-and-drop was
 * removed because users were dragging cards by accident while trying to
 * click inline-editable fields. Order persists via override-actions
 * `setItemOrder("package", …)`, so the Cozy primary page writes to
 * `trainers.customization.packageOverrides` and secondary pages write to
 * the trainer_pages row.
 */
export default function CozyPackagesEditor({
  packages,
  overrides,
}: {
  packages: Pkg[];
  overrides: Record<string, ItemOverride>;
}) {
  const [pending, startTransition] = usePreviewTransition();
  const router = useRouter();
  const pageId = useEditingPageId();

  const propOrdered = [...packages]
    .map((p, idx) => ({
      p,
      ord: typeof overrides[p.id]?.position === "number" ? overrides[p.id]!.position! : idx + 10000,
    }))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.p);

  const [order, setOrder] = useState<Pkg[]>(propOrdered);

  // Re-seed when the underlying list / overrides change (e.g. router.refresh
  // after add/remove). Compare by id-list so optimistic state survives until
  // the server has actually changed.
  const seedKey =
    propOrdered
      .map((p) => `${p.id}:${p.name}:${p.description}:${p.items.join("/")}:${p.featured ? 1 : 0}`)
      .join("|") +
    "::" +
    packages.map((p) => `${p.id}:${overrides[p.id]?.position ?? "-"}`).join(",");
  const lastSeedRef = useRef(seedKey);
  useEffect(() => {
    if (lastSeedRef.current === seedKey) return;
    lastSeedRef.current = seedKey;
    setOrder(propOrdered);
  }, [seedKey, propOrdered]);

  const onAdd = () => {
    startTransition(async () => {
      await addPackage();
      router.refresh();
    });
  };

  const commitOrder = (next: Pkg[]) => {
    pinScrollFor(1500);
    const prev = order;
    setOrder(next);
    setItemOrder("package", next.map((p) => p.id), pageId).then((res) => {
      if ("error" in res) {
        alert(res.error);
        setOrder(prev);
      } else {
        router.refresh();
      }
    });
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = order.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    commitOrder(next);
  };

  return (
    // Container-query breakpoints — the editor canvas at /studio/design is
    // much narrower than the viewport, so viewport-based `sm:`/`lg:` left the
    // grid stuck at 3 columns and squeezed each card to ~150px (vertical
    // letter-by-letter wrap on names like "TRANSFORMACJA 90 DNI"). With
    // `@container` on the parent, columns now respond to the actual canvas
    // width: 1 col under 520px, 2 cols 520–800px, 3 cols above.
    <div className="grid grid-cols-1 @[520px]:grid-cols-2 @[800px]:grid-cols-3 gap-4">
      {order.map((pkg, i) => (
        <CozyPackageCard
          key={pkg.id}
          pkg={pkg}
          isFirst={i === 0}
          isLast={i === order.length - 1}
          onMoveLeft={() => onMove(pkg.id, -1)}
          onMoveRight={() => onMove(pkg.id, 1)}
        />
      ))}

      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="rounded-2xl p-6 border-2 border-dashed border-orange-300/60 bg-orange-50/40 text-orange-700 font-medium min-h-[260px] flex flex-col items-center justify-center gap-2.5 hover:border-orange-500 hover:bg-orange-50/70 transition disabled:opacity-60"
      >
        <span className="text-3xl leading-none">+</span>
        <span className="text-[13px] uppercase tracking-[0.06em] font-semibold">
          {pending ? "Dodaję..." : "Dodaj pakiet"}
        </span>
      </button>
    </div>
  );
}

function CozyPackageCard({
  pkg,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
}: {
  pkg: Pkg;
  isFirst: boolean;
  isLast: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
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
      className={`group relative rounded-2xl p-6 transition ${
        pkg.featured
          ? "bg-gradient-to-br from-[#fef3e0] to-[#fbbf77] shadow-[0_8px_24px_rgba(249,115,22,0.28)] text-[#2d2418]"
          : "bg-white shadow-[0_4px_16px_rgba(164,95,30,0.08)]"
      }`}
    >
      {/* Hover-only action buttons — floated above the card so they don't
          cover the package title (RESET / TRANSFORMACJA 90 DNI / etc.) which
          sits flush at the top-left of the content area. */}
      <div className="absolute -top-4 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={isFirst}
          title="Przesuń w lewo"
          className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-orange-600 hover:border-orange-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={isLast}
          title="Przesuń w prawo"
          className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-orange-600 hover:border-orange-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={pending}
          title={pkg.featured ? "Usuń wyróżnienie" : "Wyróżnij jako Ulubione"}
          className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-orange-600 hover:border-orange-400 transition text-sm"
        >
          {pkg.featured ? "★" : "☆"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń pakiet"
          className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-orange-200 text-[#8a7559] inline-flex items-center justify-center hover:text-red-600 hover:border-red-300 transition text-sm"
        >
          🗑
        </button>
      </div>

      {pkg.featured && (
        <span className="absolute -top-2.5 left-4 bg-orange-600 text-white text-[11px] px-3 py-1 rounded-full font-semibold uppercase tracking-[0.05em] shadow-sm">
          ✨ Ulubione
        </span>
      )}

      <div className="text-[12px] uppercase tracking-[0.08em] text-[#8a7559] font-semibold">
        <EditablePkgField packageId={pkg.id} field="name" initial={pkg.name} />
      </div>
      <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
        <span className="text-[28px] font-semibold tracking-tight text-[#2d2418] whitespace-nowrap leading-none">
          <EditablePkgField packageId={pkg.id} field="price" initial={String(pkg.price)} />{" "}
          zł
        </span>
        <span className="text-[13px] text-[#8a7559] whitespace-nowrap">
          /{" "}
          <EditablePkgField
            packageId={pkg.id}
            field="period"
            initial={pkg.period ?? ""}
            placeholder="miesiąc"
          />
        </span>
      </div>
      <div className="text-[13px] text-[#6b5a41] mt-3 leading-snug">
        <EditablePkgField
          packageId={pkg.id}
          field="description"
          initial={pkg.description}
          placeholder="Krótki opis (opcjonalnie)..."
        />
      </div>

      <ul className="list-none p-0 m-0 grid gap-1.5 mt-5 pt-4 border-t border-orange-200/40">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-[13px] text-[#44372b] leading-relaxed group/item">
            <span className="shrink-0 text-base leading-tight">🌿</span>
            <InlineEditable
              key={`${pkg.id}-${idx}-${item}`}
              initial={item}
              maxLength={80}
              placeholder="Co wchodzi w skład pakietu..."
              className="flex-1 text-[13px] leading-relaxed"
              onCommit={(next) => onItemCommit(idx, next)}
            />
            <button
              type="button"
              onClick={() => onItemRemove(idx)}
              className="text-[#8a7559] hover:text-red-600 text-sm opacity-0 group-hover/item:opacity-100 transition shrink-0 px-1"
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
            className="w-full text-left text-[12px] text-orange-700 hover:text-orange-900 font-semibold py-1.5 px-0 mt-1"
          >
            + Dodaj pozycję
          </button>
        </li>
      </ul>

      {/* Visual-only "Wybierz {name}" button — mirrors the public render so the
          editor preview stays 1:1 with what visitors see, but click is a no-op
          here (active only on the public profile, where it links to checkout). */}
      <button
        type="button"
        onClick={(e) => e.preventDefault()}
        title="Aktywny tylko na publicznej stronie"
        className="mt-5 w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full text-[14px] font-semibold shadow-[0_6px_16px_rgba(234,88,12,0.28)] cursor-default"
      >
        Wybierz {pkg.name}
      </button>
    </div>
  );
}
