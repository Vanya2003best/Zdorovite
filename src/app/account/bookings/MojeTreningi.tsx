"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import RescheduleDialog from "@/components/RescheduleDialog";
import type { MyReview } from "@/lib/db/reviews";
import { cancelMyBooking } from "./actions";
import { ReviewForm, ReviewThanks } from "./ReviewForm";

/**
 * /account/bookings — Moje treningi (design 36).
 *
 * Four modes accessed via the mode switcher: Nadchodzące, Historia,
 * Anulowane, Zarezerwuj. Each mode swaps the summary strip + content,
 * the mode-banner stays contextual. Data shape is intentionally flat
 * — server orchestrator (page.tsx) does the joins/RLS work.
 */

export type Booking = {
  id: string;
  trainerId: string;
  trainerSlug: string;
  trainerName: string;
  trainerInitials: string;
  trainerLocation: string;
  startIso: string;
  endIso: string;
  status: string;
  price: number;
  serviceName: string;
  durationMin: number;
  fromPackage: boolean;
  packageProgress: { done: number; total: number } | null;
  /** "1:1 siłowy", "Cardio outdoor", "Online", "Diagnostyka" — used for filter chips */
  category: string;
  /** Visual flag from heuristics: outdoor / online */
  variant: "studio" | "outdoor" | "online";
  /** Reschedule pending (already supported in current schema) */
  pendingReschedule: boolean;
  /** Review this client left for THIS session (history cards only). */
  myReview: MyReview | null;
  /** Client already reviewed this trainer — possibly via another session
   *  (one review per client per trainer), so hide the "Wystaw opinię" CTA. */
  trainerReviewed: boolean;
};

export type ActivePackage = {
  name: string;
  done: number;
  total: number;
  validUntilLabel: string | null;
  /** Sessions per week pace, computed by server — null when too few datapoints */
  perWeek: number | null;
  finishEtaLabel: string | null;
};

export type Counters = {
  upcoming: number;
  history: number;
  cancelled: number;
};

export type ServiceOption = {
  id: string;
  trainerSlug: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  emoji: string;
  /** Counts toward the active package — render as "Z pakietu" badge. */
  fromPackage: boolean;
};

export type MojeTreningiData = {
  upcoming: Booking[];
  history: Booking[];
  cancelled: Booking[];
  activePackage: ActivePackage | null;
  /** Distinct categories present in bookings — drives the filter chips */
  categoryCounts: { name: string; count: number }[];
  /** Sessions completed cumulatively for the history summary card. */
  historyHours: number;
  longestStreakWeeks: number;
  avgRatingGiven: number | null;
  pendingReviews: number;
  firstBookingDateLabel: string | null;
  /** Marek's services for the Book panel — pulled from the most-frequent
   *  trainer this client books with. Empty when client has no trainer yet. */
  bookableServices: ServiceOption[];
  primaryTrainerName: string | null;
  /** Mini-cal — current month's day-by-day session counts. */
  monthSessions: { day: number; count: number }[];
  monthLabel: string;
  monthTotal: number;
  /** Today's day number, used to highlight in mini-cal. */
  today: number;
  /** Free cancellations remaining this month (UI shows "1 z 3 wykorzystane") */
  cancelsThisMonth: number;
  cancelLimit: number;
};

type Mode = "upcoming" | "history" | "cancelled" | "book";

export default function MojeTreningi({ data }: { data: MojeTreningiData }) {
  const [mode, setMode] = useState<Mode>("upcoming");
  const [filter, setFilter] = useState<string>("all");
  /** Booking id whose inline review form is open (one at a time). */
  const [reviewOpenId, setReviewOpenId] = useState<string | null>(null);

  const toggleReview = (id: string) =>
    setReviewOpenId((prev) => (prev === id ? null : id));

  // "Wystaw opinie zaległe (N)" — jump to the first unreviewed completed
  // session and open its form. Clears the category filter first so the
  // target card is guaranteed to be rendered.
  const openReviewBacklog = () => {
    const first = data.history.find((h) => !h.myReview && !h.trainerReviewed);
    if (!first) return;
    setFilter("all");
    setReviewOpenId(first.id);
    setTimeout(() => {
      document
        .getElementById(`booking-${first.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const filteredUpcoming = useMemo(
    () => (filter === "all" ? data.upcoming : data.upcoming.filter((b) => b.category === filter)),
    [data.upcoming, filter],
  );
  const filteredHistory = useMemo(
    () => (filter === "all" ? data.history : data.history.filter((b) => b.category === filter)),
    [data.history, filter],
  );

  const next = data.upcoming[0] ?? null;
  const subtitle = subtitleFor(mode, data, next);

  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
        <div>
          <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Moje treningi</h1>
          <div className="text-[12.5px] text-slate-500 mt-1">{subtitle}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Synchronizacja z Google Calendar — wkrótce"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Synchronizuj z kalendarzem
          </button>
          <button
            type="button"
            onClick={() => setMode("book")}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
          >
            + Zarezerwuj nową sesję
          </button>
        </div>
      </div>

      {/* Toolbar — modes + filters */}
      <div className="flex items-center justify-between gap-3.5 mb-3.5 flex-wrap">
        <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium" role="tablist">
          {(
            [
              { id: "upcoming", label: "Nadchodzące", count: data.upcoming.length, badge: "" },
              { id: "history", label: "Historia", count: data.history.length, badge: "" },
              { id: "cancelled", label: "Anulowane", count: data.cancelled.length, badge: data.cancelled.length > 0 ? "warn" : "" },
              { id: "book", label: "Zarezerwuj", count: -1, badge: "" },
            ] as { id: Mode; label: string; count: number; badge: "warn" | "" }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={
                "inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] whitespace-nowrap transition " +
                (mode === m.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-900")
              }
            >
              <ModeIcon id={m.id} />
              {m.label}
              {m.count >= 0 && (
                <span
                  className={
                    "text-[10.5px] font-semibold px-[6px] py-[1px] rounded-[5px] " +
                    (mode === m.id
                      ? m.badge === "warn"
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-700")
                  }
                >
                  {m.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {(mode === "upcoming" || mode === "history") && data.categoryCounts.length > 0 && (
          <div className="flex gap-1.5 items-center flex-wrap">
            <FilterChip on={filter === "all"} onClick={() => setFilter("all")}>
              Wszystkie usługi
            </FilterChip>
            {data.categoryCounts.map((c) => (
              <FilterChip key={c.name} on={filter === c.name} onClick={() => setFilter(c.name)}>
                {c.name} <span className="text-slate-400 font-normal">· {c.count}</span>
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* Mode banner */}
      <ModeBanner mode={mode} data={data} next={next} onReviewBacklog={openReviewBacklog} />

      {/* Panels */}
      {mode === "upcoming" && (
        <UpcomingPanel
          all={filteredUpcoming}
          activePackage={data.activePackage}
          monthSessions={data.monthSessions}
          monthLabel={data.monthLabel}
          monthTotal={data.monthTotal}
          today={data.today}
          cancelsThisMonth={data.cancelsThisMonth}
          cancelLimit={data.cancelLimit}
          counters={{ week: weekCount(data.upcoming), month: data.monthTotal }}
        />
      )}
      {mode === "history" && (
        <HistoryPanel
          all={filteredHistory}
          historyHours={data.historyHours}
          longestStreak={data.longestStreakWeeks}
          avgRating={data.avgRatingGiven}
          pendingReviews={data.pendingReviews}
          firstDateLabel={data.firstBookingDateLabel}
          totalCount={data.history.length}
          reviewOpenId={reviewOpenId}
          onToggleReview={toggleReview}
        />
      )}
      {mode === "cancelled" && (
        <CancelledPanel
          all={data.cancelled}
          cancelsThisMonth={data.cancelsThisMonth}
          cancelLimit={data.cancelLimit}
        />
      )}
      {mode === "book" && (
        <BookPanel
          services={data.bookableServices}
          trainerName={data.primaryTrainerName}
          activePackage={data.activePackage}
        />
      )}
    </div>
  );
}

/* ============================ MODE PANELS ============================ */

function UpcomingPanel({
  all,
  activePackage,
  monthSessions,
  monthLabel,
  monthTotal,
  today,
  cancelsThisMonth,
  cancelLimit,
  counters,
}: {
  all: Booking[];
  activePackage: ActivePackage | null;
  monthSessions: { day: number; count: number }[];
  monthLabel: string;
  monthTotal: number;
  today: number;
  cancelsThisMonth: number;
  cancelLimit: number;
  counters: { week: number; month: number };
}) {
  const next = all[0] ?? null;
  return (
    <>
      <SummaryStrip
        cards={[
          next
            ? {
                label: "Następna sesja",
                value: fmtTime(next.startIso),
                unit: relativeDayLabel(next.startIso),
                detail: next.serviceName,
              }
            : { label: "Następna sesja", value: "—", unit: "", detail: "Brak rezerwacji" },
          { label: "W tym tygodniu", value: String(counters.week), unit: "sesje", detail: counters.week === 0 ? "wolny tydzień" : "" },
          { label: "W tym mies.", value: String(counters.month), unit: "sesji", detail: "" },
          activePackage
            ? {
                label: `Pakiet ${activePackage.name}`,
                value: String(activePackage.done),
                unit: `/ ${activePackage.total}`,
                detail: activePackage.validUntilLabel ?? "",
              }
            : { label: "Pakiet", value: "—", unit: "", detail: "Brak aktywnego" },
          {
            label: "Następna płatność",
            value: next?.fromPackage ? "0" : String(next?.price ?? 0),
            unit: "PLN",
            detail: next?.fromPackage ? "w pakiecie" : "",
          },
        ]}
      />

      {all.length === 0 ? (
        <EmptyState text="Brak nadchodzących sesji w tej kategorii." cta />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <SessionsByDay all={all} variant="upcoming" />
          <div className="flex flex-col gap-3.5">
            <MiniCal monthLabel={monthLabel} total={monthTotal} sessions={monthSessions} today={today} />
            {activePackage && <PackageCard pkg={activePackage} />}
            <TipsCard
              tips={tipsForUpcoming({ next, cancelsThisMonth, cancelLimit, monthTotal })}
            />
          </div>
        </div>
      )}
    </>
  );
}

function HistoryPanel({
  all,
  historyHours,
  longestStreak,
  avgRating,
  pendingReviews,
  firstDateLabel,
  totalCount,
  reviewOpenId,
  onToggleReview,
}: {
  all: Booking[];
  historyHours: number;
  longestStreak: number;
  avgRating: number | null;
  pendingReviews: number;
  firstDateLabel: string | null;
  totalCount: number;
  reviewOpenId: string | null;
  onToggleReview: (id: string) => void;
}) {
  return (
    <>
      <SummaryStrip
        cards={[
          { label: "Sesji ukończonych", value: String(totalCount), unit: "", detail: firstDateLabel ? `od ${firstDateLabel}` : "" },
          { label: "Czas trwania", value: String(historyHours), unit: "godz.", detail: "" },
          { label: "Najdłuższe pasmo", value: String(longestStreak), unit: "tyg.", detail: longestStreak > 0 ? "aktualne!" : "" },
          {
            label: "Twoja śr. ocena",
            value: avgRating ? avgRating.toFixed(2) : "—",
            unit: avgRating ? "★" : "",
            detail: "",
          },
          {
            label: "Opinii do napisania",
            value: String(pendingReviews),
            unit: "",
            detail: pendingReviews > 0 ? "+5 PLN credit" : "wszystko OK",
            warn: pendingReviews > 0,
          },
        ]}
      />

      {all.length === 0 ? (
        <EmptyState text="Brak ukończonych sesji w tej kategorii." />
      ) : (
        <SessionsByDay
          all={all}
          variant="history"
          reviewOpenId={reviewOpenId}
          onToggleReview={onToggleReview}
        />
      )}
    </>
  );
}

function CancelledPanel({
  all,
  cancelsThisMonth,
  cancelLimit,
}: {
  all: Booking[];
  cancelsThisMonth: number;
  cancelLimit: number;
}) {
  const remaining = Math.max(0, cancelLimit - cancelsThisMonth);
  return (
    <>
      <SummaryStrip
        cards={[
          { label: "Anulowane (mies.)", value: String(cancelsThisMonth), unit: "", detail: `limit: ${cancelLimit} darmowe` },
          { label: "Pozostało darmowych", value: String(remaining), unit: "", detail: "do końca mies." },
          { label: "Zwrócone do pakietu", value: String(all.length), unit: "sesje", detail: "100% zwrotu", up: true },
          { label: "No-shows", value: "0", unit: "", detail: "utrzymuj!", up: true },
          { label: "Suma kosztów", value: "0", unit: "PLN", detail: "w limicie" },
        ]}
      />

      {all.length === 0 ? (
        <EmptyState text="Nic nie anulowałeś — gratulacje!" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {all.map((b) => (
            <SessionCard key={b.id} b={b} variant="cancelled" />
          ))}
        </div>
      )}
    </>
  );
}

function BookPanel({
  services,
  trainerName,
  activePackage,
}: {
  services: ServiceOption[];
  trainerName: string | null;
  activePackage: ActivePackage | null;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between mb-3 px-0.5">
        <h3 className="text-[13px] uppercase tracking-[0.08em] font-bold text-slate-700 m-0">
          {trainerName ? `Wybierz usługę u ${trainerName}` : "Wybierz trenera"}
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">
          {services.length > 0
            ? `${services.length} ${plural(services.length, "dostępna", "dostępne", "dostępnych")}`
            : "brak ostatnich rezerwacji"}
        </span>
      </div>

      {services.length === 0 ? (
        <div className="rounded-[14px] border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Najpierw wybierz trenera z katalogu — gdy zarezerwujesz pierwszą sesję, jego usługi pojawią się tutaj.
          </p>
          <Link
            href="/"
            className="inline-flex items-center mt-3 h-10 px-4 rounded-[9px] bg-slate-900 text-white text-[13px] font-semibold hover:bg-black"
          >
            Otwórz katalog trenerów →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
            {services.map((svc, idx) => {
              const palettes = ["bg-rose-100", "bg-sky-100", "bg-fuchsia-100", "bg-amber-100", "bg-emerald-100"];
              const tone = palettes[idx % palettes.length];
              const fromPackage = svc.fromPackage && activePackage && activePackage.done < activePackage.total;
              return (
                <Link
                  key={svc.id}
                  href={`/trainers/${svc.trainerSlug}/book?service_id=${svc.id}`}
                  className={
                    "rounded-[14px] border bg-white p-[18px] transition hover:shadow-[0_1px_3px_rgba(2,6,23,.04)] hover:-translate-y-[1px] " +
                    (fromPackage ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white" : "border-slate-200 hover:border-emerald-300")
                  }
                >
                  <div className={`w-9 h-9 rounded-[10px] ${tone} inline-flex items-center justify-center text-[18px] mb-2.5`}>
                    {svc.emoji}
                  </div>
                  <div className="text-[14px] font-semibold text-slate-900 mb-[3px]">{svc.name}</div>
                  <div className="text-[11.5px] text-slate-500 mb-3 leading-snug">
                    {svc.durationMin} min · {svc.description}
                  </div>
                  <div className="flex items-center justify-between">
                    {fromPackage ? (
                      <div className="text-[14px] font-bold text-emerald-700">
                        Z pakietu
                        <span className="text-[11px] font-medium text-slate-500 ml-1">
                          · {activePackage!.total - activePackage!.done} sesji
                        </span>
                      </div>
                    ) : (
                      <div className="text-[14px] font-bold text-slate-900">
                        {svc.price}
                        <span className="text-[11px] font-medium text-slate-500 ml-0.5"> PLN</span>
                      </div>
                    )}
                    <span className="h-[30px] px-3.5 inline-flex items-center bg-slate-900 text-white text-[11.5px] font-semibold rounded-[7px]">
                      Wybierz
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-[13px] text-slate-600">
            Termin wybierzesz w kolejnym kroku — kalendarz wolnych slotów otworzy się po wyborze usługi.
          </div>
        </>
      )}
    </>
  );
}

/* ============================ SHARED ============================ */

function SessionsByDay({
  all,
  variant,
  reviewOpenId,
  onToggleReview,
}: {
  all: Booking[];
  variant: "upcoming" | "history";
  reviewOpenId?: string | null;
  onToggleReview?: (id: string) => void;
}) {
  const groups = groupByDay(all, variant);
  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-3 pt-3 pb-1 px-1">
            <span className="text-[13.5px] font-bold tracking-[-0.01em]">
              {g.label}
              <small className="text-slate-500 font-medium ml-1.5">· {g.subLabel}</small>
            </span>
            {g.tag && (
              <span
                className={
                  "text-[10.5px] font-semibold rounded-full px-2 py-[2px] " +
                  (g.tag === "today"
                    ? "bg-amber-100 text-amber-900"
                    : g.tag === "tomorrow"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-700")
                }
              >
                {g.tagLabel}
              </span>
            )}
            <span className="flex-1 border-b border-dashed border-slate-200" />
            <span className="text-[11px] text-slate-500">
              {g.items.length} {plural(g.items.length, "sesja", "sesje", "sesji")}
            </span>
          </div>
          {g.items.map((b, i) => (
            <SessionCard
              key={b.id}
              b={b}
              variant={variant}
              isNext={variant === "upcoming" && i === 0 && g.tag === "tomorrow"}
              reviewOpen={reviewOpenId === b.id}
              onToggleReview={onToggleReview}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SessionCard({
  b,
  variant,
  isNext,
  reviewOpen,
  onToggleReview,
}: {
  b: Booking;
  variant: "upcoming" | "history" | "cancelled";
  isNext?: boolean;
  /** History only: this card's inline review form is expanded. */
  reviewOpen?: boolean;
  onToggleReview?: (id: string) => void;
}) {
  const endLabel = fmtTime(b.endIso);
  const cancelled = variant === "cancelled";
  const completed = variant === "history";

  return (
    <div
      id={`booking-${b.id}`}
      className={
        "rounded-[14px] border bg-white px-5 py-4 grid grid-cols-[80px_1fr_auto] gap-[18px] items-center transition hover:shadow-[0_1px_3px_rgba(2,6,23,.04)] " +
        (isNext
          ? "border-emerald-300 bg-gradient-to-b from-emerald-50/70 to-white border-l-[3px] border-l-emerald-500"
          : "border-slate-200 hover:border-slate-300") +
        (cancelled ? " opacity-70 bg-slate-50" : "") +
        (completed ? " opacity-95" : "")
      }
    >
      {/* Time tile */}
      <div className="flex flex-col items-center gap-0.5 py-1.5 border-r border-slate-100 -mr-0.5">
        <div className={`text-[22px] font-bold tracking-[-0.02em] tabular-nums leading-none ${cancelled ? "line-through" : ""}`}>
          {fmtTime(b.startIso)}
        </div>
        <div className="text-[11px] text-slate-500">→ {endLabel}</div>
        <div className="text-[10px] text-slate-500 font-semibold bg-slate-100 rounded-full px-[7px] py-[2px] mt-1">
          {b.durationMin} min
        </div>
      </div>

      {/* Info */}
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[14.5px] font-semibold text-slate-900">{b.serviceName}</span>
          {b.status === "pending" && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-amber-100 text-amber-900">
              ⏳ Oczekuje
            </span>
          )}
          {(b.status === "confirmed" || b.status === "paid") && variant === "upcoming" && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700">
              ✓ Potwierdzone
            </span>
          )}
          {variant === "history" && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-slate-100 text-slate-700">
              ✓ Ukończone
            </span>
          )}
          {cancelled && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-red-100 text-red-700">
              ✗ Anulowana
            </span>
          )}
          {b.variant === "outdoor" && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-fuchsia-100 text-fuchsia-800">
              🌳 Outdoor
            </span>
          )}
          {b.variant === "online" && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-sky-100 text-sky-800">
              💻 Online
            </span>
          )}
          {b.pendingReschedule && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[2px] rounded-full bg-amber-100 text-amber-900">
              ⏳ Czeka na zmianę
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-slate-500 flex gap-2.5 flex-wrap">
          {b.trainerLocation && (
            <span className="inline-flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {b.trainerLocation}
            </span>
          )}
          {b.fromPackage && b.packageProgress && (
            <span className="text-emerald-700 font-semibold">
              {b.packageProgress.done}/{b.packageProgress.total} sesji pakietu
            </span>
          )}
          {!b.fromPackage && variant === "upcoming" && (
            <span className="text-slate-600">Płatne: {b.price} PLN</span>
          )}
        </div>
      </div>

      {/* Right: trainer + actions */}
      <div className="flex flex-col gap-1.5 items-end">
        <Link
          href={`/trainers/${b.trainerSlug}`}
          className="flex items-center gap-1.5 text-[11.5px] text-slate-700 hover:text-slate-900"
        >
          <span className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white inline-flex items-center justify-center font-bold text-[11px]">
            {b.trainerInitials}
          </span>
          <span className="font-medium">{b.trainerName}</span>
        </Link>
        <div className="flex gap-1.5">
          {variant === "upcoming" && (
            <>
              {!b.pendingReschedule && (
                <RescheduleDialog
                  bookingId={b.id}
                  trainerId={b.trainerId}
                  currentStartIso={b.startIso}
                  durationMin={b.durationMin}
                  triggerLabel="Przesuń"
                  triggerClassName="h-7 px-3 inline-flex items-center rounded-[7px] border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:border-slate-300"
                />
              )}
              <form
                action={async (fd) => {
                  const res = await cancelMyBooking(fd);
                  if (res && "error" in res) alert(res.error);
                }}
              >
                <input type="hidden" name="booking_id" value={b.id} />
                <button
                  type="submit"
                  className="h-7 px-3 inline-flex items-center rounded-[7px] border border-slate-200 bg-white text-[11px] font-medium text-red-700 hover:border-red-300"
                >
                  Anuluj
                </button>
              </form>
              <Link
                href={`/account/messages?with=${b.trainerId}`}
                className="h-7 px-3 inline-flex items-center rounded-[7px] bg-slate-900 text-white text-[11px] font-semibold hover:bg-black"
              >
                Szczegóły
              </Link>
            </>
          )}
          {variant === "history" && (
            <>
              {b.myReview ? (
                <span className="h-7 px-3 inline-flex items-center rounded-[7px] bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                  ✓ Oceniono
                </span>
              ) : b.trainerReviewed ? (
                <span
                  className="h-7 px-3 inline-flex items-center rounded-[7px] bg-slate-100 text-slate-500 text-[11px] font-medium"
                  title="Twoja opinia o tym trenerze dotyczy innej sesji — jedna opinia na trenera."
                >
                  ✓ Opinia wystawiona
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleReview?.(b.id)}
                  aria-expanded={!!reviewOpen}
                  className={
                    "h-7 px-3 inline-flex items-center rounded-[7px] border text-[11px] font-medium transition " +
                    (reviewOpen
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")
                  }
                >
                  Wystaw opinię
                </button>
              )}
              <Link
                href={`/trainers/${b.trainerSlug}/book?service_id=${encodeURIComponent(b.serviceName)}`}
                className="h-7 px-3 inline-flex items-center rounded-[7px] bg-slate-900 text-white text-[11px] font-semibold hover:bg-black"
              >
                Powtórz
              </Link>
            </>
          )}
          {cancelled && (
            <Link
              href={`/trainers/${b.trainerSlug}/book`}
              className="h-7 px-3 inline-flex items-center rounded-[7px] bg-slate-900 text-white text-[11px] font-semibold hover:bg-black"
            >
              Zarezerwuj ponownie
            </Link>
          )}
        </div>
      </div>

      {/* Review area — full-width row under the card grid (history only). */}
      {variant === "history" && b.myReview && <ReviewThanks review={b.myReview} />}
      {variant === "history" && !b.myReview && !b.trainerReviewed && reviewOpen && (
        <ReviewForm
          bookingId={b.id}
          trainerName={b.trainerName}
          onClose={() => onToggleReview?.(b.id)}
        />
      )}
    </div>
  );
}

function SummaryStrip({
  cards,
}: {
  cards: { label: string; value: string; unit?: string; detail?: string; up?: boolean; warn?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3.5">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1">
            {c.label}
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-[22px] font-bold tabular-nums tracking-[-0.02em] ${c.warn ? "text-amber-600" : "text-slate-900"}`}>
              {c.value}
            </span>
            {c.unit && <span className="text-[12px] font-medium text-slate-500">{c.unit}</span>}
          </div>
          {c.detail && (
            <div className={`text-[11px] mt-0.5 ${c.up ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
              {c.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModeBanner({
  mode,
  data,
  next,
  onReviewBacklog,
}: {
  mode: Mode;
  data: MojeTreningiData;
  next: Booking | null;
  onReviewBacklog?: () => void;
}) {
  if (mode === "upcoming" && next) {
    return (
      <div className="flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900">
        <span className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            Najbliższa: {next.serviceName} · {relativeDayLabel(next.startIso)} {fmtTime(next.startIso)} · {next.trainerLocation || "miejsce do uzgodnienia"}
          </b>
          <div className="text-emerald-800/80 mt-0.5">
            Zmiana godziny do 24h przed sesją bez kosztu.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "history" && data.history.length > 0) {
    return (
      <div className="flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 bg-sky-50 border border-sky-200 text-sky-900">
        <span className="w-7 h-7 rounded-[8px] bg-sky-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {data.history.length} sesje ukończone · {data.historyHours}h treningu
            {data.avgRatingGiven ? ` · ★ ${data.avgRatingGiven.toFixed(2)} średnia ocena trenera od Ciebie` : ""}
          </b>
          {data.firstBookingDateLabel && (
            <div className="text-sky-800/80 mt-0.5">
              Twój pierwszy trening: {data.firstBookingDateLabel}.
              {data.longestStreakWeeks > 0 ? ` Najdłuższe pasmo: ${data.longestStreakWeeks} tyg. z rzędu.` : ""}
            </div>
          )}
        </div>
        {data.pendingReviews > 0 && (
          <button
            type="button"
            onClick={onReviewBacklog}
            className="ml-auto font-semibold underline underline-offset-[3px] text-sky-900 hover:text-sky-950"
          >
            Wystaw opinie zaległe ({data.pendingReviews}) →
          </button>
        )}
      </div>
    );
  }
  if (mode === "cancelled" && data.cancelled.length > 0) {
    return (
      <div className="flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 bg-amber-50 border border-amber-200 text-amber-900">
        <span className="w-7 h-7 rounded-[8px] bg-amber-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {data.cancelled.length} {plural(data.cancelled.length, "anulowana sesja", "anulowane sesje", "anulowanych sesji")} · zwrócone do pakietu
          </b>
          <div className="text-amber-800/80 mt-0.5">
            Limit darmowych anulowań w mies.: {data.cancelsThisMonth}/{data.cancelLimit} wykorzystane.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "book") {
    return (
      <div className="flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 bg-gradient-to-r from-fuchsia-50 to-purple-50 border border-fuchsia-200 text-fuchsia-900">
        <span className="w-7 h-7 rounded-[8px] bg-fuchsia-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <div>
          {data.activePackage ? (
            <>
              <b className="font-semibold">
                Pakiet &quot;{data.activePackage.name}&quot; · {data.activePackage.done}/{data.activePackage.total}{" "}
                {data.activePackage.validUntilLabel ? `· ważny do ${data.activePackage.validUntilLabel}` : ""}
              </b>
              <div className="text-fuchsia-800/80 mt-0.5">
                Sesje z pakietu nie obciążają portfela. Pozostałe — przelew po sesji.
              </div>
            </>
          ) : (
            <>
              <b className="font-semibold">Brak aktywnego pakietu</b>
              <div className="text-fuchsia-800/80 mt-0.5">
                Każdą sesję rozliczasz oddzielnie z trenerem (BLIK / przelew / gotówka).
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function MiniCal({
  monthLabel,
  total,
  sessions,
  today,
}: {
  monthLabel: string;
  total: number;
  sessions: { day: number; count: number }[];
  today: number;
}) {
  // Simple approach — render each day-of-month as a square. We don't
  // need full calendar grid alignment for this reduced widget.
  const max = Math.max(...sessions.map((s) => s.day), 0);
  const days = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] px-[18px] py-4">
      <div className="flex justify-between items-center mb-3 text-[11.5px] uppercase tracking-[0.08em] font-bold text-slate-700">
        <span>{monthLabel}</span>
        <span className="text-slate-500 normal-case tracking-normal text-[11px] font-medium">
          {total} {plural(total, "sesja", "sesje", "sesji")}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const has = sessions.find((s) => s.day === d)?.count ?? 0;
          const isToday = d === today;
          return (
            <div
              key={d}
              className={
                "aspect-square rounded-[7px] flex items-center justify-center text-[12px] font-medium relative " +
                (isToday
                  ? "bg-slate-900 text-white"
                  : has > 0
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-50")
              }
            >
              {d}
              {has > 0 && !isToday && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: ActivePackage }) {
  const pct = Math.round((pkg.done / Math.max(1, pkg.total)) * 100);
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-[14px] px-[18px] py-4">
      <div className="text-[14px] font-bold text-slate-900 mb-0.5">Pakiet &quot;{pkg.name}&quot;</div>
      <div className="text-[11.5px] text-slate-600 mb-3">
        {pkg.total} sesji
        {pkg.validUntilLabel ? ` · ważny do ${pkg.validUntilLabel}` : ""}
      </div>
      <div className="h-2 bg-emerald-200/40 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11.5px] text-slate-700 mb-1.5">
        <span>
          Wykorzystane: <b className="text-slate-900 font-bold">{pkg.done}</b>
        </span>
        <span>
          Pozostało: <b className="text-slate-900 font-bold">{Math.max(0, pkg.total - pkg.done)}</b>
        </span>
      </div>
      {pkg.perWeek != null && (
        <div className="flex justify-between text-[11.5px] text-slate-700 mb-1.5">
          <span>
            Średnio: <b className="text-slate-900 font-bold">{pkg.perWeek.toFixed(1)} / tydz.</b>
          </span>
          {pkg.finishEtaLabel && (
            <span>
              Skończysz: <b className="text-slate-900 font-bold">~{pkg.finishEtaLabel}</b>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TipsCard({ tips }: { tips: { kind: "warn" | "info" | "ok"; html: string }[] }) {
  if (tips.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] px-[18px] py-4">
      <div className="text-[11.5px] uppercase tracking-[0.08em] font-bold text-slate-700 mb-3">
        Wskazówki
      </div>
      {tips.map((t, i) => (
        <div
          key={i}
          className={
            "flex gap-2.5 py-2.5 " +
            (i < tips.length - 1 ? "border-b border-dashed border-slate-100" : "")
          }
        >
          <span
            className={
              "w-[26px] h-[26px] rounded-[8px] flex items-center justify-center text-[14px] shrink-0 " +
              (t.kind === "warn"
                ? "bg-amber-100 text-amber-900"
                : t.kind === "info"
                  ? "bg-sky-50 text-sky-900"
                  : "bg-emerald-50 text-emerald-700")
            }
          >
            {t.kind === "warn" ? "⚡" : t.kind === "info" ? "⏱" : "🎯"}
          </span>
          <div className="text-[12px] text-slate-700 leading-[1.45]" dangerouslySetInnerHTML={{ __html: t.html }} />
        </div>
      ))}
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-[30px] px-[10px] inline-flex items-center gap-1.5 rounded-[8px] border text-[11.5px] font-medium transition " +
        (on
          ? "bg-sky-50 border-sky-200 text-sky-900"
          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300")
      }
    >
      {children}
    </button>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: boolean }) {
  return (
    <div className="rounded-[14px] border-2 border-dashed border-slate-300 py-12 text-center bg-white">
      <p className="text-[14px] font-medium text-slate-500">{text}</p>
      {cta && (
        <Link href="/" className="mt-3 inline-block text-[13px] font-semibold text-emerald-700 hover:text-emerald-800">
          Znajdź trenera →
        </Link>
      )}
    </div>
  );
}

function ModeIcon({ id }: { id: Mode }) {
  if (id === "upcoming")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  if (id === "history")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 109-9M3 12V5M3 12h7" />
      </svg>
    );
  if (id === "cancelled")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ============================ HELPERS ============================ */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function relativeDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);
  if (diffDays === 0) return "dziś";
  if (diffDays === 1) return "jutro";
  if (diffDays < 7 && diffDays > 0) {
    return d.toLocaleDateString("pl-PL", { weekday: "long" });
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function weekCount(rows: Booking[]): number {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  return rows.filter((b) => {
    const t = new Date(b.startIso).getTime();
    return t >= monday.getTime() && t < sunday.getTime();
  }).length;
}

function groupByDay(
  rows: Booking[],
  variant: "upcoming" | "history",
): { key: string; label: string; subLabel: string; tag: "today" | "tomorrow" | null; tagLabel: string; items: Booking[] }[] {
  const map = new Map<string, Booking[]>();
  for (const b of rows) {
    const d = new Date(b.startIso);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = map.get(key) ?? [];
    arr.push(b);
    map.set(key, arr);
  }
  const sortedKeys = [...map.keys()].sort((a, b) => (variant === "upcoming" ? a.localeCompare(b) : b.localeCompare(a)));
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return sortedKeys.map((key) => {
    const items = map.get(key)!;
    const d = new Date(items[0].startIso);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);
    const weekday = d.toLocaleDateString("pl-PL", { weekday: "long" });
    const dayMonth = d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
    let label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    let tag: "today" | "tomorrow" | null = null;
    let tagLabel = "";
    if (diffDays === 0) {
      label = "Dziś";
      tag = "today";
      tagLabel = "Dziś";
    } else if (diffDays === 1) {
      label = "Jutro";
      tag = "tomorrow";
      tagLabel = "Najbliższa";
    }
    return {
      key,
      label,
      subLabel: dayMonth,
      tag,
      tagLabel,
      items: items.sort((a, b) => a.startIso.localeCompare(b.startIso)),
    };
  });
}

function subtitleFor(mode: Mode, data: MojeTreningiData, next: Booking | null): string {
  if (mode === "upcoming") {
    const parts = [`${data.upcoming.length} ${plural(data.upcoming.length, "nadchodząca sesja", "nadchodzące sesje", "nadchodzących sesji")}`];
    if (next) {
      parts.push(`najbliższa ${relativeDayLabel(next.startIso)} ${fmtTime(next.startIso)}`);
    }
    parts.push(`${data.history.length} ${plural(data.history.length, "ukończona", "ukończone", "ukończonych")} w sumie`);
    return parts.join(" · ");
  }
  if (mode === "history") {
    return `${data.history.length} ukończonych · ${data.historyHours}h treningu${data.avgRatingGiven ? ` · ★ ${data.avgRatingGiven.toFixed(2)} śr. ocena trenera` : ""}`;
  }
  if (mode === "cancelled") {
    return `${data.cancelled.length} anulowanych · limit darmowych: ${data.cancelLimit} / mies.`;
  }
  return data.primaryTrainerName
    ? `Wybierz usługę u trenera ${data.primaryTrainerName}`
    : "Najpierw wybierz trenera z katalogu";
}

function tipsForUpcoming({
  next,
  cancelsThisMonth,
  cancelLimit,
  monthTotal,
}: {
  next: Booking | null;
  cancelsThisMonth: number;
  cancelLimit: number;
  monthTotal: number;
}): { kind: "warn" | "info" | "ok"; html: string }[] {
  const tips: { kind: "warn" | "info" | "ok"; html: string }[] = [];
  if (next && next.variant === "outdoor") {
    tips.push({
      kind: "warn",
      html: `<b>Sesja outdoor — ${relativeDayLabel(next.startIso)}.</b> Sprawdź pogodę przed wyjściem, zabierz wodę i warstwy.`,
    });
  }
  if (cancelsThisMonth >= cancelLimit) {
    tips.push({
      kind: "info",
      html: `<b>Limit anulowań:</b> ${cancelsThisMonth}/${cancelLimit} wykorzystane. Następne anulowanie może wiązać się z opłatą.`,
    });
  } else if (cancelsThisMonth > 0) {
    tips.push({
      kind: "info",
      html: `<b>Anulowania:</b> wykorzystano ${cancelsThisMonth} z ${cancelLimit} darmowych w tym mies.`,
    });
  }
  if (monthTotal >= 8) {
    tips.push({ kind: "ok", html: `<b>Cel mies.:</b> ${monthTotal} sesji ✓ — świetne tempo!` });
  }
  if (tips.length === 0) {
    tips.push({ kind: "ok", html: "Wszystko na kursie — kontynuuj!" });
  }
  return tips;
}
