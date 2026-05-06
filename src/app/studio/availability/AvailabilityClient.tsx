"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAvailabilityRules, type AvailabilityRule } from "./actions";
import type { DayRule } from "./page";

const DAYS: { dow: number; label: string; short: string }[] = [
  { dow: 1, label: "Poniedziałek", short: "Pn" },
  { dow: 2, label: "Wtorek", short: "Wt" },
  { dow: 3, label: "Środa", short: "Śr" },
  { dow: 4, label: "Czwartek", short: "Cz" },
  { dow: 5, label: "Piątek", short: "Pt" },
  { dow: 6, label: "Sobota", short: "Sb" },
  { dow: 0, label: "Niedziela", short: "Nd" },
];

const HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

type DayState = { enabled: boolean; start: string; end: string };

export default function AvailabilityClient({
  initialByDow,
  published,
  weeklyHours,
  daysSpan,
  estimatedSlots14d,
  fillRate,
  slug: _slug,
}: {
  initialByDow: Record<number, DayRule | null>;
  published: boolean;
  weeklyHours: number;
  daysSpan: string;
  estimatedSlots14d: number;
  fillRate: number;
  slug: string | null;
}) {
  const router = useRouter();

  const initialDays = useMemo<Record<number, DayState>>(() => {
    const map: Record<number, DayState> = {};
    DAYS.forEach((d) => {
      const r = initialByDow[d.dow];
      map[d.dow] = {
        enabled: r !== null,
        start: r?.start ?? "09:00",
        end: r?.end ?? "18:00",
      };
    });
    return map;
  }, [initialByDow]);

  const [days, setDays] = useState<Record<number, DayState>>(initialDays);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return DAYS.some((d) => {
      const a = initialDays[d.dow];
      const b = days[d.dow];
      return a.enabled !== b.enabled || a.start !== b.start || a.end !== b.end;
    });
  }, [days, initialDays]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    DAYS.forEach((d) => {
      const a = initialDays[d.dow];
      const b = days[d.dow];
      if (a.enabled !== b.enabled || a.start !== b.start || a.end !== b.end) n++;
    });
    return n;
  }, [days, initialDays]);

  const toggleDay = (dow: number) => {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], enabled: !prev[dow].enabled } }));
  };
  const setDayTime = (dow: number, field: "start" | "end", value: string) => {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }));
  };

  const copyMondayToAll = () => {
    const tpl = days[1];
    setDays((prev) => {
      const next: Record<number, DayState> = { ...prev };
      DAYS.forEach((d) => {
        if (d.dow !== 1 && d.dow !== 0) next[d.dow] = { ...tpl };
      });
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const rules: AvailabilityRule[] = [];
    for (const d of DAYS) {
      const s = days[d.dow];
      if (!s.enabled) continue;
      if (!HHMM.test(s.start) || !HHMM.test(s.end)) {
        setSaving(false);
        setError(`${d.label}: nieprawidłowy format godziny.`);
        return;
      }
      if (s.start >= s.end) {
        setSaving(false);
        setError(`${d.label}: koniec musi być później niż początek.`);
        return;
      }
      rules.push({ dow: d.dow, start: s.start, end: s.end });
    }
    await saveAvailabilityRules(rules);
    setSaving(false);
    setSavedAt(Date.now());
    router.refresh();
  };

  const onDiscard = () => {
    setDays(initialDays);
    setError(null);
  };

  // Detail line for the save bar — list which days changed.
  const dirtyDetail = useMemo(() => {
    const changed: string[] = [];
    DAYS.forEach((d) => {
      const a = initialDays[d.dow];
      const b = days[d.dow];
      if (a.enabled !== b.enabled || a.start !== b.start || a.end !== b.end) {
        changed.push(d.label.toLowerCase());
      }
    });
    return changed.join(" + ");
  }, [days, initialDays]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-7 py-5 sm:py-7">
      {/* TOPBAR */}
      <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] tracking-[-0.022em] font-semibold text-slate-900 m-0">
            Dostępność
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-[560px] leading-[1.5]">
            Ustaw godziny, w których przyjmujesz klientów. Wzorce tygodniowe + wyjątki + urlopy. Klienci widzą tylko
            sloty pasujące do <b className="text-slate-700 font-semibold">długości usługi</b> i Twoich{" "}
            <b className="text-slate-700 font-semibold">zasad rezerwacji</b>.
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button
            type="button"
            disabled
            title="Wkrótce — eksport do iCal"
            className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[9px] bg-white border border-slate-200 text-[13px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Eksportuj iCal
          </button>
          <button
            type="button"
            disabled
            title="Wkrótce — synchronizacja z Google Calendar"
            className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[9px] bg-white border border-slate-200 text-[13px] font-medium text-slate-500 disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Synchronizuj z Google
          </button>
          <button
            type="button"
            disabled
            title="Wkrótce — wyjątki, urlopy, dodatkowe godziny"
            className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[9px] bg-slate-900 text-white text-[13px] font-medium disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Dodaj wyjątek
          </button>
        </div>
      </div>

      {/* STATUS BAR */}
      <StatusBar
        published={published}
        weeklyHours={weeklyHours}
        daysSpan={daysSpan}
        estimatedSlots14d={estimatedSlots14d}
        fillRate={fillRate}
        savedAt={savedAt}
        saving={saving}
      />

      {/* LAYOUT — main + side */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-5">
          <WeeklyPatternCard
            days={days}
            toggleDay={toggleDay}
            setDayTime={setDayTime}
            copyMondayToAll={copyMondayToAll}
          />
          <TimelinePreviewCard days={days} />
          <ExceptionsCard />
          <RulesCard />
        </div>
        <div className="space-y-5">
          <MiniCalCard />
          <TipCard />
          <LocationsCard />
          <NotificationsCard />
        </div>
      </div>

      {/* SAVE BAR — sticky bottom; appears only when dirty. */}
      {(dirty || saving || error) && (
        <div className="sticky bottom-4 z-30 mt-6 rounded-[14px] bg-slate-900 text-white px-5 py-3.5 flex flex-wrap gap-3 items-center justify-between shadow-[0_12px_36px_rgba(2,6,23,0.18)]">
          <div className="text-[13.5px]">
            {error ? (
              <b className="text-rose-300 font-semibold">Błąd: {error}</b>
            ) : saving ? (
              <b className="font-semibold">Zapisuję…</b>
            ) : (
              <>
                <b className="font-semibold">
                  {dirtyCount} {dirtyCount === 1 ? "niezapisana zmiana" : "niezapisane zmiany"}
                </b>
                {dirtyDetail && (
                  <div className="text-[11.5px] text-white/55 mt-0.5 font-mono">{dirtyDetail}</div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="h-9 px-3.5 rounded-lg bg-white/10 text-white text-[13px] font-medium disabled:opacity-50"
            >
              Cofnij
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="h-9 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-50"
            >
              Zapisz i opublikuj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ STATUS BAR ============ */
function StatusBar({
  published,
  weeklyHours,
  daysSpan,
  estimatedSlots14d,
  fillRate,
  savedAt,
  saving,
}: {
  published: boolean;
  weeklyHours: number;
  daysSpan: string;
  estimatedSlots14d: number;
  fillRate: number;
  savedAt: number | null;
  saving: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[repeat(4,1fr)_auto] bg-white border border-slate-200 rounded-[14px] mb-6 overflow-hidden">
      <div className="px-5 py-3.5 border-r border-emerald-200 bg-emerald-50">
        <div className="text-[11.5px] font-medium text-emerald-700 inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
          Status profilu
        </div>
        <div className="text-[22px] font-semibold tracking-[-0.018em] text-emerald-700 mt-1">
          {published ? "Otwarty" : "Zamknięty"}
          <span className="text-[12px] text-emerald-700/70 font-medium ml-1.5">
            {published ? "· widoczny w katalogu" : "· schowany"}
          </span>
        </div>
      </div>
      <KpiCell
        label="Godziny / tydz."
        icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        }
        value={Math.round(weeklyHours).toString()}
        unit={`h · ${daysSpan}`}
      />
      <KpiCell
        label="Wolnych slotów"
        suffix="(14 dni)"
        icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        }
        value={String(estimatedSlots14d)}
      />
      <KpiCell
        label="Wypełnienie"
        icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h6m6 0h6M12 22v-6" />
          </svg>
        }
        value={String(fillRate)}
        unit="% ostatnie 30 dni"
      />
      <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-l border-slate-200">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
          <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-[12px] text-slate-600 leading-[1.4]">
          <b className="block text-slate-900 text-[13px]">
            {saving ? "Zapisuję…" : "Wszystko zsynchronizowane"}
          </b>
          {savedAt
            ? `Ostatni zapis ${new Date(savedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`
            : "Ustaw godziny pracy poniżej"}
        </div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  suffix,
  icon,
  value,
  unit,
}: {
  label: string;
  suffix?: string;
  icon: React.ReactNode;
  value: string;
  unit?: string;
}) {
  return (
    <div className="px-5 py-3.5 border-r border-slate-200 last:border-r-0">
      <div className="text-[11.5px] font-medium text-slate-500 inline-flex items-center gap-1.5">
        <span className="text-slate-500">{icon}</span>
        {label}
        {suffix && <span className="text-slate-400 font-normal">{suffix}</span>}
      </div>
      <div className="text-[22px] font-semibold tracking-[-0.018em] mt-1">
        {value}
        {unit && <span className="text-[12px] text-slate-500 font-medium ml-1">{unit}</span>}
      </div>
    </div>
  );
}

/* ============ WEEKLY PATTERN ============ */
function WeeklyPatternCard({
  days,
  toggleDay,
  setDayTime,
  copyMondayToAll,
}: {
  days: Record<number, DayState>;
  toggleDay: (dow: number) => void;
  setDayTime: (dow: number, field: "start" | "end", value: string) => void;
  copyMondayToAll: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] m-0">Wzorzec tygodniowy</h3>
          <p className="text-[12.5px] text-slate-500 leading-[1.45] mt-1 max-w-[460px]">
            Twój zwykły rozkład — obowiązuje, gdy nie ma wyjątku. Kliknij godziny, aby je zmienić.
          </p>
        </div>
        <button
          type="button"
          onClick={copyMondayToAll}
          className="text-[12px] text-emerald-700 font-medium px-2.5 py-1.5 rounded-[7px] hover:bg-emerald-50 shrink-0"
        >
          ⎘ Skopiuj poniedziałek do pn–sb
        </button>
      </div>

      <div className="inline-flex p-[3px] bg-slate-100 rounded-[9px] gap-0.5 text-[12px] font-medium mb-4">
        <span className="px-3.5 py-1.5 rounded-md bg-white text-slate-900 inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          Profil podstawowy
          <span className="text-[10px] px-[5px] py-px bg-emerald-500 text-white rounded font-semibold">aktywny</span>
        </span>
        <span className="px-3.5 py-1.5 rounded-md text-slate-500 cursor-not-allowed" title="Wkrótce">
          Lato (cz–sie)
        </span>
        <span className="px-3.5 py-1.5 rounded-md text-slate-500 cursor-not-allowed" title="Wkrótce">
          + nowy profil
        </span>
      </div>

      <div>
        {DAYS.map((d, i) => {
          const state = days[d.dow];
          const enabled = state.enabled;
          const hours =
            enabled
              ? (() => {
                  const [sh, sm] = state.start.split(":").map(Number);
                  const [eh, em] = state.end.split(":").map(Number);
                  const h = Math.max(0, eh + em / 60 - (sh + sm / 60));
                  return `${Math.round(h)} godz.`;
                })()
              : "wolne";
          return (
            <div
              key={d.dow}
              className={
                "grid grid-cols-[100px_50px_1fr] items-center gap-4 py-3.5 " +
                (i < DAYS.length - 1 ? "border-b border-slate-100 " : "") +
                (enabled ? "" : "opacity-55")
              }
            >
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-slate-900">{d.label}</span>
                <span className="text-[11px] text-slate-500 mt-0.5">{hours}</span>
              </div>
              <Toggle pressed={enabled} onClick={() => toggleDay(d.dow)} label={d.label} />
              {enabled ? (
                <div className="flex flex-wrap gap-2 items-center">
                  <TimeRange
                    start={state.start}
                    end={state.end}
                    onStartChange={(v) => setDayTime(d.dow, "start", v)}
                    onEndChange={(v) => setDayTime(d.dow, "end", v)}
                  />
                  <button
                    type="button"
                    disabled
                    title="Wkrótce — wiele okien w jednym dniu"
                    className="inline-flex items-center gap-1.5 h-8 px-3 border border-dashed border-slate-300 rounded-lg text-[12px] text-slate-400 font-medium cursor-not-allowed"
                  >
                    + Dodaj okno
                  </button>
                </div>
              ) : (
                <span className="text-[11.5px] text-slate-500 italic px-2.5 py-1.5 bg-slate-50 rounded-lg w-fit">
                  Nie pracuję — klienci nie zobaczą slotów
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={
        "w-[38px] h-[22px] rounded-full relative transition-colors shrink-0 " +
        (pressed ? "bg-emerald-500" : "bg-slate-200")
      }
    >
      <span
        className={
          "absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform " +
          (pressed ? "translate-x-4" : "translate-x-0")
        }
      />
    </button>
  );
}

function TimeRange({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 font-mono text-[12.5px]">
      <input
        type="time"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="border-0 bg-transparent w-[68px] text-center px-1 py-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
      <span className="text-slate-400 text-[11px]">–</span>
      <input
        type="time"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="border-0 bg-transparent w-[68px] text-center px-1 py-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
    </div>
  );
}

/* ============ TIMELINE PREVIEW ============ */
function TimelinePreviewCard({ days }: { days: Record<number, DayState> }) {
  // 06:00–24:00 = 18-hour visualization span. Convert HH:MM to %.
  const SPAN_START = 6;
  const SPAN_HOURS = 18;
  const pct = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return Math.max(0, Math.min(100, ((h + m / 60 - SPAN_START) / SPAN_HOURS) * 100));
  };

  return (
    <div className="bg-gradient-to-b from-white to-slate-50/60 border border-slate-200 rounded-2xl p-6">
      <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
        <h4 className="text-[13px] font-semibold m-0">Podgląd · jak Twój tydzień widzi klient</h4>
        <div className="flex gap-3.5 text-[11px] text-slate-500 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-300" /> Wolne
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" /> Zarezerwowane
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[38px_1fr] gap-2.5">
        <div className="relative h-[200px] text-[10px] text-slate-400 font-mono">
          {[6, 9, 12, 15, 18, 21, 24].map((h, i) => (
            <div
              key={h}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(i / 6) * 100}%` }}
            >
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>
        <div>
          {DAYS.map((d) => {
            const s = days[d.dow];
            const enabled = s.enabled;
            return (
              <div
                key={d.dow}
                className="grid grid-cols-[28px_1fr] items-center gap-2.5 h-[26px] mb-1"
              >
                <span className="text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em]">
                  {d.short}
                </span>
                <div
                  className={
                    "relative h-[14px] rounded-[4px] overflow-hidden " +
                    (enabled
                      ? "bg-slate-100"
                      : "bg-[repeating-linear-gradient(45deg,rgb(241,245,249),rgb(241,245,249)_4px,rgb(248,250,252)_4px,rgb(248,250,252)_8px)]")
                  }
                >
                  {enabled && (
                    <span
                      className="absolute top-0 bottom-0 bg-emerald-300 rounded-[3px]"
                      style={{
                        left: `${pct(s.start)}%`,
                        width: `${Math.max(0, pct(s.end) - pct(s.start))}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ EXCEPTIONS ============ */
function ExceptionsCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] m-0">Wyjątki i urlopy</h3>
          <p className="text-[12.5px] text-slate-500 leading-[1.45] mt-1 max-w-[460px]">
            Pojedyncze dni nadpisują wzorzec. Wkrótce — święta z PL, urlopy, dodatkowe godziny.
          </p>
        </div>
      </div>
      <div className="rounded-[12px] border border-dashed border-slate-300 px-5 py-8 text-center">
        <div className="text-[14px] font-medium text-slate-700">Wkrótce dostępne</div>
        <div className="text-[12px] text-slate-500 mt-1.5 max-w-[420px] mx-auto leading-[1.55]">
          Zamykanie dnia, urlopy z auto-wiadomością „wracam X stycznia", święta z polskiego kalendarza.
          Dotychczas możesz wyłączyć cały dzień we wzorcu wyżej.
        </div>
      </div>
    </div>
  );
}

/* ============ RULES ============ */
function RulesCard() {
  // Visual-only segmented controls — wired once a per-trainer
  // booking_rules row exists. Local state lets the user feel the
  // segmented controls move; no persistence yet.
  const [slot, setSlot] = useState("60 min");
  const [buffer, setBuffer] = useState(15);
  const [advance, setAdvance] = useState(4);
  const [range, setRange] = useState("30 dni");
  const [auto, setAuto] = useState("Wszystkie");
  const [cancel, setCancel] = useState("24 h");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] m-0">Zasady rezerwacji</h3>
          <p className="text-[12.5px] text-slate-500 leading-[1.45] mt-1 max-w-[460px]">
            Co klient musi wiedzieć przed rezerwacją. Wkrótce zsynchronizuje się z usługami i pakietami.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-slate-200 rounded-[12px] overflow-hidden">
        <RuleCell label="Długość slotu" hint="Bazowa siatka — usługi mogą mieć inne czasy.">
          <Segmented
            options={["30 min", "45 min", "60 min", "90 min", "2 h"]}
            value={slot}
            onChange={setSlot}
          />
        </RuleCell>
        <RuleCell label="Bufor między sesjami" hint="Czas na zmianę / dezynfekcję sprzętu / dojazd.">
          <Stepper unit="min" value={buffer} onChange={setBuffer} />
        </RuleCell>
        <RuleCell label="Min. wyprzedzenie" hint="Klient nie może zarezerwować w ostatniej chwili.">
          <Stepper unit="godz." value={advance} onChange={setAdvance} />
        </RuleCell>
        <RuleCell label="Maks. zasięg w przód" hint="Jak daleko w przyszłość mogą bookować.">
          <Segmented options={["14 dni", "30 dni", "60 dni", "90 dni"]} value={range} onChange={setRange} />
        </RuleCell>
        <RuleCell label="Auto-akceptacja" hint="Czy rezerwacje wymagają Twojego potwierdzenia.">
          <Segmented options={["Wszystkie", "Tylko stali", "Ręcznie"]} value={auto} onChange={setAuto} />
        </RuleCell>
        <RuleCell label="Polityka anulacji" hint="Granica pełnego zwrotu. Po niej: 50% / nowy termin.">
          <Segmented options={["12 h", "24 h", "48 h"]} value={cancel} onChange={setCancel} />
        </RuleCell>
      </div>
      <div className="text-[11.5px] text-slate-400 mt-3 italic">
        Wartości widoczne — zapis trafi do schematu w kolejnej iteracji.
      </div>
    </div>
  );
}

function RuleCell({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 bg-white border-b border-slate-200 [&:nth-last-child(-n+2)]:border-b-0 md:[&:nth-child(odd)]:border-r md:border-r-slate-200">
      <div className="text-[12px] font-medium text-slate-500 mb-2">{label}</div>
      {children}
      <p className="text-[11.5px] text-slate-500 leading-[1.5] mt-2">{hint}</p>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex p-[3px] bg-slate-100 rounded-[8px] gap-px text-[12px] font-medium">
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={
              "px-2.5 py-[5px] rounded-[5px] tabular-nums transition " +
              (on ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" : "text-slate-600 hover:text-slate-900")
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-[8px] p-1 font-mono text-[13px]">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-[22px] h-[22px] rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm leading-none"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="border-0 w-[42px] text-center bg-transparent focus:outline-none"
      />
      <span className="text-[11px] text-slate-500 pr-1.5 font-sans">{unit}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-[22px] h-[22px] rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm leading-none"
      >
        +
      </button>
    </div>
  );
}

/* ============ SIDE: MINI CAL ============ */
function MiniCalCard() {
  const today = new Date();
  const month = today.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  const year = today.getFullYear();
  const m = today.getMonth();
  const firstDow = (new Date(year, m, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[13.5px] font-semibold m-0 capitalize">{month}</h4>
        <div className="flex gap-1">
          <button className="w-6 h-6 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs">‹</button>
          <button className="w-6 h-6 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {["P", "W", "Ś", "C", "P", "S", "N"].map((d, i) => (
          <div key={i} className="text-[10px] text-slate-500 text-center py-1 font-medium uppercase">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="aspect-square" />;
          const isToday = d === today.getDate();
          // Mark days where the trainer would have hours (mock — assume mon-sat).
          const dow = (new Date(year, m, d).getDay() + 6) % 7;
          const has = dow !== 6;
          return (
            <div
              key={i}
              className={
                "aspect-square rounded-md text-[12px] flex items-center justify-center font-mono " +
                (has ? "bg-emerald-50 text-emerald-700 font-semibold " : "text-slate-700 ") +
                (isToday ? "outline outline-2 -outline-offset-2 outline-slate-900" : "")
              }
            >
              {d}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3.5 mt-3.5 text-[11px] text-slate-500 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-50 border border-emerald-200" /> Otwarte
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-100" /> Wyjątek
        </span>
      </div>
    </div>
  );
}

/* ============ SIDE: TIP ============ */
function TipCard() {
  return (
    <div
      className="rounded-[12px] border p-4 flex gap-3 items-start"
      style={{ background: "linear-gradient(135deg,#f0fdfa,#ecfdf5)", borderColor: "#a7f3d0" }}
    >
      <div className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v6m0 0l3-3m-3 3L9 5" />
          <circle cx="12" cy="14" r="6" />
        </svg>
      </div>
      <div>
        <h5 className="text-[13px] font-semibold m-0 mb-0.5 text-emerald-700">Wskazówka</h5>
        <p className="text-[12px] text-emerald-900/80 m-0 leading-[1.5]">
          Trenerzy z <b>godzinami w pn–sb</b> mają o 23% wyższe wypełnienie niż ci, co pracują tylko w robocze.
        </p>
      </div>
    </div>
  );
}

/* ============ SIDE: LOCATIONS ============ */
function LocationsCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="mb-3">
        <h3 className="text-[14.5px] font-semibold m-0">Miejsca pracy</h3>
        <p className="text-[11.5px] text-slate-500 mt-1">% slotów w danej lokalizacji</p>
      </div>
      <div className="text-[12px] text-slate-500 italic px-3 py-4 border border-dashed border-slate-300 rounded-[11px] text-center">
        Wkrótce — siłownia, online, dom klienta z procentem wypełnienia.
      </div>
    </div>
  );
}

/* ============ SIDE: NOTIFICATIONS ============ */
function NotificationsCard() {
  const [reminder, setReminder] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);
  const [waitlist, setWaitlist] = useState(true);
  const [acceptNew, setAcceptNew] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="text-[14.5px] font-semibold m-0 mb-1">Powiadomienia &amp; auto</h3>
      <p className="text-[11.5px] text-slate-400 italic mb-2">Wkrótce — wartości zapisują się lokalnie.</p>
      <PolicyRow
        title="Przypomnienie 24h przed"
        desc="SMS + push do klienta dzień wcześniej."
        on={reminder}
        toggle={() => setReminder(!reminder)}
      />
      <PolicyRow
        title="Auto-blokada przy chorobie"
        desc="Zamknij dzień jednym kliknięciem z pulpitu."
        on={autoBlock}
        toggle={() => setAutoBlock(!autoBlock)}
      />
      <PolicyRow
        title="Lista oczekujących"
        desc="Klienci dostaną propozycję przy zwolnieniu slotu."
        on={waitlist}
        toggle={() => setWaitlist(!waitlist)}
      />
      <PolicyRow
        title="Akceptuj nowych klientów"
        desc="Wyłącz, gdy nie chcesz przyjmować pierwszych wizyt."
        on={acceptNew}
        toggle={() => setAcceptNew(!acceptNew)}
        last
      />
    </div>
  );
}

function PolicyRow({
  title,
  desc,
  on,
  toggle,
  last,
}: {
  title: string;
  desc: string;
  on: boolean;
  toggle: () => void;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex items-start justify-between gap-3 py-3.5 " + (last ? "" : "border-b border-slate-100")
      }
    >
      <div>
        <h5 className="text-[13px] font-semibold m-0 mb-0.5">{title}</h5>
        <p className="text-[11.5px] text-slate-500 m-0 leading-[1.5] max-w-[230px]">{desc}</p>
      </div>
      <Toggle pressed={on} onClick={toggle} label={title} />
    </div>
  );
}
