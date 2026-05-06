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
import { saveAvailabilityRules } from "@/app/studio/availability/actions";
import WorkingHoursOverlay from "./WorkingHoursOverlay";
import {
  ModeSwitcher,
  PatternSaveBar,
  PatternSummaryPanel,
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
  title: string;        // service or package name
  clientName: string;
  clientAvatar: string | null;
};

const POL_MONTHS_GEN = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
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
 *  to 'siłowy' as the safe default for "1:1 personal training". */
type ServiceType = "silowy" | "online" | "cardio" | "funkc" | "diag";
const TYPE_STYLE: Record<
  ServiceType,
  { bg: string; border: string; text: string; sub: string; label: string }
> = {
  silowy: { bg: "#ecfdf5", border: "#10b981", text: "#064e3b", sub: "#047857", label: "Siłowy" },
  online: { bg: "#eff6ff", border: "#3b82f6", text: "#1e3a8a", sub: "#1d4ed8", label: "Online" },
  cardio: { bg: "#fef3c7", border: "#f59e0b", text: "#78350f", sub: "#b45309", label: "Cardio" },
  funkc:  { bg: "#fae8ff", border: "#a855f7", text: "#581c87", sub: "#7e22ce", label: "Funkc" },
  diag:   { bg: "#fee2e2", border: "#ef4444", text: "#7f1d1d", sub: "#b91c1c", label: "Diagnostyka" },
};

function serviceType(title: string): ServiceType {
  const t = title.toLowerCase();
  if (/online|zdaln|zoom|video|wideo/.test(t)) return "online";
  if (/funkc|mobil/.test(t)) return "funkc";
  if (/cardio|bieg|interw|spal/.test(t)) return "cardio";
  if (/diagn|fms|ocena|test|movement/.test(t)) return "diag";
  return "silowy";
}

type ViewName = "timeGridDay" | "timeGridWeek" | "dayGridMonth";

export default function CalendarClient({
  rules,
  bookings,
  trainerId,
  pendingRescheduleIds,
}: {
  rules: WorkingHourRule[];
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
  /** Local mirror of working-hour rules. In bookings + availability modes we
   *  auto-save each change (existing behaviour). In pattern mode we batch:
   *  edits stay local until the trainer hits "Zapisz" on the sticky save bar,
   *  matching design 32's review-before-publish workflow. */
  const [rulesState, setRulesState] = useState(rules);
  useEffect(() => { setRulesState(rules); }, [rules]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingPattern, setSavingPattern] = useState(false);

  const handleRulesChange = useCallback(
    (next: WorkingHourRule[]) => {
      setRulesState(next);
      // Pattern mode batches saves; the rest auto-save (debounced).
      if (mode === "pattern") return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await saveAvailabilityRules(next.map((r) => ({ dow: r.dow, start: r.start, end: r.end })));
        router.refresh();
      }, 400);
    },
    [mode, router],
  );

  // "Dirty" only meaningful in pattern mode — count rules that diverge from
  // the server-side baseline. Cheap because the rule set is tiny.
  const dirtyCount = useMemo(() => {
    if (mode !== "pattern") return 0;
    const sig = (r: WorkingHourRule[]) =>
      [...r].sort((a, b) => a.dow - b.dow || a.start.localeCompare(b.start)).map((x) => `${x.dow}:${x.start}-${x.end}`).join(",");
    return sig(rules) === sig(rulesState) ? 0 : Math.max(1, Math.abs(rules.length - rulesState.length) || 1);
  }, [mode, rules, rulesState]);

  const dirtyDetail = useMemo(() => {
    if (mode !== "pattern" || dirtyCount === 0) return "";
    const dows = new Set<number>();
    rulesState.forEach((r) => {
      const before = rules.find((x) => x.dow === r.dow && x.start === r.start && x.end === r.end);
      if (!before) dows.add(r.dow);
    });
    rules.forEach((r) => {
      const after = rulesState.find((x) => x.dow === r.dow && x.start === r.start && x.end === r.end);
      if (!after) dows.add(r.dow);
    });
    const names = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
    return [...dows].map((d) => names[d]).join(" + ");
  }, [mode, rules, rulesState, dirtyCount]);

  const onSavePattern = useCallback(async () => {
    setSavingPattern(true);
    await saveAvailabilityRules(
      rulesState.map((r) => ({ dow: r.dow, start: r.start, end: r.end })),
    );
    setSavingPattern(false);
    router.refresh();
  }, [rulesState, router]);

  const onCancelPattern = useCallback(() => {
    setRulesState(rules);
  }, [rules]);

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
  const allTypes: ServiceType[] = useMemo(() => ["silowy", "online", "cardio", "funkc", "diag"], []);
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
    const counts: Record<ServiceType, number> = { silowy: 0, online: 0, cardio: 0, funkc: 0, diag: 0 };
    for (const b of weekBookings) counts[serviceType(b.title)] += 1;
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

  const weekUtilisation = useMemo(() => {
    const cap = Math.max(1, weeklyHours);
    return Math.min(99, Math.round((weekBookings.length / cap) * 100));
  }, [weekBookings.length, weeklyHours]);

  // Reset html { zoom: 1.1 } (set on >=1500px in globals.css) for the duration
  // of the calendar page. Same trick as /studio/design — without it 100vh-based
  // heights render at 110% physical and the page overflows the viewport,
  // creating an unwanted browser-level scroll. Also lock body overflow so the
  // page itself never scrolls; trainer scrolls inside the calendar instead.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevZoom = html.style.zoom;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.zoom = "1";
    html.style.overflow = "clip";
    body.style.overflow = "clip";
    return () => {
      html.style.zoom = prevZoom;
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
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

  // FullCalendar events: bookings only. Working-hours emerald wash is drawn
  // by the WorkingHoursOverlay (drag-editable), NOT as FC background events.
  // Pattern mode hides events entirely (the trainer is editing rules, not
  // looking at sessions); availability fades them via a class so they're
  // visible context but don't compete with the green availability bands.
  // Filter pills suppress events of de-selected types.
  const events: EventInput[] = useMemo(() => {
    if (mode === "pattern") return [];
    const fadedClass = mode === "availability" ? "nz-event-faded" : "";
    return bookings
      .filter((b) => !hiddenTypes.has(serviceType(b.title)))
      .map((b) => ({
        id: b.id,
        title: b.clientName,
        start: b.start,
        end: b.end,
        classNames: ["nz-booking", `nz-status-${b.status}`, fadedClass].filter(Boolean) as string[],
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
    <div className="mx-auto max-w-[1280px] px-4 sm:px-8 pt-5 pb-8 grid gap-3">
      {/* Internal topbar — replaces the studio shell's StudioTopBar
          on /studio/calendar (hidden via StudioTopBarSlot). Title +
          mode-specific KPI line on the left, action buttons on the
          right. The primary CTA + subtitle adapt to mode so the
          screen tells the trainer what they're looking at. */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h1 className="text-[24px] sm:text-[26px] font-semibold tracking-[-0.022em] m-0">
            Kalendarz
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-1">
            {mode === "pattern" ? (
              <>
                {weeklyHours} godz./tydz · profil &quot;Podstawowy&quot; aktywny
              </>
            ) : mode === "availability" ? (
              <>
                {weeklyHours} godz./tydz · {weekUtilisation}% wypełnienia · {Math.max(0, weeklyHours - weekBookings.length)} wolnych slotów w tygodniu
              </>
            ) : (
              <>
                {weekBookings.length} {weekBookings.length === 1 ? "sesja" : weekBookings.length < 5 ? "sesje" : "sesji"} w tym tygodniu
                {weekRevenue > 0 && ` · ${weekRevenue.toLocaleString("pl-PL")} PLN przychodu`}
                {weekUtilisation > 0 && ` · ${weekUtilisation}% wypełnienia`}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled
            title="Wkrótce — eksport do iCal"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Eksport .ics
          </button>
          <button
            type="button"
            disabled
            title="Wkrótce — synchronizacja z Google Calendar"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Sync Google
          </button>
          <button
            type="button"
            disabled
            title={
              mode === "pattern"
                ? "Wkrótce — wiele okien w jednym dniu"
                : mode === "availability"
                  ? "Wkrótce — urlopy, święta, dodatkowe godziny"
                  : "Wkrótce — tworzenie sesji ręcznie z kalendarza"
            }
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold disabled:opacity-60"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {mode === "pattern" ? "Nowe okno" : mode === "availability" ? "Dodaj wyjątek" : "Nowa sesja"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("today")}
            className="h-9 px-3.5 text-[13px] font-medium text-slate-700 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition"
          >
            Dziś
          </button>
          <div className="inline-flex items-center gap-px ml-1">
            <button
              type="button"
              onClick={() => navigate("prev")}
              aria-label="Poprzedni okres"
              className="w-9 h-9 inline-flex items-center justify-center rounded-l-lg border border-slate-200 hover:bg-slate-50 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => navigate("next")}
              aria-label="Następny okres"
              className="w-9 h-9 inline-flex items-center justify-center rounded-r-lg border border-slate-200 border-l-0 hover:bg-slate-50 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-tight ml-3 tabular-nums">{title}</h2>
        </div>

        <ModeSwitcher mode={mode} bookingsBadge={futureBookingsCount} />

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

      {/* Filter pills — toggle service-type visibility on the grid.
          Hidden for pattern mode (events suppressed entirely there).
          Style follows design 32 .filt: dot + label only, no inline
          count (the per-type breakdown lives in 'Tydzień w skrócie'). */}
      {mode !== "pattern" && (
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          {allTypes.map((t) => {
            const cfg = TYPE_STYLE[t];
            const off = hiddenTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={
                  "inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] text-[11.5px] font-medium border transition " +
                  (off
                    ? "bg-white text-slate-400 border-slate-200 line-through decoration-slate-300"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300")
                }
                title={off ? `Pokaż ${cfg.label}` : `Ukryj ${cfg.label}`}
              >
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: cfg.border }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Pattern mode 7-day summary above the grid */}
      {mode === "pattern" && <PatternSummaryPanel rules={rulesState} />}

      {/* Calendar */}
      <div
        ref={calWrapperRef}
        className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_8px_28px_-12px_rgba(2,6,23,0.12),0_2px_4px_-2px_rgba(2,6,23,0.06)]"
      >
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          firstDay={1} // Monday
          locale="pl"
          buttonText={{ today: "Dziś", month: "Mc", week: "Tydz", day: "Dzień" }}
          allDaySlot={false}
          // 06:00–23:00 (17 hours). Page is locked, calendar has internal
          // scroll, so showing the full plausible day window costs nothing.
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
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
            const dayMins = rulesState
              .filter((r) => r.dow === dow)
              .reduce((acc, r) => {
                const [sh, sm] = r.start.split(":").map(Number);
                const [eh, em] = r.end.split(":").map(Number);
                return acc + Math.max(0, eh * 60 + em - (sh * 60 + sm));
              }, 0);
            const dayHours = Math.round(dayMins / 60);
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
              <div className="py-1.5 flex flex-col items-center gap-0.5 leading-tight">
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
          // Compact container: ~5-6 hours visible, internal scroll for the rest.
          // The page is locked (no body scroll), so the trainer scrolls the
          // calendar itself to see hours outside the visible window.
          // expandRows + height="auto" together cause runaway layout in some
          // flex parent contexts (slot labels grow to ~1M px), so we pin a value.
          height="560px"
          events={events}
          eventClick={handleEventClick}
          datesSet={(arg) => setTitle(formatTitle(arg.view.currentStart, arg.view.type as ViewName))}
          eventContent={(arg) => {
            const booking = (arg.event.extendedProps as { booking?: BookingEvent }).booking;
            if (!booking) return null;
            const t = TYPE_STYLE[serviceType(booking.title)];
            const isPending = booking.status === "pending";
            const isCancelled = booking.status === "cancelled" || booking.status === "no_show";
            const isCompleted = booking.status === "completed";
            return (
              <div
                className="h-full overflow-hidden rounded-[7px] px-[7px] py-[5px] text-[11px] leading-tight"
                style={{
                  backgroundColor: t.bg,
                  borderLeft: `3px ${isPending ? "dashed" : "solid"} ${t.border}`,
                  boxShadow: "0 1px 2px rgba(2,6,23,0.04)",
                  opacity: isCancelled ? 0.55 : 1,
                  textDecoration: isCancelled ? "line-through" : undefined,
                  color: t.text,
                  filter: isCompleted ? "grayscale(0.4)" : undefined,
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
          // Bookings mode hides the green wash entirely (the trainer
          // wants to see only sessions). Availability mode shows the
          // wash but read-only — no clicks, no editor dialog. Pattern
          // mode is the only place where bands are interactive.
          readOnly={mode === "availability"}
          hidden={mode === "bookings"}
        />
      </div>

      {/* Type legend — colors come from the service-type heuristic
          (siłowy / online / cardio / funkc / diag). Status is implied
          via dashed border (oczekuje), opacity (anulowane/nieobecność)
          and grayscale (zakończone) on the cards themselves. */}
      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap px-1">
        {(Object.entries(TYPE_STYLE) as [ServiceType, (typeof TYPE_STYLE)[ServiceType]][]).map(([key, t]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-[3px]"
              style={{ background: t.bg, borderLeft: `2px solid ${t.border}` }}
            />
            {t.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] border-2 border-dashed" style={{ borderColor: "#fb923c" }} />
          Oczekuje
        </span>
        <span className="inline-flex items-center gap-1.5 ml-auto">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(16,185,129,0.20)" }} />
          Godziny pracy <span className="text-slate-400">— kliknij aby edytować</span>
        </span>
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

      {/* Pattern-mode sticky save bar — only visible when the trainer
          has touched the rules in this mode. Other modes auto-save. */}
      {mode === "pattern" && (
        <PatternSaveBar
          dirtyCount={dirtyCount}
          detail={dirtyDetail}
          saving={savingPattern}
          onSave={onSavePattern}
          onCancel={onCancelPattern}
        />
      )}

      {/* Floating week-summary panel (only in bookings mode — the
          breakdown is meaningless when events are hidden / faded). */}
      {mode === "bookings" && weekBookings.length > 0 && (
        <WeekSummaryPanel
          counts={typeCounts}
          total={weekBookings.length}
          revenue={weekRevenue}
          utilisation={weekUtilisation}
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
        /* Hour rows have a clearer slate border; half-hour gridlines drop to
           a near-invisible dotted stroke so the eye locks onto whole hours. */
        .fc .fc-timegrid-slot { height: 28px !important; border-color: #f1f5f9 !important; }
        .fc .fc-timegrid-slot-lane.fc-timegrid-slot-minor { border-top-style: dotted; border-top-color: #f1f5f9 !important; }
        .fc .fc-timegrid-slot-lane:not(.fc-timegrid-slot-minor) { border-top: 1px solid #e2e8f0 !important; }
        /* Day-column borders subtly stronger than half-hour borders. */
        .fc-theme-standard td, .fc-theme-standard th { border-color: #e2e8f0; }
        /* Day header row sits in a tinted bar so it visually separates from
           the grid below. dayHeaderContent renders custom 3-line cells
           (DOW + big number + 'X sesji'), so we just neutralise FC's
           default cushion styling. */
        .fc-col-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .fc-col-header-cell-cushion {
          padding: 0 !important;
          color: inherit; text-transform: none; letter-spacing: 0;
          font-weight: inherit; font-size: inherit;
        }
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
        /* Availability-mode events: faded per design 32 (.3 opacity)
           so the green availability wash reads as primary, but events
           stay visible as context. */
        .nz-event-faded { opacity: .3; }
        .nz-event-faded:hover { opacity: .5; transform: none !important; box-shadow: none !important; }
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
  // Week: show range "27 kwiet – 3 maja 2026"
  const end = new Date(date);
  end.setDate(d + 6);
  const sameMonth = end.getMonth() === m;
  const sameYear = end.getFullYear() === y;
  const startStr = sameMonth ? `${d}` : `${d} ${POL_MONTHS_GEN[m]}`;
  const endStr = `${end.getDate()} ${POL_MONTHS_GEN[end.getMonth()]} ${end.getFullYear()}`;
  return sameYear ? `${startStr} – ${endStr}` : `${d} ${POL_MONTHS_GEN[m]} ${y} – ${endStr}`;
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
  action: (formData: FormData) => Promise<void>;
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
