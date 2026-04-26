"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackage,
  removePackage,
  togglePackageFeatured,
  updatePackageField,
  updatePackageItems,
} from "./package-actions";

type Pkg = {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period?: string;
  featured?: boolean;
};

export default function InlinePackagesEditor({ packages }: { packages: Pkg[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onAdd = () => {
    startTransition(async () => {
      await addPackage();
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {packages.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} />
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-5 text-emerald-700 font-medium hover:border-emerald-500 hover:bg-emerald-50/60 transition disabled:opacity-60 min-h-[300px]"
      >
        <span className="text-2xl">+</span>
        {pending ? "Dodaję..." : "Dodaj pakiet"}
      </button>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: Pkg }) {
  const [items, setItems] = useState<string[]>(pkg.items);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onDelete = () => {
    if (!confirm(`Usunąć pakiet "${pkg.name}"?`)) return;
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

  const onItemChange = (idx: number, value: string) => {
    const next = [...items];
    next[idx] = value;
    setItems(next);
  };
  const onItemBlur = () => updateItems(items);
  const onItemRemove = (idx: number) => updateItems(items.filter((_, i) => i !== idx));
  const onItemAdd = () => updateItems([...items, "Nowa pozycja"]);

  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-[20px] p-5 sm:p-6 ${
        pkg.featured
          ? "bg-gradient-to-b from-white/95 to-emerald-50/90 border border-emerald-300 shadow-[0_22px_48px_-18px_rgba(16,185,129,0.3)]"
          : "bg-white/80 backdrop-blur-sm border border-white/70 shadow-sm"
      }`}
    >
      {/* Hover action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={pending}
          title={pkg.featured ? "Usuń wyróżnienie" : "Wyróżnij jako Popularne"}
          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:text-amber-500 hover:border-amber-300 transition"
        >
          {pkg.featured ? "⭐" : "☆"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń pakiet"
          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:text-red-600 hover:border-red-300 transition"
        >
          🗑
        </button>
      </div>

      {pkg.featured && (
        <span className="absolute -top-2.5 left-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] px-3 py-1 rounded-full font-semibold uppercase tracking-[0.06em] shadow-sm">
          ⭐ Popularne
        </span>
      )}

      <div>
        <div className="text-base font-semibold text-emerald-700">
          <EditablePkgField packageId={pkg.id} field="name" initial={pkg.name} />
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-[34px] font-semibold tracking-tight">
            <EditablePkgField
              packageId={pkg.id}
              field="price"
              initial={String(pkg.price)}
              type="number"
              className="w-24"
            />{" "}
            zł
          </span>
          <span className="text-[13px] text-slate-500">
            /{" "}
            <EditablePkgField
              packageId={pkg.id}
              field="period"
              initial={pkg.period ?? ""}
              placeholder="miesiąc"
              className="min-w-[70px]"
            />
          </span>
        </div>
        <div className="text-[13px] text-slate-600 leading-snug mt-2">
          <EditablePkgField
            packageId={pkg.id}
            field="description"
            initial={pkg.description}
            multiline
            placeholder="Krótki opis (opcjonalnie)..."
          />
        </div>
      </div>

      <ul className="space-y-2.5 flex-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
            <span className="w-[18px] h-[18px] rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0 mt-0.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => onItemChange(idx, e.target.value)}
              onBlur={onItemBlur}
              maxLength={100}
              className="flex-1 bg-transparent border-0 border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:bg-emerald-50/30 px-0.5 outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => onItemRemove(idx)}
              className="text-slate-400 hover:text-red-600 text-sm opacity-0 group-hover:opacity-100 transition shrink-0"
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
            className="w-full text-left text-[13px] text-emerald-700 hover:text-emerald-900 font-medium py-1.5 px-0.5"
          >
            + Dodaj pozycję
          </button>
        </li>
      </ul>
    </div>
  );
}

function EditablePkgField({
  packageId,
  field,
  initial,
  multiline = false,
  type = "text",
  placeholder,
  className = "",
}: {
  packageId: string;
  field: "name" | "description" | "price" | "period";
  initial: string;
  multiline?: boolean;
  type?: "text" | "number";
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const commit = () => {
    if (value.trim() === initial.trim()) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updatePackageField(packageId, field, value);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setValue(initial);
    setEditing(false);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") cancel();
    else if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    return (
      <span className="relative inline-block">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            autoFocus
            disabled={pending}
            rows={Math.max(2, value.split("\n").length)}
            className={`${className} bg-emerald-50/40 border-2 border-emerald-400 rounded-lg p-1.5 outline-none block w-full text-inherit resize-vertical`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            autoFocus
            disabled={pending}
            className={`${className} bg-emerald-50/40 border-2 border-emerald-400 rounded px-1.5 py-0.5 outline-none text-inherit font-inherit`}
          />
        )}
        {error && (
          <div className="absolute left-0 -bottom-5 text-[11px] text-red-600 whitespace-nowrap">{error}</div>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`${className} cursor-text rounded hover:bg-emerald-50/50 hover:outline hover:outline-2 hover:outline-emerald-300 transition inline-block min-w-[1ch]`}
      title="Kliknij, aby edytować"
    >
      {value || <span className="text-slate-400 italic text-[13px]">{placeholder ?? "—"}</span>}
    </span>
  );
}
