import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFavoriteTrainersBrief } from "@/lib/db/favorites";
import { getSpecLabel } from "@/data/specializations";

// ----- Mock data: features without backend tables yet. See
// project_account_dashboard_followups memory for the migration list. -----
const MOCK_GOALS = [
  { title: "Powrót do biegania", pct: 62, when: "Cel: czerwiec 2026", note: "5 km bez bólu" },
  { title: "Schudnąć do 78 kg", pct: 78, when: "83,8 kg → 78 kg", note: "−6,2 kg z −8 kg" },
  { title: "Pull-up bez gumy", pct: 30, when: "Cel: wrzesień", note: "2 powtórzenia z 6" },
];

const MOCK_HEALTH = {
  note: "ACL prawego kolana, 9 mies. po op. Cel: czerwiec — bieganie.",
  metrics: [
    ["Wzrost", "182 cm"],
    ["Waga", "77,6 kg"],
    ["FMS", "14 / 21"],
    ["Tętno spocz.", "62 bpm"],
  ] as const,
};

const MOCK_RECO = {
  title: "Po pakiecie z Ewą — joga z Zofią?",
  body: `Twoje kolano stabilizuje się szybciej dzięki yodze. Pasujący trener w Twojej okolicy — 4,8★, plan „Spokojny powrót" zaczyna się od 620 zł.`,
  cta: "Zobacz Zofię Nowak →",
};

const MOCK_HERO_WEIGHT = "−6,2 kg";

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
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  created_at: string;
  package_id: string | null;
  service: { name: string; duration: number } | null;
  package: { name: string } | null;
  trainer: {
    slug: string;
    location: string;
    profile: { display_name: string; avatar_url: string | null } | null;
  } | null;
};

export default async function AccountDashboardPage() {
  const { user, profile } = await requireClient("/account");
  const supabase = await createClient();
  const favorites = await getFavoriteTrainersBrief(user.id);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const completedStatuses = ["confirmed", "paid", "completed"];

  // Year bookings — for hero count, packages progress, monthly chart
  const { data: yearBookingsRaw } = await supabase
    .from("bookings")
    .select(`
      id, start_time, end_time, status, price, created_at, package_id,
      service:services ( name, duration ),
      package:packages ( name ),
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
  const pkgGroups = new Map<string, { name: string; trainerName: string; trainerAvatar: string | null; count: number }>();
  for (const b of yearBookings) {
    if (!b.package_id || !b.package) continue;
    const trainerName = b.trainer?.profile?.display_name ?? "Trener";
    const trainerAvatar = b.trainer?.profile?.avatar_url ?? null;
    const existing = pkgGroups.get(b.package_id);
    if (existing) existing.count++;
    else pkgGroups.set(b.package_id, { name: b.package.name, trainerName, trainerAvatar, count: 1 });
  }
  const activePackages = Array.from(pkgGroups.values()).slice(0, 3);

  // Upcoming sessions (next 4)
  const upcoming = yearBookings
    .filter((b) => new Date(b.start_time) >= now && ["confirmed", "paid", "pending"].includes(b.status))
    .slice(0, 4);
  const next = upcoming[0];
  const otherUpcoming = upcoming.slice(1, 4);

  // Activity feed — last 4 events derived from bookings
  const activity = [...yearBookings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

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
            <div className="text-[18px] lg:text-[28px] font-bold tracking-[-0.02em]">{MOCK_HERO_WEIGHT}</div>
            <div className="text-[10px] lg:text-[11px] opacity-70 uppercase tracking-wider mt-0.5">Od stycznia</div>
          </div>
          <div>
            <div className="text-[18px] lg:text-[28px] font-bold tracking-[-0.02em]">62%</div>
            <div className="text-[10px] lg:text-[11px] opacity-70 uppercase tracking-wider mt-0.5">Cel biegania</div>
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
                <div className="flex gap-1.5 shrink-0">
                  <Link
                    href="/account/messages"
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
                    {/* TODO: real progress needs sessions_total column on packages */}
                    <div className="h-[5px] bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${Math.min(100, pkg.count * 12.5)}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
                      <span>{pkg.count} sesji</span>
                      <span className="text-emerald-700 font-semibold">w toku</span>
                    </div>
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
              <Link href="#" className="text-xs text-emerald-700 font-medium">Edytuj</Link>
            </div>
            <div className="grid gap-2">
              {/* TODO: needs goals table */}
              {MOCK_GOALS.map((g) => (
                <div key={g.title} className="p-3.5 border border-slate-200 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-[13px] font-semibold">{g.title}</span>
                    <span className="text-xs text-emerald-700 font-semibold">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded overflow-hidden mb-1.5">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${g.pct}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>{g.when}</span>
                    <span>{g.note}</span>
                  </div>
                </div>
              ))}
            </div>
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
              {activity.map((b) => {
                const isCompleted = b.status === "completed";
                const trainerName = b.trainer?.profile?.display_name ?? "Trener";
                const what = b.service?.name ?? b.package?.name ?? "Sesja";
                return (
                  <div key={b.id} className="flex gap-3 p-2.5 rounded-[10px] hover:bg-slate-50 transition">
                    <div
                      className={`w-8 h-8 rounded-[9px] inline-flex items-center justify-center shrink-0 ${
                        isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {isCompleted ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M20 6L9 17l-5-5" />
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
                        {isCompleted ? `Sesja ukończona — ${trainerName}` : `Sesja zarezerwowana — ${trainerName}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{what}</div>
                    </div>
                    <div className="text-[11px] text-slate-400 self-center shrink-0">
                      {fmtRelative(b.created_at)}
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

        {/* Recommendation — TODO: needs recommendations engine */}
        <Link
          href="/trainers"
          className="block p-3.5 border border-amber-200 rounded-xl bg-gradient-to-br from-amber-50 to-white hover:border-amber-300 transition"
        >
          <div className="text-[11px] text-amber-700 uppercase tracking-wider font-bold mb-1.5 flex gap-1.5 items-center">
            ★ Rekomendacja
          </div>
          <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] m-0 mb-1">{MOCK_RECO.title}</h3>
          <p className="text-xs text-slate-600 m-0 mb-2.5 leading-snug">{MOCK_RECO.body}</p>
          <span className="block w-full py-2 bg-slate-900 text-white text-center text-xs font-medium rounded-[7px]">
            {MOCK_RECO.cta}
          </span>
        </Link>

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

        {/* Paszport zdrowia — TODO: needs health_passport table */}
        <div className="bg-white border border-slate-200 rounded-[14px] p-4">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
            Paszport zdrowia
          </div>
          <div className="text-xs text-slate-700 leading-relaxed mb-3">
            {MOCK_HEALTH.note}{" "}
            <Link href="#" className="text-emerald-700 font-medium">Edytuj →</Link>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {MOCK_HEALTH.metrics.map(([label, value]) => (
              <div key={label} className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">{value}</div>
              </div>
            ))}
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
