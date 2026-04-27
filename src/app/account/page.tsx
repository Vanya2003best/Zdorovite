import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFavoriteTrainersBrief } from "@/lib/db/favorites";
import { getPendingRescheduleForBooking } from "@/lib/db/reschedule";
import { getGoals, type Goal } from "@/lib/db/goals";
import { getLatestWeight, getYearStartWeight } from "@/lib/db/weight";
import { getHealth } from "@/lib/db/health";
import { getRecommendedTrainer } from "@/lib/db/recommendations";
import { getSpecLabel } from "@/data/specializations";
import RescheduleDialog from "@/components/RescheduleDialog";

function fmtKg(kg: number): string {
  return `${kg.toFixed(1).replace(".", ",")} kg`;
}

function fmtDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return "±0 kg";
  const sign = delta < 0 ? "−" : "+";
  return `${sign}${Math.abs(delta).toFixed(1).replace(".", ",")} kg`;
}

function fmtTargetDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const months = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
  return `Cel: ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function goalNote(g: Goal): string {
  const unit = g.unit ? ` ${g.unit}` : "";
  return `${g.startValue}${unit} → ${g.targetValue}${unit}`;
}

const PL_DAY_SHORT = ["Nie", "Pon", "Wt", "Śr", "Czw", "Pią", "Sob"];
const PL_DAY_LONG = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const PL_MONTH = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const PL_MONTH_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffH = Math.round(diffMs / 3_600_000);
  const diffD = Math.round(diffMs / 86_400_000);
  if (diffMin < 1) return "Teraz";
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffH < 24) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diffD === 1) return "Wczoraj";
  if (diffD < 7) return `${diffD} dni temu`;
  return `${d.getDate()} ${PL_MONTH_SHORT[d.getMonth()].toUpperCase()}`;
}

type BookingRow = {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  created_at: string;
  package_id: string | null;
  service: { name: string; duration: number } | null;
  package: { name: string; sessions_total: number | null } | null;
  trainer: {
    slug: string;
    location: string;
    profile: { display_name: string; avatar_url: string | null } | null;
  } | null;
};

export default async function AccountDashboardPage() {
  const { user, profile } = await requireClient("/account");
  const supabase = await createClient();
  const [favorites, goals, latestWeight, yearStartWeight, health, reco] = await Promise.all([
    getFavoriteTrainersBrief(user.id),
    getGoals(user.id),
    getLatestWeight(user.id),
    getYearStartWeight(user.id),
    getHealth(user.id),
    getRecommendedTrainer(user.id),
  ]);

  const weightDelta =
    latestWeight && yearStartWeight && latestWeight.recordedAt !== yearStartWeight.recordedAt
      ? latestWeight.weightKg - yearStartWeight.weightKg
      : null;
  const heroWeight = weightDelta !== null ? fmtDelta(weightDelta) : latestWeight ? fmtKg(latestWeight.weightKg) : "—";
  const heroTopGoal = goals[0] ?? null;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const completedStatuses = ["confirmed", "paid", "completed"];

  // Year bookings — for hero count, packages progress, monthly chart
  const { data: yearBookingsRaw } = await supabase
    .from("bookings")
    .select(`
      id, trainer_id, start_time, end_time, status, price, created_at, package_id,
      service:services ( name, duration ),
      package:packages ( name, sessions_total ),
      trainer:trainers!trainer_id (
        slug, location, profile:profiles!id ( display_name, avatar_url )
      )
    `)
    .eq("client_id", user.id)
    .gte("start_time", yearStart.toISOString())
    .order("start_time", { ascending: true });
  const yearBookings = (yearBookingsRaw ?? []) as unknown as BookingRow[];

  // Counts
  const yearCount = yearBookings.filter((b) => completedStatuses.includes(b.status)).length;

  // Monthly chart (12 months)
  const monthCounts = Array.from({ length: 12 }, () => 0);
  for (const b of yearBookings) {
    if (!completedStatuses.includes(b.status)) continue;
    monthCounts[new Date(b.start_time).getMonth()]++;
  }
  const monthMax = Math.max(1, ...monthCounts);
  const currentMonth = now.getMonth();

  // Calendar — dates in current month with at least one booking
  const sessionDays = new Set<number>();
  for (const b of yearBookings) {
    const d = new Date(b.start_time);
    if (d >= monthStart && d < monthEnd) sessionDays.add(d.getDate());
  }

  // Active packages — group year bookings by package_id
  const pkgGroups = new Map<
    string,
    { name: string; trainerName: string; trainerAvatar: string | null; count: number; total: number | null }
  >();
  for (const b of yearBookings) {
    if (!b.package_id || !b.package) continue;
    const trainerName = b.trainer?.profile?.display_name ?? "Trener";
    const trainerAvatar = b.trainer?.profile?.avatar_url ?? null;
    const existing = pkgGroups.get(b.package_id);
    if (existing) existing.count++;
    else pkgGroups.set(b.package_id, {
      name: b.package.name,
      trainerName,
      trainerAvatar,
      count: 1,
      total: b.package.sessions_total,
    });
  }
  const activePackages = Array.from(pkgGroups.values()).slice(0, 3);

  // Upcoming sessions (next 4)
  const upcoming = yearBookings
    .filter((b) => new Date(b.start_time) >= now && ["confirmed", "paid", "pending"].includes(b.status))
    .slice(0, 4);
  const next = upcoming[0];
  const otherUpcoming = upcoming.slice(1, 4);
  const nextPendingReschedule = next ? await getPendingRescheduleForBooking(next.id) : null;

  // Activity feed — merge recent bookings + incoming messages, sorted by created_at.
  type ActivityItem =
    | { kind: "booking"; id: string; createdAt: string; status: string; trainerName: string; what: string }
    | { kind: "message"; id: string; createdAt: string; trainerName: string; preview: string; fromId: string };

  const { data: rawIncomingMsgs } = await supabase
    .from("messages")
    .select(`
      id, from_id, text, created_at,
      sender:profiles!from_id ( display_name ),
      trainer:trainers!from_id ( slug )
    `)
    .eq("to_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);
  type IncomingMsgRow = {
    id: string; from_id: string; text: string; created_at: string;
    sender: { display_name: string } | null;
    trainer: { slug: string } | null;
  };
  const incomingMsgs: ActivityItem[] = ((rawIncomingMsgs ?? []) as unknown as IncomingMsgRow[])
    .filter((m) => m.trainer !== null) // only messages from trainers (skip system / non-trainer senders)
    .map((m) => ({
      kind: "message" as const,
      id: m.id,
      createdAt: m.created_at,
      trainerName: m.sender?.display_name ?? "Trener",
      preview: m.text.slice(0, 80),
      fromId: m.from_id,
    }));

  const bookingActivity: ActivityItem[] = [...yearBookings].map((b) => ({
    kind: "booking" as const,
    id: b.id,
    createdAt: b.created_at,
    status: b.status,
    trainerName: b.trainer?.profile?.display_name ?? "Trener",
    what: b.service?.name ?? b.package?.name ?? "Sesja",
  }));

  const activity: ActivityItem[] = [...bookingActivity, ...incomingMsgs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Hero greeting
  const firstName = profile.display_name.split(" ")[0] || "Klient";
  let heroSub: string;
  if (next) {
    const days = Math.max(0, Math.round((new Date(next.start_time).getTime() - now.getTime()) / 86_400_000));
    const dayWord = days === 0 ? "dziś" : days === 1 ? "jutro" : `za ${days} dni`;
    const pkgPart = activePackages[0] ? ` · Pakiet „${activePackages[0].name}" w trakcie` : "";
    heroSub = `Najbliższa sesja ${dayWord}${pkgPart}`;
  } else {
    heroSub = "Brak nadchodzących sesji — wybierz trenera i zarezerwuj pierwszą.";
  }

  // Calendar grid (Mon-first)
  const firstDayOfMonth = new Date(now.getFullYear(), currentMonth, 1).getDay(); // 0=Sun
  const offsetMon = (firstDayOfMonth + 6) % 7; // Pn=0
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();
  const today = now.getDate();
  const nextSessionDay = next && new Date(next.start_time).getMonth() === currentMonth
    ? new Date(next.start_time).getDate()
    : -1;

  return (
    <div className="max-w-[1320px] mx-auto px-5 sm:px-7 py-7 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* ============ HERO ============ */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-[18px] p-5 sm:p-7 lg:p-8 text-white flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 lg:gap-6 [background:linear-gradient(135deg,#064e3b_0%,#047857_50%,#14b8a6_100%)]">
        <div className="pointer-events-none absolute -right-12 -top-16 lg:-right-20 lg:-top-24 w-[180px] h-[180px] lg:w-[360px] lg:h-[360px] rounded-full [background:radial-gradient(circle,rgba(255,255,255,0.12),transparent_70%)]" />
        <div className="relative z-[2]">
          {/* Mobile: package-focused; greeting is in the top bar already */}
          <div className="lg:hidden">
            <div className="text-[11px] opacity-85 uppercase tracking-wider font-semibold">
              {activePackages[0] ? "Aktywny pakiet" : "Twoja podróż"}
            </div>
            <h1 className="text-[22px] tracking-[-0.02em] font-semibold leading-[1.15] mt-1">
              {activePackages[0] ? (
                <>
                  {activePackages[0].count} sesji w pakiecie.<br />
                  W trakcie 💪
                </>
              ) : (
                <>Zacznij swoją drogę 💪</>
              )}
            </h1>
          </div>
          {/* Desktop: greeting + sub */}
          <div className="hidden lg:block">
            <h1 className="text-[28px] tracking-[-0.02em] font-semibold m-0 mb-1.5">
              Cześć {firstName}, ruszamy 💪
            </h1>
            <p className="text-sm opacity-85 m-0">{heroSub}</p>
          </div>
        </div>
        <div className="relative z-[2] flex gap-5 sm:gap-7 lg:gap-8 flex-wrap">
          <div>
            <div className="text-[18px] lg:text-[28px] font-bold tracking-[-0.02em]">{yearCount}</div>
            <div className="text-[10px] lg:text-[11px] opacity-70 uppercase tracking-wider mt-0.5">Sesji 2026</div>
          </div>
          <div>
            <div className="text-[18px] lg:text-[28px] font-bold tracking-[-0.02em]">{heroWeight}</div>
            <div className="text-[10px] lg:text-[11px] opacity-70 uppercase tracking-wider mt-0.5">
              {weightDelta !== null ? "Od stycznia" : latestWeight ? "Aktualna waga" : "Brak pomiarów"}
            </div>
          </div>
          <div>
            <div className="text-[18px] lg:text-[28px] font-bold tracking-[-0.02em]">
              {heroTopGoal ? `${Math.round(heroTopGoal.pct * 100)}%` : "—"}
            </div>
            <div className="text-[10px] lg:text-[11px] opacity-70 uppercase tracking-wider mt-0.5">
              {heroTopGoal ? heroTopGoal.title.slice(0, 24) : "Brak celów"}
            </div>
          </div>
        </div>
      </div>

      {/* ============ LEFT COLUMN ============ */}
      <div className="grid gap-5 min-w-0">
        {/* Najbliższa sesja */}
        <section className="bg-white border border-slate-200 rounded-[14px] p-5">
          <div className="flex justify-between items-baseline mb-3.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] m-0">Najbliższa sesja</h2>
            {upcoming.length > 0 && (
              <Link href="/account/bookings" className="text-xs text-emerald-700 font-medium">
                Wszystkie {upcoming.length} →
              </Link>
            )}
          </div>

          {next ? (
            <>
              <div className="grid grid-cols-[100px_1fr_auto] gap-4 sm:gap-5 items-center p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white mb-3">
                <div className="bg-white border border-emerald-200 rounded-[10px] text-center py-2.5">
                  <div className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider">
                    {PL_DAY_SHORT[new Date(next.start_time).getDay()]}
                  </div>
                  <div className="text-[28px] font-bold text-slate-900 tracking-[-0.02em] leading-tight">
                    {new Date(next.start_time).getDate()}
                  </div>
                  <div className="text-[11px] text-slate-600">{fmtTime(next.start_time)}</div>
                </div>
                <div className="flex gap-3 items-center min-w-0">
                  {next.trainer?.profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={next.trainer.profile.avatar_url}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
                      {(next.trainer?.profile?.display_name ?? "?").charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {next.trainer?.profile?.display_name ?? "Trener"}
                      {(next.service?.name || next.package?.name) && (
                        <> · {next.service?.name ?? next.package?.name}</>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 flex gap-3 flex-wrap">
                      {next.service?.duration && (
                        <span className="inline-flex gap-1 items-center">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {next.service.duration} min
                        </span>
                      )}
                      {next.trainer?.location && (
                        <span className="inline-flex gap-1 items-center">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {next.trainer.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                  {nextPendingReschedule ? (
                    <Link
                      href={`/account/messages?with=${next.trainer_id}`}
                      className="px-3 py-2 rounded-lg text-[12.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                    >
                      Czeka na zmianę
                    </Link>
                  ) : (
                    <RescheduleDialog
                      bookingId={next.id}
                      trainerId={next.trainer_id}
                      currentStartIso={next.start_time}
                      durationMin={next.service?.duration ?? 60}
                      triggerLabel="Przenieś"
                      triggerClassName="px-3 py-2 rounded-lg text-[12.5px] font-medium bg-white text-slate-700 border border-slate-200 hover:border-slate-400 transition"
                    />
                  )}
                  <Link
                    href={`/account/messages?with=${next.trainer_id}`}
                    className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium bg-slate-900 text-white hover:bg-black transition"
                  >
                    Otwórz czat
                  </Link>
                </div>
              </div>

              {otherUpcoming.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {otherUpcoming.map((b) => {
                    const d = new Date(b.start_time);
                    return (
                      <div key={b.id} className="px-3 py-2.5 bg-slate-50 rounded-[9px] text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {PL_DAY_LONG[(d.getDay() + 6) % 7]} {d.getDate()} {PL_MONTH_SHORT[d.getMonth()]} · {fmtTime(b.start_time)}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {b.trainer?.profile?.display_name ?? "Trener"} · {b.service?.name ?? b.package?.name ?? "Sesja"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-sm text-slate-500">
              <p className="mb-3">Nie masz zaplanowanych sesji.</p>
              <Link
                href="/trainers"
                className="inline-flex h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium items-center hover:bg-black transition"
              >
                Znajdź trenera
              </Link>
            </div>
          )}
        </section>

        {/* Aktywne pakiety */}
        <section className="bg-white border border-slate-200 rounded-[14px] p-5">
          <div className="flex justify-between items-baseline mb-3.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] m-0">Aktywne pakiety</h2>
            <Link href="/trainers" className="text-xs text-emerald-700 font-medium">
              Kup nowy →
            </Link>
          </div>
          {activePackages.length === 0 ? (
            <p className="text-sm text-slate-500">Nie masz jeszcze aktywnych pakietów. Wybierz trenera i kup pakiet, by śledzić postęp.</p>
          ) : (
            <div className="grid gap-2">
              {activePackages.map((pkg, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-center p-3.5 border border-slate-200 rounded-xl"
                >
                  {pkg.trainerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pkg.trainerAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 inline-flex items-center justify-center text-sm font-semibold">
                      {pkg.trainerName.charAt(0)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold truncate">{pkg.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{pkg.trainerName}</div>
                  </div>
                  <div className="w-44 shrink-0 hidden sm:block">
                    {pkg.total ? (
                      <>
                        <div className="h-[5px] bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                            style={{ width: `${Math.min(100, Math.round((pkg.count / pkg.total) * 100))}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
                          <span>{pkg.count} / {pkg.total} sesji</span>
                          <span className="text-emerald-700 font-semibold">
                            {Math.round((pkg.count / pkg.total) * 100)}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-slate-500 text-right">
                        {pkg.count} {pkg.count === 1 ? "sesja" : "sesji"} w pakiecie
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cele + chart */}
        <div className="grid sm:grid-cols-2 gap-5">
          {/* Cele */}
          <section className="bg-white border border-slate-200 rounded-[14px] p-5">
            <div className="flex justify-between items-baseline mb-3.5">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] m-0">Cele</h2>
              <Link href="/account/progress" className="text-xs text-emerald-700 font-medium">Edytuj</Link>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                Nie masz jeszcze celów. Dodaj pierwszy w{" "}
                <Link href="/account/progress" className="text-emerald-700 font-medium">
                  Postępach
                </Link>
                , żeby śledzić postęp.
              </p>
            ) : (
              <div className="grid gap-2">
                {goals.slice(0, 3).map((g) => {
                  const pct = Math.round(g.pct * 100);
                  return (
                    <div key={g.id} className="p-3.5 border border-slate-200 rounded-xl">
                      <div className="flex justify-between mb-2">
                        <span className="text-[13px] font-semibold truncate pr-2">{g.title}</span>
                        <span className="text-xs text-emerald-700 font-semibold shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded overflow-hidden mb-1.5">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between gap-2">
                        <span className="truncate">{g.targetDate ? fmtTargetDate(g.targetDate) : g.note ?? ""}</span>
                        <span className="shrink-0">{goalNote(g)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Chart */}
          <section className="bg-white border border-slate-200 rounded-[14px] p-5">
            <div className="flex justify-between items-baseline mb-3.5">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] m-0">Sesje w tym roku</h2>
            </div>
            <div className="text-[32px] font-semibold tracking-[-0.02em]">
              {yearCount}
              <span className="text-[13px] text-slate-500 font-normal ml-1.5">sesji do tej pory</span>
            </div>
            <div className="flex items-end gap-1 h-20 mt-2">
              {monthCounts.map((c, i) => {
                const past = i <= currentMonth;
                const h = past ? Math.max(8, (c / monthMax) * 100) : 6;
                const isCur = i === currentMonth;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-[3px] ${
                      isCur
                        ? "bg-gradient-to-t from-emerald-500 to-teal-400"
                        : past
                          ? "bg-emerald-100"
                          : "bg-slate-100"
                    }`}
                    style={{ height: `${h}%` }}
                    title={`${PL_MONTH[i]}: ${c} sesji`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
              {PL_MONTH_SHORT.map((m) => <span key={m}>{m}</span>)}
            </div>
          </section>
        </div>

        {/* Aktywność */}
        <section className="bg-white border border-slate-200 rounded-[14px] p-5">
          <div className="flex justify-between items-baseline mb-3.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] m-0">Ostatnia aktywność</h2>
            <Link href="/account/bookings" className="text-xs text-emerald-700 font-medium">
              Pełna historia →
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">Brak aktywności w tym roku.</p>
          ) : (
            <div className="grid gap-1">
              {activity.map((a) => {
                if (a.kind === "message") {
                  return (
                    <Link
                      key={`msg-${a.id}`}
                      href={`/account/messages?with=${a.fromId}`}
                      className="flex gap-3 p-2.5 rounded-[10px] hover:bg-slate-50 transition"
                    >
                      <div className="w-8 h-8 rounded-[9px] bg-blue-50 text-blue-700 inline-flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 truncate">
                          Wiadomość od {a.trainerName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate italic">&ldquo;{a.preview}&rdquo;</div>
                      </div>
                      <div className="text-[11px] text-slate-400 self-center shrink-0">
                        {fmtRelative(a.createdAt)}
                      </div>
                    </Link>
                  );
                }

                const isCompleted = a.status === "completed";
                const isCancelled = a.status === "cancelled";
                return (
                  <div key={`bk-${a.id}`} className="flex gap-3 p-2.5 rounded-[10px] hover:bg-slate-50 transition">
                    <div
                      className={`w-8 h-8 rounded-[9px] inline-flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700"
                          : isCancelled
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {isCompleted ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : isCancelled ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-slate-900 truncate">
                        {isCompleted
                          ? `Sesja ukończona — ${a.trainerName}`
                          : isCancelled
                            ? `Sesja anulowana — ${a.trainerName}`
                            : `Sesja zarezerwowana — ${a.trainerName}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{a.what}</div>
                    </div>
                    <div className="text-[11px] text-slate-400 self-center shrink-0">
                      {fmtRelative(a.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ============ RIGHT SIDEBAR ============ */}
      <aside className="grid gap-4 min-w-0">
        {/* Calendar */}
        <div className="bg-white border border-slate-200 rounded-[14px] p-4">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
            {PL_MONTH[currentMonth]} {now.getFullYear()}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {PL_DAY_LONG.map((d) => (
              <span key={d} className="text-[10px] text-slate-400 py-1 font-medium">{d}</span>
            ))}
            {Array.from({ length: offsetMon }).map((_, i) => (
              <span key={`pad-${i}`} className="text-xs text-slate-300 py-1.5">·</span>
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const isToday = d === today;
              const isNextSession = d === nextSessionDay;
              const has = sessionDays.has(d) && !isNextSession && !isToday;
              return (
                <span
                  key={d}
                  className={`text-xs py-1.5 rounded-md relative ${
                    isToday
                      ? "bg-slate-900 text-white font-semibold"
                      : isNextSession
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-700"
                  }`}
                >
                  {d}
                  {has && (
                    <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full" />
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex gap-3.5 mt-3 text-[10.5px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-100 rounded-sm" />
              Sesja
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Aktywność
            </span>
          </div>
        </div>

        {/* Recommendation — top-rated trainer the client doesn't know yet, ideally
            in a specialization they already engage with. Hides if there's nothing
            to recommend (e.g. they've already favorited / booked the catalog). */}
        {reco && (
          <Link
            href={`/trainers/${reco.slug}`}
            className="block p-3.5 border border-amber-200 rounded-xl bg-gradient-to-br from-amber-50 to-white hover:border-amber-300 transition"
          >
            <div className="text-[11px] text-amber-700 uppercase tracking-wider font-bold mb-1.5 flex gap-1.5 items-center">
              ★ Rekomendacja
            </div>
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] m-0 mb-1">
              {reco.matchedSpec
                ? `${getSpecLabel(reco.matchedSpec as never)} — wypróbuj ${reco.name}`
                : `Sprawdź ${reco.name}`}
            </h3>
            <p className="text-xs text-slate-600 m-0 mb-2.5 leading-snug">
              {reco.location} · ★ {reco.rating.toFixed(1)} · od {reco.priceFrom} zł / sesja
            </p>
            <span className="block w-full py-2 bg-slate-900 text-white text-center text-xs font-medium rounded-[7px]">
              Zobacz profil →
            </span>
          </Link>
        )}

        {/* Favorites */}
        <div className="bg-white border border-slate-200 rounded-[14px] p-4">
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Ulubieni trenerzy{favorites.length > 0 ? ` · ${favorites.length}` : ""}
            </div>
            {favorites.length > 0 && (
              <Link href="/trainers?fav=1" className="text-[11.5px] text-emerald-700 font-medium">
                Wszyscy →
              </Link>
            )}
          </div>
          {favorites.length === 0 ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              Klikaj serce na profilu trenera, by dodać go tutaj.{" "}
              <Link href="/trainers" className="text-emerald-700 font-medium">
                Znajdź trenera →
              </Link>
            </p>
          ) : (
            <div className="grid">
              {favorites.slice(0, 4).map((f) => (
                <Link
                  key={f.slug}
                  href={`/trainers/${f.slug}`}
                  className="flex gap-2.5 items-center py-2 border-b border-slate-100 last:border-b-0 hover:opacity-90 transition"
                >
                  {f.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center text-xs font-semibold shrink-0">
                      {(f.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate">{f.name || "Trener"}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      ★ {f.rating.toFixed(1)}
                      {f.mainSpec ? ` · ${getSpecLabel(f.mainSpec as never)}` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Paszport zdrowia — sidebar summary, full editor on /account/progress */}
        <div className="bg-white border border-slate-200 rounded-[14px] p-4">
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Paszport zdrowia
            </div>
            <Link href="/account/progress" className="text-[11.5px] text-emerald-700 font-medium">Edytuj →</Link>
          </div>
          {health.note ? (
            <p className="text-xs text-slate-700 leading-relaxed mb-3">{health.note}</p>
          ) : (
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Dodaj notatkę o zdrowiu — Twój trener zobaczy ją przy planowaniu sesji.
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
              <div className="text-[11px] text-slate-500">Waga</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5">
                {latestWeight ? `${latestWeight.weightKg.toFixed(1).replace(".", ",")} kg` : "—"}
              </div>
            </div>
            <div className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
              <div className="text-[11px] text-slate-500">Wzrost</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5">
                {health.heightCm ? `${health.heightCm} cm` : "—"}
              </div>
            </div>
            <div className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
              <div className="text-[11px] text-slate-500">FMS</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5">
                {health.fmsScore !== null ? `${health.fmsScore} / 21` : "—"}
              </div>
            </div>
            <div className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
              <div className="text-[11px] text-slate-500">Tętno spocz.</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5">
                {health.restingHr ? `${health.restingHr} bpm` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Sign-out — kept from previous page */}
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="w-full h-11 rounded-[10px] border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-400 transition"
          >
            Wyloguj się
          </button>
        </form>
      </aside>
    </div>
  );
}
