"use client";

import { useEffect, useRef, useState } from "react";

type Counts = {
  specializations: number;
  certifications: number;
  social: number;
  aiContext: number;
};

type Section = { id: string; label: string; countKey?: keyof Counts };

const SECTIONS: Section[] = [
  { id: "podstawowe", label: "Podstawowe" },
  { id: "specjalizacje", label: "Specjalizacje", countKey: "specializations" },
  { id: "certyfikaty", label: "Certyfikaty", countKey: "certifications" },
  { id: "lokalizacja", label: "Lokalizacja" },
  { id: "social", label: "Social", countKey: "social" },
  { id: "ai", label: "Kontekst AI", countKey: "aiContext" },
  { id: "polityka", label: "Polityka i prywatność" },
];

// Studio top-bar is h-14 (56px) sticky top-0. Our nav sits directly
// below it. The scroll-into-view offset has to clear the top-bar plus
// the nav itself so the section heading isn't hidden by either.
const TOPBAR_PX = 56;
const NAV_PX = 48;
const SCROLL_OFFSET = TOPBAR_PX + NAV_PX + 8;

export default function ProfileSectionNav({ counts }: { counts: Counts }) {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const lastClickedRef = useRef<{ id: string; until: number } | null>(null);

  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (elements.length === 0) return;

    // Pick the section whose top is closest to (top-bar + nav) bottom edge,
    // i.e. the one currently sitting under the sticky nav.
    const onScroll = () => {
      // While a click-driven smooth scroll is animating, freeze the active
      // marker on the clicked target so the indicator doesn't flicker
      // through intermediate sections.
      const lc = lastClickedRef.current;
      if (lc && Date.now() < lc.until) {
        setActive(lc.id);
        return;
      }
      const cutoff = TOPBAR_PX + NAV_PX + 16;
      let current = elements[0].id;
      for (const el of elements) {
        const top = el.getBoundingClientRect().top;
        if (top - cutoff <= 0) current = el.id;
        else break;
      }
      setActive(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    lastClickedRef.current = { id, until: Date.now() + 800 };
    setActive(id);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <div
      className="sticky z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 bg-slate-50/85 backdrop-blur border-b border-slate-200"
      style={{ top: TOPBAR_PX }}
    >
      <div className="flex gap-0.5 overflow-x-auto -mb-px">
        {SECTIONS.map((s) => {
          const isOn = active === s.id;
          const count = s.countKey ? counts[s.countKey] : undefined;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={
                "inline-flex items-center px-4 py-3 text-[13.5px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors " +
                (isOn
                  ? "text-slate-900 border-slate-900 font-semibold"
                  : "text-slate-500 border-transparent hover:text-slate-700")
              }
            >
              {s.label}
              {typeof count === "number" && count > 0 && (
                <span
                  className={
                    "ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-[5px] " +
                    (isOn ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-500 border border-slate-200")
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
