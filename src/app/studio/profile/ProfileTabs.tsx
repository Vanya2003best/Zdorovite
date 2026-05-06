"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type TabKey =
  | "podstawowe"
  | "specjalizacje"
  | "certyfikaty"
  | "lokalizacja"
  | "social"
  | "polityka";

type Counts = {
  specializations: number;
  certifications: number;
  social: number;
};

const TABS: { key: TabKey; label: string; countKey?: keyof Counts }[] = [
  { key: "podstawowe", label: "Podstawowe" },
  { key: "specjalizacje", label: "Specjalizacje", countKey: "specializations" },
  { key: "certyfikaty", label: "Certyfikaty", countKey: "certifications" },
  { key: "lokalizacja", label: "Lokalizacja" },
  { key: "social", label: "Social", countKey: "social" },
  { key: "polityka", label: "Polityka i prywatność" },
];

export default function ProfileTabs({ active, counts }: { active: TabKey; counts: Counts }) {
  const params = useSearchParams();

  // Preserve other query params if present (rare on this page, but safer
  // than rebuilding the URL from scratch).
  const hrefFor = (tab: TabKey) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", tab);
    return `/studio/profile?${sp.toString()}`;
  };

  return (
    <div className="flex gap-0.5 border-b border-slate-200 mt-5 -mb-px overflow-x-auto">
      {TABS.map((t) => {
        const isOn = active === t.key;
        const count = t.countKey ? counts[t.countKey] : undefined;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            scroll={false}
            className={
              "inline-flex items-center px-4 py-3 text-[13.5px] font-medium border-b-2 -mb-px whitespace-nowrap " +
              (isOn
                ? "text-slate-900 border-slate-900 font-semibold"
                : "text-slate-500 border-transparent hover:text-slate-700")
            }
          >
            {t.label}
            {typeof count === "number" && count > 0 && (
              <span
                className={
                  "ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-[5px] " +
                  (isOn ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-500")
                }
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
