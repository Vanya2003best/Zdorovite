"use client";

import Link from "next/link";
import type { WorkingHourRule } from "./CalendarClient";

export type CalendarMode = "bookings" | "availability" | "pattern";

export function isMode(s: string | null | undefined): s is CalendarMode {
  return s === "bookings" || s === "availability" || s === "pattern";
}

const POL_DAYS_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
const POL_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

/** ============ Mode switcher (3 buttons) ============ */
export function ModeSwitcher({
  mode,
  bookingsBadge,
}: {
  mode: CalendarMode;
  bookingsBadge?: number;
}) {
  const modes: {
    id: CalendarMode;
    label: string;
    badge?: number;
    icon: React.ReactNode;
  }[] = [
    {
      id: "bookings",
      label: "Rezerwacje",
      badge: bookingsBadge,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      id: "availability",
      label: "Dostępność",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      id: "pattern",
      label: "Wzorzec tyg.",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium"
      role="tablist"
      aria-label="Tryb kalendarza"
    >
      {modes.map((m) => {
        const on = m.id === mode;
        const href = m.id === "bookings" ? "/studio/calendar" : `/studio/calendar?mode=${m.id}`;
        return (
          <Link
            key={m.id}
            href={href}
            scroll={false}
            role="tab"
            aria-selected={on}
            className={
              "px-4 py-1.5 rounded-[7px] inline-flex items-center gap-2 transition " +
              (on
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            {m.icon}
            {m.label}
            {typeof m.badge === "number" && m.badge > 0 && (
              <span
                className={
                  "text-[10.5px] font-semibold px-1.5 py-px rounded-[5px] " +
                  (on ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700")
                }
              >
                {m.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** ============ Contextual banner per mode ============ */
export function ModeBanner({
  mode,
  freeSlots14d,
}: {
  mode: CalendarMode;
  freeSlots14d: number;
}) {
  if (mode === "bookings") {
    return (
      <Banner
        tone="bookings"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
          </svg>
        }
        title="Tryb: Rezerwacje"
        detail="Konkretne sesje · klikaj aby edytować, przeciągaj aby przenieść. Czerwona linia = teraz."
        link={{ href: "/studio/calendar?mode=availability", label: "Sprawdź dostępność →" }}
      />
    );
  }
  if (mode === "availability") {
    return (
      <Banner
        tone="availability"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        }
        title="Tryb: Dostępność"
        detail={`Zielone pola = sloty wolne dla klientów (z wzorca + wyjątków). Sesje wyblakłe. ~${freeSlots14d} wolnych slotów na 14 dni.`}
        link={{ href: "/studio/calendar?mode=pattern", label: "Edytuj wzorzec →" }}
      />
    );
  }
  return (
    <Banner
      tone="pattern"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
        </svg>
      }
      title="Tryb: Wzorzec tygodniowy"
      detail="Edytujesz REGUŁY — obowiązują w każdym tygodniu. Klikaj zielone pola, aby zmienić godziny pracy."
      link={{ href: "/studio/calendar", label: "← Wróć do rezerwacji" }}
    />
  );
}

function Banner({
  tone,
  icon,
  title,
  detail,
  link,
}: {
  tone: CalendarMode;
  icon: React.ReactNode;
  title: string;
  detail: string;
  link: { href: string; label: string };
}) {
  const palette = {
    bookings: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900", iconBg: "bg-sky-500" },
    availability: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", iconBg: "bg-emerald-500" },
    pattern: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", iconBg: "bg-amber-500" },
  }[tone];
  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] border ${palette.bg} ${palette.border} ${palette.text}`}
    >
      <span
        className={`w-7 h-7 rounded-[8px] inline-flex items-center justify-center shrink-0 text-white ${palette.iconBg}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <b className="font-semibold">{title}</b>
        <div className="opacity-70 leading-[1.4] mt-px">{detail}</div>
      </div>
      <div className="ml-auto shrink-0">
        <Link
          href={link.href}
          scroll={false}
          className="font-semibold underline underline-offset-[3px] hover:no-underline"
        >
          {link.label}
        </Link>
      </div>
    </div>
  );
}

/** ============ Pattern mode 7-day summary ============ */
export function PatternSummaryPanel({ rules }: { rules: WorkingHourRule[] }) {
  return (
    <div className="grid grid-cols-7 gap-2.5 bg-white border border-slate-200 rounded-[12px] px-4 py-3">
      {POL_DAYS_ORDER.map((dow) => {
        const dayRules = rules.filter((r) => r.dow === dow).sort((a, b) => a.start.localeCompare(b.start));
        const off = dayRules.length === 0;
        const total = dayRules.reduce((acc, r) => {
          const [sh, sm] = r.start.split(":").map(Number);
          const [eh, em] = r.end.split(":").map(Number);
          return acc + Math.max(0, eh + em / 60 - (sh + sm / 60));
        }, 0);
        return (
          <div key={dow} className={"text-center " + (off ? "opacity-70" : "")}>
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.06em] mb-1.5">
              {POL_DAYS_SHORT[dow]}
            </div>
            <div className="flex flex-col gap-[3px] items-center">
              {off ? (
                <span className="block w-full text-[10.5px] italic text-slate-400 px-2 py-[3px] bg-slate-50 rounded font-mono">
                  wolne
                </span>
              ) : (
                dayRules.map((r, i) => (
                  <span
                    key={i}
                    className="block w-full text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-[3px] rounded font-mono"
                  >
                    {r.start.replace(":00", "")}–{r.end.replace(":00", "")}
                  </span>
                ))
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {off ? "0 godz." : `${Math.round(total)} godz.`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** ============ Pattern mode sticky save bar ============ */
export function PatternSaveBar({
  dirtyCount,
  detail,
  saving,
  onSave,
  onCancel,
}: {
  dirtyCount: number;
  detail: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (dirtyCount === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-[12px] px-4 py-2.5 flex items-center gap-3.5 text-[12.5px] shadow-[0_12px_36px_rgba(2,6,23,0.18)] z-30">
      <span>
        <b className="font-semibold">
          {dirtyCount} {dirtyCount === 1 ? "zmiana" : "zmian(y)"}
        </b>
        {detail && <span className="text-white/55 font-mono ml-2">{detail}</span>}
      </span>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="h-[30px] px-3 rounded-md bg-white/10 text-white text-[12px] font-semibold disabled:opacity-50"
      >
        Cofnij
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="h-[30px] px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-semibold disabled:opacity-50"
      >
        {saving ? "Zapisuję…" : "Zapisz"}
      </button>
    </div>
  );
}
