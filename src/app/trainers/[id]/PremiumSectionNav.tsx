"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/**
 * Section nav for the Premium template. Anchors scroll to each section's
 * id, and the black pill highlight follows whichever section is currently
 * in view via an IntersectionObserver. Click also updates the highlight
 * immediately (no waiting for scroll-end) so the feedback feels instant.
 *
 * Layout/styling is identical to the previous inline nav — extracted only
 * because the active-state logic needs client-side scroll observation.
 */
export default function PremiumSectionNav({
  items,
  isEmbed,
}: {
  items: Item[];
  isEmbed: boolean;
}) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (isEmbed) return;
    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    // rootMargin: shrink the viewport top by ~30% so a section "becomes
    // active" once it crosses ~30% from the top of the screen, not the
    // edge — feels more accurate when you're reading the section's title.
    // Bottom margin pulls the bottom in too so the active state doesn't
    // flip prematurely when scrolling fast.
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top among intersecting ones.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0]!.target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items, isEmbed]);

  return (
    <nav className={`${isEmbed ? "" : "sticky top-0"} z-30 bg-white/85 backdrop-blur-lg border-b border-slate-200 mt-6 @[640px]:mt-8 overflow-x-auto scrollbar-hide`}>
      <div className="mx-auto max-w-[1200px] px-3.5 @[640px]:px-6 flex items-center gap-0.5 @[640px]:gap-1 h-12 @[640px]:h-14">
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              onClick={() => setActiveId(it.id)}
              className={`shrink-0 px-2 @[640px]:px-3.5 py-1.5 @[640px]:py-2 rounded-[9px] text-[12px] @[640px]:text-sm font-medium transition ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
