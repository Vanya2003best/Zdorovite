"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import RescheduleDialog from "@/components/RescheduleDialog";
import {
  cancelAsTrainer,
  confirmBooking,
  markCompleted,
  markNoShow,
} from "@/app/studio/bookings/actions";
import { saveAvailabilityRules, saveAvailabilityOverride } from "@/app/studio/availability/actions";
import WorkingHoursOverlay from "./WorkingHoursOverlay";
import HolidayPresetButton from "./HolidayPresetButton";
import {
  ModeSwitcher,
  isMode,
  type CalendarMode,
} from "./CalendarMode";

export type WorkingHourRule = { dow: number; start: string; end: string };

export type BookingEvent = {
  id: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  status: "pending" | "paid" | "confirmed" | "completed" | "cancelled" | "no_show";
  price: number;
  note: string | null;
  title: string;        // service or package name (display label)
  /** When non-null, this booking is a session inside a multi-session package
   *  (the trainer sold "4 weeks of strength" etc.). Drives a distinct
   *  colour palette on the calendar so the trainer reads "this is a
   *  package session" at a glance vs a one-off service booking. */
  packageName: string | null;
  clientName: string;
  clientAvatar: string | null;
};

const POL_MONTHS_GEN = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
const POL_MONTHS_GEN_SHORT = [
  "sty", "lut", "mar", "kwi", "maj", "cze",
  "lip", "sie", "wrz", "paź", "lis", "gru",
];
const POL_MONTHS_NOM = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

/** Status palette used by the detail modal header pill. Calendar
 *  events themselves are coloured by service-type (TYPE_STYLE) per
 *  design 32; status is encoded via dashed border / opacity. */
const STATUS_STYLE: Record<BookingEvent["status"], { bg: string; border: string; text: string; label: string }> = {
  pending:   { bg: "bg-amber-100",  border: "border-amber-300",  text: "text-amber-900",  label: "Oczekuje" },
  paid:      { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-900", label: "Opłacone" },
  confirmed: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-900", label: "Potwierdzone" },
  completed: { bg: "bg-slate-100",  border: "border-slate-300",  text: "text-slate-700",  label: "Zakończone" },
  cancelled: { bg: "bg-rose-50",    border: "border-rose-200",   text: "text-rose-700",   label: "Anulowane" },
  no_show:   { bg: "bg-rose-50",    border: "border-rose-200",   text: "text-rose-700",   label: "Nieobecność" },
};

/** Service-type → palette. Maps onto the design 32 .ev colour
 *  variants. Anything that doesn't match a keyword falls through
 *  to 'siłowy' as the safe default for "1:1 personal training".
 *  Package sessions get their own distinct indigo palette so the
 *  trainer reads "this is a package booking" at a glance, ignoring
 *  whatever the underlying service-type would have been. */
type ServiceType = "silowy" | "online" | "cardio" | "funkc" | "diag" | "package";
const TYPE_STYLE: Record<
  ServiceType,
  { bg: string; border: string; text: string; sub: string; label: string }
> = {
  silowy:  { bg: "#ecfdf5", border: "#10b981", text: "#064e3b", sub: "#047857", label: "Siłowy" },
  online:  { bg: "#eff6ff", border: "#3b82f6", text: "#1e3a8a", sub: "#1d4ed8", label: "Online" },
  cardio:  { bg: "#fef3c7", border: "#f59e0b", text: "#78350f", sub: "#b45309", label: "Cardio" },
  funkc:   { bg: "#fae8ff", border: "#a855f7", text: "#581c87", sub: "#7e22ce", label: "Funkc" },
  diag:    { bg: "#fee2e2", border: "#ef4444", text: "#7f1d1d", sub: "#b91c1c", label: "Diagnostyka" },
  package: { bg: "#eef2ff", border: "#6366f1", text: "#312e81", sub: "#4338ca", label: "Pakiet" },
};

function serviceType(title: string): ServiceType {
  const t = title.toLowerCase();
  if (/online|zdaln|zoom|video|wideo/.test(t)) return "online";
  if (/funkc|mobil/.test(t)) return "funkc";
  if (/cardio|bieg|interw|spal/.test(t)) return "cardio";
  if (/diagn|fms|ocena|test|movement/.test(t)) return "diag";
  return "silowy";
}

/** When a booking is part of a package (packageName != null), force the
 *  indigo palette regardless of what the title text would resolve to. */
function bookingType(b: BookingEvent): ServiceType {
  if (b.packageName) return "package";
  return serviceType(b.title);
}

type ViewName = "timeGridDay" | "timeGridWeek" | "dayGridMonth";

export type DateOverrideRow = {
  date: string;            // YYYY-MM-DD
  shifts: { start: string; end: string }[];
  isClosed: boolean;
};

export default function CalendarClient({
  rules,
  overrides,
  bookings,
  trainerId,
  pendingRescheduleIds,
}: {
  rules: WorkingHourRule[];
  /** Per-date exceptions keyed by YYYY-MM-DD. Empty/undefined = trainer
   *  has no exceptions in the visible window; recurring `rules` apply. */
  overrides?: DateOverrideRow[];
  bookings: BookingEvent[];
  trainerId: string;
  pendingRescheduleIds: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: CalendarMode = isMode(modeParam) ? modeParam : "bookings";

  const pendingResSet = useMemo(() => new Set(pendingRescheduleIds), [pendingRescheduleIds]);
  const calRef = useRef<FullCalendar | null>(null);
  /** Wraps the FullCalendar render so WorkingHoursOverlay can reach into FC's
   *  DOM via querySelector to find day columns. */
  const calWrapperRef = useRef<HTMLDivElement | null>(null);
  /** Local mirror of working-hour rules. Saves are debounced auto-saves. */
  const [rulesState, setRulesState] = useState(rules);
  useEffect(() => { setRulesState(rules); }, [rules]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRulesChange = useCallback(
    (next: WorkingHourRule[]) => {
      setRulesState(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await saveAvailabilityRules(next.map((r) => ({ dow: r.dow, start: r.start, end: r.end })));
        router.refresh();
      }, 400);
    },
    [router],
  );

  // Per-date overrides keyed by YYYY-MM-DD for the WorkingHoursOverlay's
  // lookup. Server-side fetches happen in page.tsx; we mirror locally so
  // optimistic updates take effect immediately when the trainer saves.
  const [overridesState, setOverridesState] = useState<Record<string, DateOverrideRow>>(() => {
    const m: Record<string, DateOverrideRow> = {};
    for (const o of overrides ?? []) m[o.date] = o;
    return m;
  });
  useEffect(() => {
    const m: Record<string, DateOverrideRow> = {};
    for (const o of overrides ?? []) m[o.date] = o;
    setOverridesState(m);
  }, [overrides]);

  const handleOverrideChange = useCallback(
    async (date: string, shifts: { start: string; end: string }[] | null) => {
      // Optimistic local update so the overlay re-renders before the
      // server round-trip completes.
      setOverridesState((prev) => {
        const next = { ...prev };
        if (shifts === null) {
          next[date] = { date, shifts: [], isClosed: true };
        } else if (shifts.length === 0) {
          delete next[date];
        } else {
          next[date] = { date, shifts, isClosed: false };
        }
        return next;
      });
      await saveAvailabilityOverride(date, shifts);
      router.refresh();
    },
    [router],
  );

  const futureBookingsCount = useMemo(
    () => bookings.filter((b) => new Date(b.start).getTime() >= Date.now() && b.status !== "cancelled").length,
    [bookings],
  );

  // Mobile gets day-view by default; desktop gets week. SSR safe — start with
  // week and update on mount. Avoids a hydration flash because FullCalendar
  // mounts client-only anyway.
  const [view, setView] = useState<ViewName>("timeGridWeek");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<BookingEvent | null>(null);

  // Filter pills — toggle visibility by service type. Default: all on.
  // The pill on/off state filters which events FullCalendar receives,
  // so the count for hidden types stays in the side panel but the
  // grid is uncluttered.
  const allTypes: ServiceType[] = useMemo(() => ["silowy", "online", "cardio", "funkc", "diag", "package"], []);
  const [hiddenTypes, setHiddenTypes] = useState<Set<ServiceType>>(new Set());
  const toggleType = (t: ServiceType) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  // Current week (Mon → Sun) range, recomputed when title changes
  // because `title` is set in datesSet — proxy for "view date moved".
  const weekRange = useMemo(() => {
    const ref = calRef.current?.getApi().view.currentStart ?? new Date();
    const start = new Date(ref);
    const day = start.getDay();
    const diff = (day + 6) % 7; // Mon=0
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.getTime(), end: end.getTime() };
  }, [title]);

  const weekBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const t = new Date(b.start).getTime();
        return t >= weekRange.start && t < weekRange.end && b.status !== "cancelled";
      }),
    [bookings, weekRange],
  );

  const weekRevenue = useMemo(
    () => weekBookings.reduce((acc, b) => acc + (b.price ?? 0), 0),
    [weekBookings],
  );

  // Per-type counts for the side panel breakdown.
  const typeCounts = useMemo(() => {
    const counts: Record<ServiceType, number> = { silowy: 0, online: 0, cardio: 0, funkc: 0, diag: 0, package: 0 };
    for (const b of weekBookings) counts[bookingType(b)] = (counts[bookingType(b)] ?? 0) + 1;
    return counts;
  }, [weekBookings]);

  // Weekly capacity: sum of working-hour minutes ÷ 60-min slot length.
  // Capped at 99% so a sparse week with no rules doesn't read 200%.
  const weeklyHours = useMemo(() => {
    const mins = rulesState.reduce((acc, r) => {
      const [sh, sm] = r.start.split(":").map(Number);
      const [eh, em] = r.end.split(":").map(Number);
      return acc + Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }, 0);
    return Math.round(mins / 60);
  }, [rulesState]);

  // Trim the empty hours above the trainer's earliest band so the
  // calendar opens at the top of the work day. The first row of the
  // grid is the hour the earliest rule (or booking) actually starts
  // — no extra cushion above it. Falls back to 06:00 if there are
  // no rules and no bookings yet.
  const slotMinTime = useMemo(() => {
    const ruleStarts = rulesState.map((r) => {
      const [h, m] = r.start.split(":").map(Number);
      return h * 60 + m;
    });
    const bookingStarts = bookings.map((b) => {
      const d = new Date(b.start);
      return d.getHours() * 60 + d.getMinutes();
    });
    const candidates = [...ruleStarts, ...bookingStarts];
    if (candidates.length === 0) return "06:00:00";
    const minMin = Math.min(...candidates);
    const hourFloor = Math.max(0, Math.floor(minMin / 60));
    return `${String(hourFloor).padStart(2, "0")}:00:00`;
  }, [rulesState, bookings]);

  // Bottom of the grid is fixed at 22:00 per user direction so an
  // evening sessions / late-finish rule still reads as "early in the
  // day" rather than pushing the grid down. Extends past 22:00 only
  // if a rule or booking actually ends later.
  const slotMaxTime = useMemo(() => {
    const ruleEnds = rulesState.map((r) => {
      const [h, m] = r.end.split(":").map(Number);
      return h * 60 + m;
    });
    const bookingEnds = bookings.map((b) => {
      const d = new Date(b.end);
      return d.getHours() * 60 + d.getMinutes();
    });
    const candidates = [...ruleEnds, ...bookingEnds, 22 * 60];
    const maxMin = Math.max(...candidates);
    const hourCeil = Math.min(24, Math.ceil((maxMin + 30) / 60));
    return `${String(hourCeil).padStart(2, "0")}:00:00`;
  }, [rulesState, bookings]);

  const weekUtilisation = useMemo(() => {
    const cap = Math.max(1, weeklyHours);
    return Math.min(99, Math.round((weekBookings.length / cap) * 100));
  }, [weekBookings.length, weeklyHours]);

  // Lock html/body overflow so the page itself never scrolls — trainer scrolls
  // inside the calendar instead.
  //
  // Also DISABLE the wide-monitor `html { zoom: 1.1 }` from globals.css on
  // this page only. `zoom` is a non-standard CSS property that scales
  // visual rendering but desyncs from JS measurements: getBoundingClientRect
  // returns scaled pixels while offsetTop/offsetHeight return unscaled ones.
  // FullCalendar mixes both internally to position events absolutely, so
  // under zoom events drift past their actual time slots.
  //
  // To keep the studio sidebar at the same visual size as on every other
  // /studio page (where it's effectively 1.1×), we COMPENSATE: set the
  // sidebar's own zoom to 1.1 while html is at 1. Net effect: chrome
  // (sidebar) stays the same size, calendar grid is now pixel-accurate.
  // Only kicks in at ≥1500px because that's the breakpoint where the
  // global rule applies; below it nothing has zoom to begin with.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "clip";
    body.style.overflow = "clip";

    const apply = () => {
      const wide = window.innerWidth >= 1500;
      html.style.zoom = wide ? "1" : "";
      const sidebar = document.querySelector<HTMLElement>("[data-studio-sidebar]");
      if (sidebar) sidebar.style.zoom = wide ? "1.1" : "";
    };
    apply();
    window.addEventListener("resize", apply);

    return () => {
      window.removeEventListener("resize", apply);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.zoom = "";
      const sidebar = document.querySelector<HTMLElement>("[data-studio-sidebar]");
      if (sidebar) sidebar.style.zoom = "";
    };
  }, []);

  // Mobile gets day-view: 7 columns × 16 hours doesn't fit on phone screens.
  // Listens to viewport changes too — if user rotates or resizes, swap.
  // Tracks whether the user has manually picked a view; if they have, we stop
  // auto-switching (otherwise switching to month + rotating phone would yank
  // them back to day, which is annoying).
  const userPickedView = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      if (userPickedView.current) return;
      const target = mql.matches ? "timeGridDay" : "timeGridWeek";
      setView(target);
      calRef.current?.getApi().changeView(target);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Bookings-mode auto-jump: on first land in Rezerwacje, navigate the
  // calendar to the week containing the trainer's nearest upcoming
  // booking and scroll the timegrid to its start hour. So the trainer
  // doesn't have to click `>` to find their next session — they're
  // already looking at it. Runs once per session-in-bookings; manual
  // navigation afterwards stays sticky.
  const didBookingsJumpRef = useRef(false);
  useEffect(() => {
    if (didBookingsJumpRef.current) return;
    if (mode !== "bookings") return;
    const api = calRef.current?.getApi();
    if (!api) return;

    const now = Date.now();
    const upcoming = bookings
      .filter((b) => new Date(b.start).getTime() >= now && b.status !== "cancelled")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
    if (!upcoming) {
      didBookingsJumpRef.current = true;
      return;
    }

    const target = new Date(upcoming.start);
    api.gotoDate(target);
    // Scroll timegrid to the booking's start hour so it's visible without
    // manual scrolling. Subtract a bit so there's context above it.
    const scrollHour = Math.max(0, target.getHours() - 1);
    api.scrollToTime({
      hours: scrollHour,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    didBookingsJumpRef.current = true;
  }, [mode, bookings]);

  // FullCalendar height has to be a number/string — `height="100%"`
  // works only when the wrapper has a deterministic height, which we
  // don't have in this flex layout. Measure the viewport and subtract
  // the chrome above the grid (topbar + KPI + toolbar + filter pills
  // + breathing). Re-runs on resize.
  const [calHeight, setCalHeight] = useState(560);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const recompute = () => {
      const above = 110;
      const h = Math.max(420, window.innerHeight - above);
      setCalHeight(h);
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  // FullCalendar events: bookings only. Working-hours emerald wash is drawn
  // by the WorkingHoursOverlay (drag-editable), NOT as FC background events.
  // Pattern mode hides events entirely (the trainer is editing rules, not
  // looking at sessions). Filter pills suppress events of de-selected types.
  // Cancelled / no-show bookings are EXCLUDED from the calendar grid — they
  // only live in history/notifications. Past completed ones stay visible
  // but get a struck-through style so the trainer reads them as "done".
  const events: EventInput[] = useMemo(() => {
    if (mode === "pattern") return [];
    return bookings
      .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
      .filter((b) => !hiddenTypes.has(bookingType(b)))
      .map((b) => ({
        id: b.id,
        title: b.clientName,
        start: b.start,
        end: b.end,
        classNames: ["nz-booking", `nz-status-${b.status}`],
        extendedProps: { booking: b } as { booking: BookingEvent },
      }));
  }, [bookings, mode, hiddenTypes]);

  const navigate = (dir: "prev" | "next" | "today") => {
    const api = calRef.current?.getApi();
    if (!api) return;
    if (dir === "prev") api.prev();
    else if (dir === "next") api.next();
    else api.today();
    setTitle(formatTitle(api.view.currentStart, api.view.type as ViewName));
  };

  const changeView = (v: ViewName) => {
    userPickedView.current = true;
    setView(v);
    const api = calRef.current?.getApi();
    api?.changeView(v);
    if (api) setTitle(formatTitle(api.view.currentStart, v));
  };

  const handleEventClick = (arg: EventClickArg) => {
    const booking = (arg.event.extendedProps as { booking?: BookingEvent }).booking;
    if (booking) setSelected(booking);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-5 pb-8 grid gap-3">

      {/* Toolbar — 3-column grid so the date title sits in true horizontal
          center regardless of how wide the left (mode switcher + filter)
          and right (view picker) groups grow. */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ModeSwitcher mode={mode} bookingsBadge={futureBookingsCount} />
          {mode !== "pattern" && (
            <FilterDropdown
              allTypes={allTypes}
              hiddenTypes={hiddenTypes}
              toggleType={toggleType}
            />
          )}
          {mode === "pattern" && (
            <HolidayPresetButton
              overrides={overridesState}
              onApply={async (dates) => {
                // Batch-write closed-day overrides for each picked date.
                // Existing handleOverrideChange does optimistic UI + server
                // call per date — Promise.all so all rows hit the DB in
                // parallel and the calendar refreshes once at the end.
                await Promise.all(dates.map((d) => handleOverrideChange(d, null)));
              }}
              onRemove={(date) => handleOverrideChange(date, [])}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("prev")}
            aria-label="Poprzedni okres"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-tight mx-3 tabular-nums">{title}</h2>
          <button
            type="button"
            onClick={() => navigate("next")}
            aria-label="Następny okres"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        <div className="inline-flex bg-slate-100 rounded-[9px] p-[3px] gap-[2px]">
          {([
            { id: "timeGridDay", label: "Dzień" },
            { id: "timeGridWeek", label: "Tydzień" },
            { id: "dayGridMonth", label: "Miesiąc" },
          ] as const).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => changeView(v.id)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-[7px] transition ${
                view === v.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inline 7-day summary above the grid was redundant — the
          per-day hours already show in the day-headers ('12 godz.')
          and the green bands themselves convey window times. Removed. */}

      {/* Calendar */}
      <div
        ref={calWrapperRef}
        data-mode={mode}
        className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_8px_28px_-12px_rgba(2,6,23,0.12),0_2px_4px_-2px_rgba(2,6,23,0.06)]"
      >
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          firstDay={1} // Monday
          weekends={true}
          locale="pl"
          buttonText={{ today: "Dziś", month: "Mc", week: "Tydz", day: "Dzień" }}
          allDaySlot={false}
          // Slot range is computed from the trainer's actual rules +
          // booking endpoints (rounded to the surrounding hour with a
          // 30-min cushion). That keeps the top of the calendar at the
          // start of the work day instead of a generic 06:00.
          slotMinTime={slotMinTime}
          slotMaxTime={slotMaxTime}
          scrollTime={slotMinTime}
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          slotLabelFormat={{ hour: "numeric", minute: "2-digit", hour12: false }}
          nowIndicator
          dayHeaderFormat={{ weekday: "short", day: "numeric" }}
          dayHeaderContent={(arg) => {
            // Custom 3-line day header per design 32: tiny uppercase
            // dow, big day number (today in a filled circle), and a
            // mode-aware subtitle. In pattern mode we focus on the
            // working-hour total ('X godz.') because the trainer is
            // editing rules, not looking at sessions.
            const day = arg.date;
            const sameDay = (a: Date, b: Date) =>
              a.getFullYear() === b.getFullYear() &&
              a.getMonth() === b.getMonth() &&
              a.getDate() === b.getDate();
            const dow = day.getDay();
            // YYYY-MM-DD key for override lookup (Warsaw-local).
            const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
            const ov = overridesState[ymd];
            // Effective shifts for the day = override-layer when set, else
            // the recurring weekly rule. Drives the "X godz." sub-label so
            // the header reflects what the trainer actually sees on that
            // specific date.
            const effectiveShifts = ov
              ? ov.isClosed
                ? []
                : ov.shifts
              : rulesState.filter((r) => r.dow === dow).map((r) => ({ start: r.start, end: r.end }));
            const dayMins = effectiveShifts.reduce((acc, s) => {
              const [sh, sm] = s.start.split(":").map(Number);
              const [eh, em] = s.end.split(":").map(Number);
              return acc + Math.max(0, eh * 60 + em - (sh * 60 + sm));
            }, 0);
            const dayHours = Math.round(dayMins / 60);
            const isException = !!ov;
            const sessionCount = bookings.filter(
              (b) => sameDay(new Date(b.start), day) && b.status !== "cancelled",
            ).length;
            const freeSlots = Math.max(0, dayHours - sessionCount);

            const isToday = sameDay(day, new Date());
            const dowShort = day.toLocaleDateString("pl-PL", { weekday: "short" }).toUpperCase().replace(".", "");
            const dayNum = day.getDate();

            let subtitle: string;
            if (mode === "pattern") {
              subtitle = dayHours === 0 ? "wolne" : `${dayHours} godz.`;
            } else {
              const sessionLabel =
                sessionCount === 0
                  ? null
                  : `${sessionCount} ${sessionCount === 1 ? "sesja" : sessionCount < 5 ? "sesje" : "sesji"}`;
              const freeLabel =
                freeSlots === 0
                  ? null
                  : `${freeSlots} ${freeSlots === 1 ? "wolny" : freeSlots < 5 ? "wolne" : "wolnych"}`;
              subtitle =
                sessionLabel && freeLabel
                  ? `${sessionLabel} · ${freeLabel}`
                  : sessionLabel
                    ? sessionLabel
                    : freeLabel
                      ? freeLabel
                      : "wolne";
            }
            return (
              <div className="py-1.5 flex flex-col items-center gap-0.5 leading-tight relative">
                {/* Override marker — small amber dot in the header so the
                    trainer sees at a glance which dates have a one-off
                    exception instead of the recurring schedule. Tooltip
                    via title attr explains the convention. */}
                {isException && (
                  <span
                    className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-amber-500"
                    title="Wyjątek dla tej daty — różni się od cotygodniowego wzorca"
                  />
                )}
                <span className={"text-[10.5px] font-semibold uppercase tracking-[0.06em] " + (isToday ? "text-slate-900" : "text-slate-500")}>
                  {dowShort}{isToday ? " · dziś" : ""}
                </span>
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-[13px] font-semibold tabular-nums">
                    {dayNum}
                  </span>
                ) : (
                  <span className="text-[17px] font-semibold tracking-[-0.015em] tabular-nums">{dayNum}</span>
                )}
                <span className="text-[10px] text-slate-500">{subtitle}</span>
              </div>
            );
          }}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          // Dynamic height — measured from window inner-height minus
          // the chrome above the grid. Tall monitors → all 16 hours
          // fit without scroll. Short ones → internal scroll kicks in
          // but the bottom hour (22:00) is reachable.
          height={calHeight}
          events={events}
          eventClick={handleEventClick}
          datesSet={(arg) => setTitle(formatTitle(arg.view.currentStart, arg.view.type as ViewName))}
          eventContent={(arg) => {
            const booking = (arg.event.extendedProps as { booking?: BookingEvent }).booking;
            if (!booking) return null;
            const t = TYPE_STYLE[bookingType(booking)];
            const isPending = booking.status === "pending";
            const isCompleted = booking.status === "completed";
            return (
              <div
                className="h-full overflow-hidden rounded-[7px] px-[7px] py-[5px] text-[11px] leading-tight"
                style={{
                  backgroundColor: t.bg,
                  borderLeft: `3px ${isPending ? "dashed" : "solid"} ${t.border}`,
                  boxShadow: "0 1px 2px rgba(2,6,23,0.04)",
                  opacity: isCompleted ? 0.7 : 1,
                  textDecoration: isCompleted ? "line-through" : undefined,
                  color: t.text,
                  filter: isCompleted ? "grayscale(0.3)" : undefined,
                }}
              >
                <div className="font-semibold truncate text-[11.5px]" style={{ color: "#0f172a" }}>
                  {booking.clientName}
                </div>
                <div className="truncate mt-px" style={{ color: t.sub, fontSize: "10px", opacity: 0.85 }}>
                  {t.label} · {booking.title}
                </div>
                <div className="tabular-nums mt-px" style={{ color: "#64748b", fontSize: "9.5px" }}>
                  {arg.timeText} · {booking.price} zł
                </div>
              </div>
            );
          }}
        />
        <WorkingHoursOverlay
          rules={rulesState}
          fcWrapperRef={calWrapperRef}
          viewType={view}
          onChange={handleRulesChange}
          overrides={overridesState}
          onOverrideChange={handleOverrideChange}
          // Bookings mode hides the green wash entirely (the trainer
          // wants to see only sessions). Pattern mode is the only place
          // where the working-hour bands are visible and interactive.
          hidden={mode === "bookings"}
          // Match the dynamic slotMinTime so block positions stay
          // aligned with the rendered grid even when the calendar
          // doesn't start at 06:00.
          slotMinHour={parseInt(slotMinTime.slice(0, 2), 10)}
        />
      </div>

      {/* Selected booking modal */}
      {selected && (
        <BookingDetail
          booking={selected}
          trainerId={trainerId}
          hasPendingReschedule={pendingResSet.has(selected.id)}
          onClose={() => setSelected(null)}
          onAfterAction={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}

      {/* FullCalendar appearance overrides — keep them scoped to .nz-* classes
          we add above. Pulled inline as <style jsx global> to avoid touching
          globals.css. */}
      <style jsx global>{`
        /* Working-hour blocks are rendered by WorkingHoursOverlay (drag-edit
           overlay) directly into FC's day columns — no FC bg events involved. */
        .fc {
          font-family: inherit;
          --fc-border-color: #e2e8f0;
          --fc-today-bg-color: rgba(16, 185, 129, 0.07);
          --fc-page-bg-color: #fafbfc;
        }
        /* Force a fixed 30-min slot height so FullCalendar measures the
           same height that we render visually. Without the override on
           every level (row, lane, label) FC computed pixels-per-minute
           that disagreed with whatever CSS picked, and events drifted
           past their slots. We pin all three so measurements line up. */
        .fc .fc-timegrid-slot,
        .fc .fc-timegrid-slot-lane,
        .fc .fc-timegrid-slot-label {
          height: 40px !important;
          min-height: 40px !important;
          max-height: 40px !important;
        }
        .fc .fc-timegrid-slot { border-color: #f1f5f9 !important; }
        .fc .fc-timegrid-slot-lane.fc-timegrid-slot-minor { border-top-style: dotted; border-top-color: #f1f5f9 !important; }
        .fc .fc-timegrid-slot-lane:not(.fc-timegrid-slot-minor) { border-top: 1px solid #e2e8f0 !important; }
        /* Day-column borders subtly stronger than half-hour borders. */
        .fc-theme-standard td, .fc-theme-standard th { border-color: #e2e8f0; }
        /* Day header row sits in a tinted bar so it visually separates from
           the grid below. dayHeaderContent renders custom 3-line cells
           (DOW + big number + 'X sesji'), so we just neutralise FC's
           default cushion styling. */
        .fc-col-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        /* Hide every FullCalendar internal scrollbar (the day-header bar
           shows two tiny up/down arrows aligned with the body scrollbar
           by default — visual noise next to the month numbers). Scroll
           still works via wheel/touch, just no visible track. */
        .fc-scroller { scrollbar-width: none; -ms-overflow-style: none; }
        .fc-scroller::-webkit-scrollbar { display: none; width: 0; height: 0; }
        /* Pin the day-header row below the green availability blocks
           (z-[3]). FC's sticky header has its own stacking context, and
           in pattern mode the green wash visually needs to read as the
           top layer — without an explicit lower z-index the header can
           sit above the wash and clip the day-numbers visually. */
        .fc-col-header, .fc-col-header-cell { position: relative; z-index: 0; }
        .fc-col-header-cell-cushion {
          padding: 0 !important;
          color: inherit; text-transform: none; letter-spacing: 0;
          font-weight: inherit; font-size: inherit;
        }
        /* Allow the 7 day columns to shrink so they all fit on lg screens.
           Without this FullCalendar's default min-content widths can push
           Sunday off-screen when the studio sidebar (240px) eats horizontal
           room. */
        .fc-col-header-cell, .fc-timegrid-col { min-width: 0 !important; }
        .fc-col-header-cell-cushion { white-space: normal !important; }
        /* Compact slot-label gutter on the left. Default is ~40px which is
           plenty wide for "23:00" — pulling it down gives day columns a few
           extra px each. */
        .fc-timegrid-axis, .fc-timegrid-slot-label { width: 36px !important; min-width: 36px !important; }
        /* Today's column gets a very subtle emerald wash so it pops a
           little, but the heavy "this is today" cue is the black circle
           around the date number rendered by dayHeaderContent. */
        .fc-col-header-cell.fc-day-today {
          background: rgba(16, 185, 129, 0.04);
        }
        .fc-timegrid-slot-label-cushion {
          font-size: 11px; color: #64748b; font-variant-numeric: tabular-nums;
          font-weight: 500;
        }
        .fc-timegrid-axis { font-size: 10px; background: #fafbfc; }
        .fc-timegrid-axis-cushion { padding: 4px 8px; }
        /* Event styling — strip FC's default chrome on real events so our
           inner card paints. EXCLUDE .fc-bg-event so working-hours background
           events keep their wash (.nz-working-hours rule above). */
        .fc .fc-event:not(.fc-bg-event) { border: none !important; background: transparent !important; padding: 0 !important; }
        .fc-event-main { padding: 0 !important; }
        .nz-booking { cursor: pointer; border-radius: 6px; overflow: hidden; }
        .nz-booking:hover { transform: translateY(-1px); transition: transform .15s; box-shadow: 0 4px 12px -2px rgba(2,6,23,0.15); }
        /* Now indicator — keep red, slightly thicker for visibility. */
        .fc-now-indicator-line { border-color: #ef4444 !important; border-width: 2px; }
        .fc-now-indicator-arrow { border-color: #ef4444 !important; }
        /* Month view tweaks. */
        .fc-daygrid-day.fc-day-today { background: rgba(16, 185, 129, 0.07); }
        .fc-daygrid-day-number { font-size: 12px; color: #475569; padding: 6px 8px; font-weight: 500; }
        .fc-day-today .fc-daygrid-day-number {
          color: #047857; font-weight: 700;
          background: #d1fae5; border-radius: 9999px;
          width: 24px; height: 24px; padding: 0;
          display: inline-flex; align-items: center; justify-content: center;
          margin: 4px 4px 0 auto;
        }
        .fc-scrollgrid { border-radius: 0; border: none; }
        /* Force the FullCalendar grid table to fit container width
           exactly — without this its min-content sizing can push the
           7th day column (Sunday) past the wrapper's right edge where
           overflow:hidden then clips it. table-layout:fixed plus a 100%
           width forces equal-share sizing across all 7 day columns. */
        .fc-scrollgrid, .fc-scrollgrid table { width: 100% !important; }
        .fc .fc-col-header, .fc .fc-timegrid-body, .fc .fc-timegrid-body table { table-layout: fixed !important; width: 100% !important; }
      `}</style>
    </div>
  );
}

/**
 * Floating "Tydzień w skrócie" panel — design 32 layout. Bottom-right,
 * collapsible, breaks down the current week's bookings by service
 * type with totals + utilisation. Hidden when there are no bookings
 * (empty state would just be 0s across the board).
 */
function WeekSummaryPanel({
  counts,
  total,
  revenue,
  utilisation,
}: {
  counts: Record<ServiceType, number>;
  total: number;
  revenue: number;
  utilisation: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-6 bottom-6 z-30 inline-flex items-center gap-2 h-10 px-3.5 rounded-full bg-slate-900 text-white text-[12.5px] font-semibold shadow-[0_12px_36px_rgba(2,6,23,0.18)] hover:bg-black"
        title="Tydzień w skrócie"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
        Skrót tygodnia
      </button>
    );
  }
  return (
    <div className="fixed right-6 bottom-6 w-[300px] bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-[0_12px_36px_rgba(2,6,23,0.12)] z-30">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h4 className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-700">
          Tydzień w skrócie
        </h4>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-500 inline-flex items-center justify-center"
          title="Zwiń"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {(Object.entries(counts) as [ServiceType, number][])
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([key, n]) => {
            const cfg = TYPE_STYLE[key];
            return (
              <div key={key} className="flex items-center gap-2.5 text-[12.5px] text-slate-700 py-1">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: cfg.border }} />
                <span className="font-medium">{cfg.label}</span>
                <span className="ml-auto tabular-nums font-semibold text-slate-900">{n}</span>
              </div>
            );
          })}
        <div className="h-px bg-slate-100 my-2" />
        <div className="flex items-center text-[12.5px] text-slate-700 py-1">
          <span>{total} {total === 1 ? "sesja" : total < 5 ? "sesje" : "sesji"}</span>
          {revenue > 0 && (
            <span className="ml-auto tabular-nums font-semibold text-slate-900">
              {revenue.toLocaleString("pl-PL")} PLN
            </span>
          )}
        </div>
        <div className="flex items-center text-[12.5px] text-slate-700 py-1">
          <span>Obciążenie tygodnia</span>
          <span className="ml-auto tabular-nums font-semibold text-slate-900">{utilisation}%</span>
        </div>
      </div>
    </div>
  );
}

function formatTitle(date: Date, view: ViewName): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  if (view === "dayGridMonth") return `${POL_MONTHS_NOM[m]} ${y}`;
  if (view === "timeGridDay") {
    const dow = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"][date.getDay()];
    return `${dow}, ${d} ${POL_MONTHS_GEN[m]} ${y}`;
  }
  // Week: short range "27 kwi – 3 maj 2026" — using 3-letter month names
  // (POL_MONTHS_GEN_SHORT) so the title doesn't wrap the toolbar onto
  // multiple rows when months have long Polish names ("września", "sierpnia").
  const end = new Date(date);
  end.setDate(d + 6);
  const sameMonth = end.getMonth() === m;
  const sameYear = end.getFullYear() === y;
  const startStr = sameMonth ? `${d}` : `${d} ${POL_MONTHS_GEN_SHORT[m]}`;
  const endStr = `${end.getDate()} ${POL_MONTHS_GEN_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  return sameYear ? `${startStr} – ${endStr}` : `${d} ${POL_MONTHS_GEN_SHORT[m]} ${y} – ${endStr}`;
}

/* ============================================================
   Booking detail + actions modal
   Surfaces every operation that previously lived on /studio/bookings:
   confirm, cancel, mark completed, mark no-show, reschedule. Action set
   is gated by booking status and whether the session is in the past.
   ============================================================ */
function BookingDetail({
  booking, trainerId, hasPendingReschedule, onClose, onAfterAction,
}: {
  booking: BookingEvent;
  trainerId: string;
  hasPendingReschedule: boolean;
  onClose: () => void;
  onAfterAction: () => void;
}) {
  const s = STATUS_STYLE[booking.status];
  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const dateLabel = `${["niedz", "pon", "wt", "śr", "czw", "pt", "sob"][start.getDay()]}, ${start.getDate()} ${POL_MONTHS_GEN[start.getMonth()]} ${start.getFullYear()}`;
  const timeLabel = `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  const durationMin = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  const isPast = end.getTime() < Date.now();
  const isFutureUpcoming = !isPast && (booking.status === "paid" || booking.status === "confirmed" || booking.status === "pending");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_32px_80px_-16px_rgba(2,6,23,0.4)] overflow-hidden"
      >
        <div className={`px-6 py-3 ${s.bg} ${s.text} border-b ${s.border} text-[12px] font-semibold uppercase tracking-[0.06em] flex items-center justify-between`}>
          <span>{s.label}</span>
          {hasPendingReschedule && (
            <span className="text-[10px] bg-white/70 text-slate-700 px-2 py-0.5 rounded normal-case font-medium">
              Oczekuje na decyzję klienta
            </span>
          )}
        </div>
        <div className="px-6 pt-5 pb-4 grid gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Klient</div>
            <div className="flex items-center gap-3 mt-1.5">
              {booking.clientAvatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={booking.clientAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              )}
              <span className="text-[16px] font-semibold text-slate-900">{booking.clientName}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Usługa</div>
            <div className="text-[14px] text-slate-900 mt-0.5">{booking.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Data</div>
              <div className="text-[13px] text-slate-700 mt-0.5 capitalize">{dateLabel}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Czas</div>
              <div className="text-[13px] text-slate-700 mt-0.5 tabular-nums">{timeLabel}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Cena</div>
              <div className="text-[13px] text-slate-700 mt-0.5 tabular-nums">{booking.price} zł</div>
            </div>
          </div>
          {booking.note && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500">Notatka klienta</div>
              <div className="text-[13px] text-slate-700 mt-0.5 leading-relaxed">{booking.note}</div>
            </div>
          )}
          <Link
            href="/studio/messages"
            className="text-[12px] text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            Napisz do klienta →
          </Link>
        </div>

        {/* Actions — gated by status + time. */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
          {booking.status === "pending" && (
            <>
              <ActionForm action={cancelAsTrainer} bookingId={booking.id} onDone={onAfterAction} extraInputName="reason" extraInputValue="">
                <span className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 transition inline-flex items-center">
                  Odrzuć
                </span>
              </ActionForm>
              <ActionForm action={confirmBooking} bookingId={booking.id} onDone={onAfterAction}>
                <span className="h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition inline-flex items-center">
                  Potwierdź
                </span>
              </ActionForm>
            </>
          )}

          {isFutureUpcoming && booking.status !== "pending" && (
            <>
              <ActionForm action={cancelAsTrainer} bookingId={booking.id} onDone={onAfterAction}>
                <span className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 transition inline-flex items-center">
                  Anuluj
                </span>
              </ActionForm>
              <RescheduleDialog
                bookingId={booking.id}
                trainerId={trainerId}
                currentStartIso={booking.start}
                durationMin={durationMin}
                triggerLabel="Przenieś"
                triggerClassName="h-9 px-3.5 rounded-lg text-[13px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 transition inline-flex items-center"
              />
            </>
          )}

          {isPast && (booking.status === "paid" || booking.status === "confirmed") && (
            <>
              <ActionForm action={markNoShow} bookingId={booking.id} onDone={onAfterAction}>
                <span className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 transition inline-flex items-center">
                  Nieobecność
                </span>
              </ActionForm>
              <ActionForm action={markCompleted} bookingId={booking.id} onDone={onAfterAction}>
                <span className="h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-black transition inline-flex items-center">
                  Zakończona
                </span>
              </ActionForm>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tiny wrapper that turns a server action into a clickable form so we can
 *  keep all the imperative refresh/close logic in one place. */
function ActionForm({
  action, bookingId, onDone, children, extraInputName, extraInputValue,
}: {
  action: (formData: FormData) => Promise<unknown>;
  bookingId: string;
  onDone: () => void;
  children: React.ReactNode;
  extraInputName?: string;
  extraInputValue?: string;
}) {
  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      {extraInputName && <input type="hidden" name={extraInputName} value={extraInputValue ?? ""} />}
      <button type="submit" className="contents">
        {children}
      </button>
    </form>
  );
}

function pad(n: number) { return String(n).padStart(2, "0"); }

/* ===================== FILTER DROPDOWN ===================== */

function FilterDropdown({
  allTypes,
  hiddenTypes,
  toggleType,
}: {
  allTypes: ServiceType[];
  hiddenTypes: Set<ServiceType>;
  toggleType: (t: ServiceType) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const activeCount = allTypes.length - hiddenTypes.size;
  const allOn = hiddenTypes.size === 0;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-[30px] px-3 rounded-[8px] text-[11.5px] font-medium border bg-white text-slate-700 border-slate-200 hover:border-slate-300 transition"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        Filtry
        {!allOn && (
          <>
            <span className="text-slate-500">·</span>
            <span className="text-emerald-700 font-semibold">
              {activeCount}/{allTypes.length}
            </span>
          </>
        )}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={"text-slate-400 transition-transform " + (open ? "rotate-180" : "")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[240px] bg-white border border-slate-200 rounded-[12px] shadow-[0_20px_40px_-12px_rgba(2,6,23,0.16)] overflow-hidden z-[60]">
          <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center">
            <span className="text-[11px] uppercase tracking-[0.07em] text-slate-500 font-semibold">
              Typy sesji
            </span>
            <button
              type="button"
              onClick={() => {
                // Reset: turn everything ON.
                allTypes.forEach((t) => {
                  if (hiddenTypes.has(t)) toggleType(t);
                });
              }}
              disabled={allOn}
              className="text-[11px] text-emerald-700 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              Pokaż wszystkie
            </button>
          </div>
          <div className="py-1">
            {allTypes.map((t) => {
              const cfg = TYPE_STYLE[t];
              const off = hiddenTypes.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-slate-700 hover:bg-slate-50 transition text-left"
                >
                  <span
                    className={
                      "w-4 h-4 rounded-[4px] border-[1.5px] inline-flex items-center justify-center shrink-0 " +
                      (off ? "bg-white border-slate-300" : "bg-emerald-500 border-emerald-500")
                    }
                  >
                    {!off && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.border }} />
                  <span className="flex-1">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
