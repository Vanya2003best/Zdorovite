"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pulpit mode switcher — design 42. Three trainer-lifecycle states:
 *
 *   🌱 empty   — Dzień 1: onboarding (just signed up, profile incomplete)
 *   💪 working — Dzień roboczy: today's sessions + KPIs (default)
 *   📈 growth  — Tryb wzrostu: insights + ranking + client action queue
 *
 * Mode is driven by `?mode=` in the URL so refreshes preserve the
 * trainer's last selection. The default (no param) is "working"; the
 * server-side page picks an auto-default based on the trainer's state
 * (bookings + services count) and folds it into the URL when needed.
 */

type Mode = "empty" | "working" | "growth";

const MODES: Array<{ id: Mode; icon: string; label: string; tag: string }> = [
  { id: "empty",   icon: "🌱", label: "Dzień 1",        tag: "nowy" },
  { id: "working", icon: "💪", label: "Dzień roboczy", tag: "aktywny" },
  { id: "growth",  icon: "📈", label: "Tryb wzrostu",  tag: "pro" },
];

export default function StudioPulpitModeBar({
  mode,
  rightSlot,
  hideEmpty,
}: {
  mode: Mode;
  /** Status line shown on the right side (varies per mode — "Online · 47×",
   *  "Konto utworzone dzisiaj", "#4 w 'Trener Warszawa'"). Pre-rendered
   *  server-side so we can keep this component purely presentational. */
  rightSlot?: React.ReactNode;
  /** When all 3 onboarding steps are done, hide the "Dzień 1" tab so it
   *  stops cluttering the bar. The trainer can still land on ?mode=empty
   *  via a stale URL — that's fine, the empty view just won't appear in
   *  the switcher anymore. */
  hideEmpty?: boolean;
}) {
  const pathname = usePathname() ?? "/studio";
  const visibleModes = hideEmpty ? MODES.filter((m) => m.id !== "empty") : MODES;

  return (
    <div className="bg-white border-b border-slate-200 py-2">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex items-center gap-3.5 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold">
          Stan trenera:
        </span>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          {visibleModes.map((m) => {
            const on = mode === m.id;
            const href = m.id === "working" ? pathname : `${pathname}?mode=${m.id}`;
            return (
              <Link
                key={m.id}
                href={href}
                scroll={false}
                className={
                  "px-3.5 py-1.5 text-[13px] font-bold rounded-md inline-flex items-center gap-1.5 transition " +
                  (on
                    ? "bg-white text-[#002f34] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-slate-500 hover:text-[#002f34]")
                }
              >
                <span className="text-[14px]">{m.icon}</span>
                {m.label}
                <span className="opacity-60 font-medium">· {m.tag}</span>
              </Link>
            );
          })}
        </div>
        {rightSlot && (
          <div className="ml-auto text-[12px] text-slate-500 flex items-center gap-2.5">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}
