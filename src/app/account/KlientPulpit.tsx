import Link from "next/link";

/**
 * Client (kliencki) dashboard rendering — design 35 layout.
 *
 * Server orchestration (data fetching, RLS-checked queries) lives in
 * page.tsx; this file handles the visual layer so we can tweak design
 * fidelity without re-shaping the data layer every iteration.
 */

export type KlientPulpitData = {
  firstName: string;
  /** Next upcoming session — null when there's nothing booked. */
  next: NextSession | null;
  yearSessionsDone: number;
  monthSessionsDone: number;
  weekUpcoming: WeekDay[];
  activePackage: ActivePackage | null;
  weight: { latestKg: number | null; deltaSinceYearStart: number | null };
  topGoal: { title: string; pct: number; targetDate: string | null } | null;
  /** Trainer to spotlight in the right rail — last booked, or null. */
  spotlightTrainer: SpotlightTrainer | null;
  recommendedTrainers: RecommendedTrainer[];
  notifications: Notif[];
  history: HistoryItem[];
  /** Streak — number of consecutive weeks with at least one completed session. */
  streakWeeks: number;
};

export type NextSession = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceName: string;
  durationMin: number;
  location: string;
  trainerSlug: string;
  trainerId: string;
  trainerName: string;
  trainerAvatar: string | null;
  packageProgress: { done: number; total: number } | null;
};

export type WeekDay = {
  iso: string;
  dayShort: string;
  dayNum: number;
  isToday: boolean;
  /** First session of the day, or null if free. */
  session: { time: string; type: string } | null;
};

export type ActivePackage = {
  name: string;
  trainerName: string;
  done: number;
  total: number;
  validUntil: string | null;
  pricePerSession: number | null;
};

export type SpotlightTrainer = {
  slug: string;
  name: string;
  avatar: string | null;
  tagline: string;
  rating: number;
  reviewCount: number;
  lastMessage: { text: string; at: string } | null;
};

export type RecommendedTrainer = {
  slug: string;
  name: string;
  avatar: string | null;
  pitch: string;
  pricePerSession: number;
  paletteIdx: number;
};

export type Notif = {
  id: string;
  text: string;
  whenIso: string;
  unread: boolean;
  tone: "green" | "amber" | "blue";
};

export type HistoryItem = {
  id: string;
  whenIso: string;
  serviceName: string;
  trainerName: string;
  detail: string;
  trainerNote: string | null;
  /** Future = greyed dashed marker; past = solid green. */
  future: boolean;
};

const PL_DAYS_SHORT = ["NIE", "PON", "WT", "ŚR", "CZW", "PT", "SOB"];
const PL_MONTHS_GEN = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

export default function KlientPulpit({ data }: { data: KlientPulpitData }) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-7 py-5 sm:py-7">
      <Topbar firstName={data.firstName} next={data.next} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4 mb-4">
        <NextSessionHero next={data.next} />
        <RingsCard data={data} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <div className="space-y-4">
          {data.activePackage && <PackageCard pkg={data.activePackage} />}
          <WeekPlanCard week={data.weekUpcoming} />
          <ProgressCard
            yearSessionsDone={data.yearSessionsDone}
            monthSessionsDone={data.monthSessionsDone}
            weight={data.weight}
          />
          <HistoryCard items={data.history} />
        </div>
        <div className="space-y-4">
          {data.spotlightTrainer && <TrainerCard trainer={data.spotlightTrainer} />}
          {data.topGoal && <GoalCard goal={data.topGoal} />}
          <AchievementsCard
            yearCount={data.yearSessionsDone}
            streak={data.streakWeeks}
            packageDone={data.activePackage ? data.activePackage.done >= data.activePackage.total : false}
            firstReview={false}
          />
          <NotificationsCard items={data.notifications} />
          {data.recommendedTrainers.length > 0 && (
            <RecommendedCard items={data.recommendedTrainers} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ TOPBAR ============ */
function Topbar({ firstName, next }: { firstName: string; next: NextSession | null }) {
  let sub: string;
  if (!next) {
    sub = "Brak nadchodzących sesji — wybierz trenera i zarezerwuj pierwszą.";
  } else {
    const d = new Date(next.startTime);
    const days = Math.max(0, Math.round((d.getTime() - Date.now()) / 86_400_000));
    const when = days === 0 ? "dziś" : days === 1 ? "jutro" : `za ${days} dni`;
    sub = `Najbliższa sesja ${when} · ${next.trainerName} · ${next.serviceName}`;
  }
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      <div>
        <h1 className="text-[26px] tracking-[-0.022em] font-semibold m-0">
          Cześć <span className="text-emerald-700">{firstName}</span>, ruszamy 💪
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">{sub}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/trainers"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-700 hover:border-slate-300"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Znajdź trenera
        </Link>
        <Link
          href="/account/bookings"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nowa rezerwacja
        </Link>
      </div>
    </div>
  );
}

/* ============ NEXT SESSION HERO ============ */
function NextSessionHero({ next }: { next: NextSession | null }) {
  if (!next) {
    return (
      <div
        className="rounded-[18px] p-7 sm:p-8 text-white relative overflow-hidden flex flex-col gap-4"
        style={{ background: "linear-gradient(135deg,#064e3b 0%,#0f172a 100%)" }}
      >
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/20 text-emerald-200 rounded-full text-[10.5px] font-bold uppercase tracking-[0.08em] w-fit">
          Brak rezerwacji
        </span>
        <div>
          <div className="text-[24px] font-semibold tracking-[-0.02em]">
            Zaplanuj pierwszą sesję
          </div>
          <p className="text-[13px] text-emerald-100/80 mt-2 max-w-[420px] leading-[1.5]">
            Wybierz trenera z katalogu i zarezerwuj termin. Tu pojawi się odliczanie do najbliższej sesji.
          </p>
        </div>
        <Link
          href="/trainers"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-white text-emerald-900 text-[12.5px] font-semibold w-fit"
        >
          Znajdź trenera →
        </Link>
      </div>
    );
  }
  const d = new Date(next.startTime);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const dayNum = d.getDate();
  const month = PL_MONTHS_GEN[d.getMonth()];
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const initial = next.trainerName.charAt(0).toUpperCase();
  const isToday = days === 0;
  const isTomorrow = days === 1;
  const countdown = isToday
    ? { num: time, lbl: "Dziś" }
    : isTomorrow
      ? { num: "Jutro", lbl: time }
      : { num: String(Math.max(0, days)), lbl: days === 1 ? "dzień" : "dni" };

  return (
    <div
      className="rounded-[18px] p-6 sm:p-7 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#064e3b 0%,#0f172a 100%)" }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-16 w-[280px] h-[280px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute right-10 -bottom-32 w-[220px] h-[220px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(20,184,166,0.18), transparent 70%)" }}
      />

      {/* Countdown chip top-right */}
      <div className="absolute top-6 right-7 text-right z-[1]">
        <div className="text-[28px] sm:text-[32px] font-bold tracking-[-0.03em] text-white leading-none tabular-nums">
          {countdown.num}
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-emerald-200/80 mt-1">
          {countdown.lbl}
        </div>
      </div>

      <span className="relative z-[1] inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-300/40 text-emerald-200 rounded-full text-[10.5px] font-bold uppercase tracking-[0.08em] mb-3.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
        Najbliższa sesja
      </span>
      <div className="relative z-[1] text-[13px] text-emerald-100 mb-1 font-medium">
        {dayNum} {month} · {time}
      </div>
      <h2 className="relative z-[1] text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] m-0 mb-4 max-w-[440px]">
        {next.serviceName}
      </h2>

      {/* Three-up info row */}
      <div
        className="relative z-[1] grid grid-cols-3 gap-4 py-4 border-t border-b border-white/10 mb-4"
      >
        <InfoCol label="Czas trwania" value={`${next.durationMin} min`} />
        <InfoCol label="Miejsce" value={next.location || "—"} />
        <InfoCol
          label="Pakiet"
          value={
            next.packageProgress
              ? `${next.packageProgress.done}/${next.packageProgress.total} sesji`
              : "Pojedyncza sesja"
          }
        />
      </div>

      {/* Trainer */}
      <div className="relative z-[1] flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-full inline-flex items-center justify-center font-bold text-[16px] text-white border-2 border-white/20 shrink-0"
          style={{ background: "linear-gradient(135deg,#10b981,#14b8a6)" }}
        >
          {next.trainerAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={next.trainerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div>
          <div className="text-[13px] text-white/85 font-medium">{next.trainerName}</div>
          <div className="text-[11.5px] text-white/55">Twój trener</div>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-[1] flex gap-2 flex-wrap">
        <Link
          href={`/account/messages?with=${next.trainerId}`}
          className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-white text-emerald-900 text-[12.5px] font-semibold"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Napisz do trenera
        </Link>
        <Link
          href="/account/bookings"
          className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-white/10 text-white text-[12.5px] font-semibold border border-white/20"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Zmień termin
        </Link>
      </div>
    </div>
  );
}

function InfoCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10.5px] uppercase tracking-[0.07em] text-white/50 font-semibold">
        {label}
      </span>
      <span className="text-[14px] font-semibold text-white truncate">{value}</span>
    </div>
  );
}

/* ============ RINGS / STREAK CARD ============ */
function RingsCard({ data }: { data: KlientPulpitData }) {
  // Three rings: Sessions this month / weight progress / goal pct.
  // Progress capped at 100%; values come from real data with sensible
  // fallbacks so a brand-new client doesn't see blank rings.
  const sessionsTarget = 8;
  const sessionsPct = Math.min(1, data.monthSessionsDone / sessionsTarget);
  const goalPct = data.topGoal ? Math.min(1, data.topGoal.pct) : 0;
  const weightPct = data.weight.deltaSinceYearStart !== null ? Math.min(1, Math.abs(data.weight.deltaSinceYearStart) / 6) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-[18px] p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-900">
          Ten tydzień
        </div>
        <div className="text-[11px] text-slate-500">{data.weekUpcoming.find((d) => d.isToday)?.dayShort}</div>
      </div>
      <div className="flex items-center gap-4">
        <RingsSvg sessionsPct={sessionsPct} weightPct={weightPct} goalPct={goalPct} />
        <div className="flex flex-col gap-2 flex-1 text-[12px]">
          <RingLegendRow color="#10b981" label="Sesje" value={`${data.monthSessionsDone}/${sessionsTarget}`} />
          <RingLegendRow color="#f59e0b" label="Cel" value={data.topGoal ? `${Math.round(data.topGoal.pct * 100)}%` : "—"} />
          <RingLegendRow color="#3b82f6" label="Waga" value={data.weight.deltaSinceYearStart !== null ? `${data.weight.deltaSinceYearStart > 0 ? "+" : "−"}${Math.abs(data.weight.deltaSinceYearStart).toFixed(1).replace(".", ",")} kg` : "—"} />
        </div>
      </div>
      <div className="flex gap-2.5 pt-3 border-t border-dashed border-slate-200">
        <StreakItem value={String(data.streakWeeks)} label="Seria tyg." flame={data.streakWeeks >= 4} />
        <StreakItem value={String(data.yearSessionsDone)} label="Sesji w 2026" />
        <StreakItem
          value={data.weight.deltaSinceYearStart !== null && data.weight.deltaSinceYearStart < 0 ? `−${Math.abs(data.weight.deltaSinceYearStart).toFixed(1).replace(".", ",")}` : "—"}
          label="kg od stycznia"
        />
      </div>
    </div>
  );
}

function RingsSvg({
  sessionsPct,
  weightPct,
  goalPct,
}: {
  sessionsPct: number;
  weightPct: number;
  goalPct: number;
}) {
  const ring = (r: number, pct: number, color: string) => {
    const C = 2 * Math.PI * r;
    return (
      <>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${C * pct} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </>
    );
  };
  return (
    <svg viewBox="0 0 100 100" className="w-[120px] h-[120px] shrink-0">
      {ring(40, sessionsPct, "#10b981")}
      {ring(30, goalPct, "#f59e0b")}
      {ring(20, weightPct, "#3b82f6")}
    </svg>
  );
}

function RingLegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: color }} />
      <span className="text-slate-700 flex-1 truncate">{label}</span>
      <span className="font-bold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

function StreakItem({ value, label, flame }: { value: string; label: string; flame?: boolean }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-[20px] font-bold tracking-[-0.02em] text-slate-900 tabular-nums leading-none">
        {value}
        {flame && <span className="text-[18px] ml-0.5">🔥</span>}
      </div>
      <div className="text-[10px] uppercase tracking-[0.06em] font-semibold text-slate-500 mt-1.5">
        {label}
      </div>
    </div>
  );
}

/* ============ PACKAGE CARD ============ */
function PackageCard({ pkg }: { pkg: ActivePackage }) {
  const pct = pkg.total > 0 ? Math.round((pkg.done / pkg.total) * 100) : 0;
  return (
    <div
      className="rounded-[14px] p-5 border"
      style={{ background: "linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%)", borderColor: "#a7f3d0" }}
    >
      <div className="flex items-center justify-between mb-3.5 gap-3">
        <div className="min-w-0">
          <div className="text-[16px] font-bold tracking-[-0.01em] text-slate-900">{pkg.name}</div>
          <div className="text-[12px] font-medium text-slate-500 mt-0.5">z {pkg.trainerName}</div>
        </div>
        <div className="text-[28px] font-bold tracking-[-0.02em] tabular-nums text-emerald-700">
          {pct}%
        </div>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden mb-3.5 relative"
        style={{ background: "rgba(16,185,129,0.15)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg,#10b981,#14b8a6)",
          }}
        />
        <div className="absolute inset-0 flex">
          {Array.from({ length: pkg.total }).map((_, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                borderRight: i < pkg.total - 1 ? "1px dashed rgba(255,255,255,0.5)" : undefined,
              }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        <PkgMeta label="Wykorzystane" value={`${pkg.done}/${pkg.total}`} />
        <PkgMeta label="Pozostało" value={String(pkg.total - pkg.done)} />
        {pkg.validUntil && <PkgMeta label="Ważny do" value={pkg.validUntil} />}
        {pkg.pricePerSession !== null && (
          <PkgMeta label="Cena/sesję" value={`${pkg.pricePerSession} PLN`} />
        )}
      </div>
    </div>
  );
}

function PkgMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.06em] font-semibold text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="text-[13.5px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

/* ============ WEEK PLAN ============ */
function WeekPlanCard({ week }: { week: WeekDay[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[14px] font-bold text-slate-900 m-0">Plan tygodnia</h3>
        <Link href="/account/bookings" className="text-[12px] text-emerald-700 font-semibold">
          Cały kalendarz →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d) => (
          <div
            key={d.iso}
            className={
              "aspect-[1/1.4] rounded-[10px] p-2 flex flex-col gap-1 border " +
              (d.isToday
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200")
            }
          >
            <span
              className={
                "text-[10px] uppercase tracking-[0.07em] font-semibold " +
                (d.isToday ? "text-white" : "text-slate-500")
              }
            >
              {d.dayShort}
            </span>
            <span
              className={
                "text-[18px] font-bold tracking-[-0.02em] tabular-nums " +
                (d.isToday ? "text-white" : "text-slate-900")
              }
            >
              {d.dayNum}
            </span>
            <div className="mt-auto">
              {d.session ? (
                <div
                  className={
                    "text-[9.5px] font-semibold rounded-md px-1.5 py-0.5 leading-tight " +
                    (d.isToday
                      ? "bg-emerald-500 text-white"
                      : "bg-emerald-50 text-emerald-700")
                  }
                >
                  {d.session.time}
                  <span className="block opacity-80 truncate">{d.session.type}</span>
                </div>
              ) : (
                <span className="text-[9px] text-slate-400">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ PROGRESS CARD ============ */
function ProgressCard({
  yearSessionsDone,
  monthSessionsDone,
  weight,
}: {
  yearSessionsDone: number;
  monthSessionsDone: number;
  weight: { latestKg: number | null; deltaSinceYearStart: number | null };
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[14px] font-bold text-slate-900 m-0">Postępy</h3>
        <Link href="/account/progress" className="text-[12px] text-emerald-700 font-semibold">
          Pełne dane →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <MetricCard
          label="Sesji w tym mies."
          value={String(monthSessionsDone)}
          unit={monthSessionsDone === 1 ? "sesja" : monthSessionsDone < 5 ? "sesje" : "sesji"}
          detail={
            yearSessionsDone > 0
              ? `Łącznie ${yearSessionsDone} w 2026`
              : "Pierwsza sesja czeka"
          }
          trend="up"
        />
        <MetricCard
          label="Aktualna waga"
          value={weight.latestKg !== null ? weight.latestKg.toFixed(1).replace(".", ",") : "—"}
          unit={weight.latestKg !== null ? "kg" : undefined}
          detail={
            weight.deltaSinceYearStart === null
              ? "Dodaj pierwszy pomiar"
              : weight.deltaSinceYearStart === 0
                ? "Bez zmian od stycznia"
                : `${weight.deltaSinceYearStart > 0 ? "+" : "−"}${Math.abs(weight.deltaSinceYearStart).toFixed(1).replace(".", ",")} kg od stycznia`
          }
          trend={weight.deltaSinceYearStart !== null && weight.deltaSinceYearStart < 0 ? "up" : "down"}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  detail,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="border border-slate-200 rounded-[12px] p-4">
      <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-slate-500">{label}</div>
      <div className="text-[24px] font-bold tracking-[-0.02em] text-slate-900 tabular-nums mt-1">
        {value}
        {unit && <span className="text-[12px] font-medium text-slate-500 ml-1">{unit}</span>}
      </div>
      <div
        className={
          "text-[11px] font-semibold mt-1 " +
          (trend === "up" ? "text-emerald-700" : trend === "down" ? "text-rose-700" : "text-slate-500")
        }
      >
        {detail}
      </div>
    </div>
  );
}

/* ============ HISTORY TIMELINE ============ */
function HistoryCard({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[14px] font-bold text-slate-900 m-0">Historia sesji</h3>
        <Link href="/account/bookings" className="text-[12px] text-emerald-700 font-semibold">
          Wszystkie →
        </Link>
      </div>
      <div className="relative">
        <span className="absolute left-[18px] top-3 bottom-3 w-px bg-slate-200" />
        {items.map((it) => {
          const d = new Date(it.whenIso);
          const dayNum = d.getDate();
          const monthShort = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"][d.getMonth()];
          return (
            <div key={it.id} className="grid grid-cols-[38px_1fr] gap-3.5 py-2.5 relative">
              <div
                className={
                  "w-[38px] h-[38px] rounded-full flex items-center justify-center text-[10px] font-bold relative bg-white " +
                  (it.future
                    ? "border-2 border-dashed border-slate-300 text-slate-500"
                    : "border-2 border-emerald-500 text-emerald-700")
                }
              >
                {dayNum}
                <span className="absolute -bottom-1 text-[9px] uppercase text-slate-500 font-semibold">{monthShort}</span>
              </div>
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold text-slate-900">{it.serviceName}</span>
                  <span className="text-[11px] text-slate-500">{it.trainerName}</span>
                </div>
                <div className="text-[12px] text-slate-700 leading-[1.45] mt-0.5">{it.detail}</div>
                {it.trainerNote && (
                  <div className="mt-1.5 px-2.5 py-2 bg-slate-50 rounded-[8px] text-[11.5px] text-slate-700 italic leading-[1.45] border-l-2 border-emerald-500">
                    {it.trainerNote}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ RIGHT RAIL — Trainer card ============ */
function TrainerCard({ trainer }: { trainer: SpotlightTrainer }) {
  const initial = trainer.name.charAt(0).toUpperCase();
  return (
    <div
      className="rounded-[14px] p-5 border"
      style={{ background: "linear-gradient(180deg,#ecfdf5 0%,white 60%)", borderColor: "#a7f3d0" }}
    >
      <div className="flex gap-3.5 mb-3.5">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-[22px] shrink-0"
          style={{
            background: "linear-gradient(135deg,#10b981,#14b8a6)",
            border: "3px solid white",
            boxShadow: "0 1px 2px rgba(2,6,23,0.04)",
          }}
        >
          {trainer.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trainer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[16px] font-bold text-slate-900">{trainer.name}</span>
            <span className="text-[10px] font-bold text-emerald-700 px-1.5 py-0.5 bg-white border border-emerald-200 rounded-full">
              ✓ Verified
            </span>
          </div>
          <div className="text-[11.5px] text-slate-600 mt-0.5">{trainer.tagline}</div>
          {trainer.rating > 0 && (
            <div className="inline-flex gap-0.5 items-center mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg
                  key={n}
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={n <= Math.round(trainer.rating) ? "text-amber-400" : "text-slate-200"}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
              <span className="text-[11px] text-slate-700 font-semibold ml-1">
                {trainer.rating.toFixed(1).replace(".", ",")}
              </span>
              {trainer.reviewCount > 0 && (
                <span className="text-[11px] text-slate-500 ml-1">({trainer.reviewCount})</span>
              )}
            </div>
          )}
        </div>
      </div>
      {trainer.lastMessage && (
        <div className="px-3.5 py-3 bg-white rounded-[10px] text-[12.5px] text-slate-700 italic leading-[1.5] mb-3 border border-slate-100 relative">
          {trainer.lastMessage.text.slice(0, 140)}
          {trainer.lastMessage.text.length > 140 && "…"}
          <span className="block not-italic text-[10.5px] text-slate-500 mt-1.5 font-medium">
            {relativeShort(trainer.lastMessage.at)}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/account/messages?with=${trainer.slug}`}
          className="h-9 rounded-[9px] bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Czat
        </Link>
        <Link
          href={`/trainers/${trainer.slug}`}
          className="h-9 rounded-[9px] bg-white border border-slate-200 text-slate-700 text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
        >
          Profil →
        </Link>
      </div>
    </div>
  );
}

/* ============ Goal card ============ */
function GoalCard({ goal }: { goal: { title: string; pct: number; targetDate: string | null } }) {
  const pct = Math.round(Math.min(1, goal.pct) * 100);
  return (
    <div
      className="rounded-[14px] p-5 border"
      style={{ background: "linear-gradient(135deg,#fef3c7 0%,#fed7aa 100%)", borderColor: "#fcd34d" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-amber-900">{goal.title}</div>
          {goal.targetDate && (
            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
              Do {goal.targetDate}
            </div>
          )}
        </div>
        <div className="text-[22px] font-bold text-amber-900 tabular-nums tracking-[-0.02em]">
          {pct}%
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(180,83,9,0.15)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#f59e0b,#fb923c)" }}
        />
      </div>
    </div>
  );
}

/* ============ Achievements ============ */
function AchievementsCard({
  yearCount,
  streak,
  packageDone,
  firstReview,
}: {
  yearCount: number;
  streak: number;
  packageDone: boolean;
  firstReview: boolean;
}) {
  const items: { em: string; ttl: string; det: string; unlocked: boolean }[] = [
    { em: "🎯", ttl: "Pierwszy krok", det: "1 sesja", unlocked: yearCount >= 1 },
    { em: "🔥", ttl: "Seria", det: `${streak >= 4 ? "4+" : streak} tyg.`, unlocked: streak >= 4 },
    { em: "📦", ttl: "Pakiet zakończony", det: packageDone ? "Brawo" : "wkrótce", unlocked: packageDone },
    { em: "⭐", ttl: "Pierwsza opinia", det: firstReview ? "dzięki" : "wkrótce", unlocked: firstReview },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <h3 className="text-[14px] font-bold text-slate-900 m-0 mb-3.5">Osiągnięcia</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((it) => (
          <div
            key={it.ttl}
            className={
              "aspect-square rounded-[12px] p-2 flex flex-col items-center justify-center gap-1 text-center border " +
              (it.unlocked
                ? "border-amber-300"
                : "border-slate-200 opacity-50")
            }
            style={
              it.unlocked
                ? { background: "linear-gradient(135deg,#fef3c7,#fde68a)" }
                : undefined
            }
          >
            <span className="text-[22px]">{it.em}</span>
            <span className={"text-[10px] font-bold leading-tight " + (it.unlocked ? "text-amber-900" : "text-slate-700")}>
              {it.ttl}
            </span>
            <span className={"text-[9px] " + (it.unlocked ? "text-amber-700" : "text-slate-400")}>
              {it.det}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Notifications ============ */
function NotificationsCard({ items }: { items: Notif[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[14px] font-bold text-slate-900 m-0">Powiadomienia</h3>
        <Link href="/account/messages" className="text-[12px] text-emerald-700 font-semibold">
          Wszystkie →
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-slate-500 italic px-3 py-4 border border-dashed border-slate-200 rounded-[10px] text-center">
          Brak nowych powiadomień
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.slice(0, 5).map((n) => {
            const toneBg =
              n.tone === "amber" ? "bg-amber-500" : n.tone === "blue" ? "bg-sky-500" : "bg-emerald-500";
            return (
              <div
                key={n.id}
                className={
                  "flex gap-2.5 px-3 py-2.5 rounded-[10px] " +
                  (n.unread ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50")
                }
              >
                <span className={`w-7 h-7 rounded-[8px] inline-flex items-center justify-center shrink-0 ${toneBg}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-slate-900 leading-[1.4]">{n.text}</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">{relativeShort(n.whenIso)}</div>
                </div>
                {n.unread && <span className="w-2 h-2 rounded-full bg-emerald-500 self-center shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ Recommended ============ */
function RecommendedCard({ items }: { items: RecommendedTrainer[] }) {
  const palette = [
    { ic: "bg-emerald-50 text-emerald-700" },
    { ic: "bg-amber-50 text-amber-700" },
    { ic: "bg-sky-50 text-sky-700" },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[14px] font-bold text-slate-900 m-0">Polecane</h3>
        <Link href="/trainers" className="text-[12px] text-emerald-700 font-semibold">
          Wszyscy →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {items.slice(0, 3).map((t, i) => {
          const initial = t.name.charAt(0).toUpperCase();
          const p = palette[i % palette.length];
          return (
            <Link
              key={t.slug}
              href={`/trainers/${t.slug}`}
              className="flex items-center gap-3 px-3 py-2.5 border border-slate-200 rounded-[10px] hover:border-emerald-300 hover:bg-emerald-50/30 transition"
            >
              <span
                className={
                  "w-9 h-9 rounded-[9px] inline-flex items-center justify-center font-bold text-[16px] shrink-0 " +
                  p.ic
                }
              >
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="w-full h-full rounded-[9px] object-cover" />
                ) : (
                  initial
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-900 truncate">{t.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{t.pitch}</div>
              </div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums whitespace-nowrap">
                {t.pricePerSession} PLN
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Helpers ============ */
function relativeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "teraz";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} dni temu`;
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export const PL_DAY_SHORT_EXPORT = PL_DAYS_SHORT;
