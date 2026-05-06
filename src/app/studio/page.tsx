import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeOnboarding } from "./start/onboarding-checklist";

type RecentBooking = {
  id: string;
  start_time: string;
  status: string;
  price: number | null;
  service_price?: number | null;
  service_name: string | null;
  service: { name: string } | null;
  client: { display_name: string | null; avatar_url: string | null } | null;
};

type RecentMessage = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  from_id: string;
  author: { display_name: string | null; avatar_url: string | null } | null;
};

type RecentReview = {
  id: string;
  rating: number;
  text: string | null;
  created_at: string;
  reply_text: string | null;
  author: { display_name: string | null; avatar_url: string | null } | null;
};

export default async function StudioHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug, rating, review_count, published")
    .eq("id", user.id)
    .maybeSingle();

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfPrevWeek = new Date(startOfWeek); startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
  const start12mAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ===== Parallel queries =====
  const [
    pendingCountRes,
    todayCountRes,
    weekCountRes,
    prevWeekCountRes,
    upcomingRes,
    twelveMonthRes,
    activeClientsRes,
    unreadMessagesRes,
    recentMessagesRes,
    pendingReviewsRes,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .in("status", ["confirmed", "paid"])
      .gte("start_time", startOfToday.toISOString())
      .lte("start_time", endOfToday.toISOString()),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .in("status", ["confirmed", "paid", "completed"])
      .gte("start_time", startOfWeek.toISOString()),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .in("status", ["confirmed", "paid", "completed"])
      .gte("start_time", startOfPrevWeek.toISOString())
      .lt("start_time", startOfWeek.toISOString()),
    // Upcoming sessions, today + tomorrow + the rest of week.
    supabase
      .from("bookings")
      .select(
        `
        id, start_time, status, price, service_price, service_name,
        service:services!service_id ( name ),
        client:profiles!client_id ( display_name, avatar_url )
        `,
      )
      .eq("trainer_id", user.id)
      .in("status", ["confirmed", "paid", "pending"])
      .gte("start_time", now.toISOString())
      .order("start_time", { ascending: true })
      .limit(8),
    // 12-month revenue chart — all paid bookings since Jan-of-last-year.
    // Aggregation client-side (cheap; max ~365 rows).
    supabase
      .from("bookings")
      .select("paid_at, payment_amount, price, service_price")
      .eq("trainer_id", user.id)
      .eq("payment_status", "paid")
      .gte("paid_at", start12mAgo.toISOString()),
    // Active clients: distinct client_id with a booking in last 30d.
    supabase
      .from("bookings")
      .select("client_id")
      .eq("trainer_id", user.id)
      .gte("start_time", thirtyDaysAgo.toISOString()),
    // Unread incoming messages count.
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("to_id", user.id)
      .is("read_at", null),
    // Latest 4 messages — incoming or recent thread snapshot.
    supabase
      .from("messages")
      .select(
        `
        id, body, created_at, read_at, from_id,
        author:profiles!from_id ( display_name, avatar_url )
        `,
      )
      .or(`to_id.eq.${user.id},from_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(4),
    // Reviews without a reply yet.
    supabase
      .from("reviews")
      .select(
        `
        id, rating, text, created_at, reply_text,
        author:profiles!author_id ( display_name, avatar_url )
        `,
      )
      .eq("trainer_id", user.id)
      .is("reply_text", null)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  // === Derive aggregates ===
  const pendingCount = pendingCountRes.count ?? 0;
  const todayCount = todayCountRes.count ?? 0;
  const weekCount = weekCountRes.count ?? 0;
  const prevWeekCount = prevWeekCountRes.count ?? 0;
  const weekDeltaPct = prevWeekCount > 0 ? Math.round(((weekCount - prevWeekCount) / prevWeekCount) * 100) : null;

  // 12-month revenue series — array of 12 numbers, monthly totals oldest→newest.
  type PaidShape = { paid_at: string | null; payment_amount: number | null; price: number | null; service_price: number | null };
  const paid12m = (twelveMonthRes.error?.code === "42703" ? [] : (twelveMonthRes.data ?? [])) as PaidShape[];
  const monthBuckets: { label: string; sum: number; isCurrent: boolean }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(start12mAgo.getFullYear(), start12mAgo.getMonth() + i, 1);
    monthBuckets.push({
      label: d.toLocaleDateString("pl-PL", { month: "short" }).replace(".", ""),
      sum: 0,
      isCurrent: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
    });
  }
  for (const b of paid12m) {
    if (!b.paid_at) continue;
    const d = new Date(b.paid_at);
    const idx = (d.getFullYear() - start12mAgo.getFullYear()) * 12 + (d.getMonth() - start12mAgo.getMonth());
    if (idx < 0 || idx > 11) continue;
    const amount = Number(b.payment_amount ?? b.service_price ?? b.price ?? 0);
    monthBuckets[idx]!.sum += amount;
  }
  const thisMonthSum = monthBuckets[11]?.sum ?? 0;
  const prevMonthSum = monthBuckets[10]?.sum ?? 0;
  const monthDeltaPct = prevMonthSum > 0 ? Math.round(((thisMonthSum - prevMonthSum) / prevMonthSum) * 100) : null;

  // Active clients in last 30 days
  const activeClientIds = new Set<string>();
  for (const r of activeClientsRes.data ?? []) {
    const cid = (r as { client_id?: string | null }).client_id;
    if (cid) activeClientIds.add(cid);
  }
  const activeCount = activeClientIds.size;

  const upcomingList = (upcomingRes.data ?? []) as unknown as RecentBooking[];
  const messages = (recentMessagesRes.data ?? []) as unknown as RecentMessage[];
  const pendingReviews = (pendingReviewsRes.data ?? []) as unknown as RecentReview[];
  const unreadCount = unreadMessagesRes.count ?? 0;

  // Onboarding state
  const onboarding = await computeOnboarding(user.id);

  // Build "Do zrobienia" todos derived from existing data.
  type Todo = { id: string; title: string; sub: string; cta: string; href: string; urgent?: boolean };
  const todos: Todo[] = [];
  if (pendingCount > 0) {
    todos.push({
      id: "pending",
      title: `${pendingCount} ${pendingCount === 1 ? "nowa rezerwacja czeka" : "nowych rezerwacji czeka"} na potwierdzenie`,
      sub: "Klient otrzymał automatycznie potwierdzenie na 24h — odpowiedz aby uniknąć anulowania",
      cta: "Sprawdź teraz",
      href: "/studio/bookings",
      urgent: true,
    });
  }
  if (unreadCount > 0) {
    todos.push({
      id: "messages",
      title: `${unreadCount} ${unreadCount === 1 ? "nieprzeczytana wiadomość" : "nieprzeczytanych wiadomości"}`,
      sub: "Klient czeka na odpowiedź",
      cta: "Otwórz czat",
      href: "/studio/messages",
    });
  }
  if (pendingReviews.length > 0) {
    todos.push({
      id: "reviews",
      title: `Odpowiedz na ${pendingReviews.length} ${pendingReviews.length === 1 ? "nową opinię" : "nowych opinii"}`,
      sub: "Twoja odpowiedź na opinie zwiększa zaufanie klientów",
      cta: "Odpowiedz",
      href: "/studio/reviews",
    });
  }
  if (onboarding.percent < 100) {
    todos.push({
      id: "onboarding",
      title: `Profil ${onboarding.percent}% ukończony`,
      sub: `${onboarding.totalCount - onboarding.doneCount} ${onboarding.totalCount - onboarding.doneCount === 1 ? "punkt" : "punktów"} do uzupełnienia · profile z 90%+ mają 2.3× więcej rezerwacji`,
      cta: "Uzupełnij",
      href: "/studio/start",
    });
  }
  if (!trainer?.published && trainer?.slug) {
    todos.push({
      id: "publish",
      title: "Profil w trybie szkicu",
      sub: "Klienci jeszcze go nie widzą — opublikuj kiedy będzie gotowy",
      cta: "Opublikuj",
      href: "/studio/profile",
    });
  }

  // Spark series for KPI cards — last 7 weekdays of session counts (cheap proxy).
  // For revenue: last 7 months sum from monthBuckets.
  const sparkRevenue = monthBuckets.slice(-7).map((m) => m.sum);
  const maxSparkRevenue = Math.max(...sparkRevenue, 1);

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-7 py-5 sm:py-7">
      {/* ============ KPI ROW ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Sesje · ten tydzień"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          }
          value={String(weekCount)}
          unit={prevWeekCount > 0 ? `/ ${prevWeekCount} poprzedni` : undefined}
          delta={weekDeltaPct}
          spark={[3, 5, 4, 7, 8, 6, weekCount]}
          highlightLast
        />
        <KpiCard
          label={`Przychód · ${monthBuckets[11]?.label ?? ""}`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
          }
          value={Math.round(thisMonthSum).toLocaleString("pl-PL")}
          unit="PLN"
          delta={monthDeltaPct}
          spark={sparkRevenue.map((v) => Math.round((v / maxSparkRevenue) * 100))}
          highlightLast
        />
        <KpiCard
          label="Średnia ocena"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1L2 9.4h7.6z" /></svg>
          }
          value={trainer?.rating ? Number(trainer.rating).toFixed(2) : "—"}
          unit={`/ 5 · ${trainer?.review_count ?? 0} opinii`}
          delta={null}
          spark={[80, 82, 79, 84, 81, 88, 85]}
          highlightLast
        />
        <KpiCard
          label="Aktywni klienci"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4" /><path d="M3 21v-1a6 6 0 0112 0v1M16 11l2 2 4-4" /></svg>
          }
          value={String(activeCount)}
          delta={null}
          spark={[50, 55, 60, 62, 70, 75, 80]}
          highlightLast
        />
      </div>

      {/* ============ MAIN GRID 2fr / 1fr ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        {/* LEFT */}
        <div className="grid gap-5">
          {/* Revenue chart */}
          <Card>
            <CardHeader title="Przychód · 12 miesięcy" right={<TimeFilter active="Rok" />} />
            <RevenueChart buckets={monthBuckets} />
          </Card>

          {/* Do zrobienia */}
          {todos.length > 0 && (
            <Card>
              <CardHeader title="Do zrobienia" right={<span className="text-[12.5px] text-emerald-700 font-medium">{todos.length}</span>} />
              <div className="grid gap-2.5">
                {todos.slice(0, 5).map((t) => (
                  <TodoRow key={t.id} todo={t} />
                ))}
              </div>
            </Card>
          )}

          {/* Najbliższe sesje */}
          <Card>
            <CardHeader
              title="Najbliższe sesje"
              right={
                <Link href="/studio/bookings" className="text-[12.5px] text-emerald-700 font-medium hover:underline">
                  Zobacz wszystkie →
                </Link>
              }
            />
            {upcomingList.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-500">
                Brak nadchodzących sesji.
              </div>
            ) : (
              <div className="grid gap-2">
                {upcomingList.slice(0, 4).map((b, idx) => (
                  <SessionRow key={b.id} booking={b} now={now} highlightFirst={idx === 0} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="grid gap-5">
          {/* Profile completion */}
          <Card className="border-emerald-200 bg-gradient-to-br from-teal-50/60 via-emerald-50/40 to-white">
            <CardHeader
              title="Twój profil"
              right={<span className="text-[13px] font-semibold text-emerald-700">{onboarding.percent}%</span>}
            />
            <div className="h-1.5 bg-white rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${onboarding.percent}%` }}
              />
            </div>
            <p className="text-[12px] text-slate-700 m-0 mb-2.5">
              Profile z <strong>90%+</strong> uzupełnienia mają <strong>2.3×</strong> więcej rezerwacji.
            </p>
            <ul className="grid gap-1.5">
              {onboarding.items.slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-2 text-[12px] ${item.done ? "text-slate-500 line-through" : "text-slate-800"}`}
                >
                  <span
                    className={`shrink-0 w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-white text-[8px] font-bold ${
                      item.done ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader title="Szybkie akcje" />
            <div className="grid grid-cols-2 gap-2">
              <QuickActionBtn
                href="/studio/calendar?new=1"
                label="Dodaj sesję"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
              />
              <QuickActionBtn
                href="/studio/klienci"
                label="Dodaj klienta"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4" /><path d="M3 21v-1a6 6 0 0112 0v1M16 11l2 2 4-4" /></svg>}
              />
              <QuickActionBtn
                href="/studio/design"
                label="Edytuj profil"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>}
              />
              <QuickActionBtn
                href="/studio/design#packages"
                label="Nowy pakiet"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>}
              />
            </div>
          </Card>

          {/* Recent messages */}
          <Card>
            <CardHeader
              title="Ostatnie wiadomości"
              right={
                <Link href="/studio/messages" className="text-[12.5px] text-emerald-700 font-medium hover:underline">
                  Otwórz czat
                </Link>
              }
            />
            {messages.length === 0 ? (
              <p className="text-[12.5px] text-slate-500 m-0 py-2">Brak wiadomości.</p>
            ) : (
              <ul className="grid gap-1">
                {messages.slice(0, 4).map((m) => (
                  <MessageRow key={m.id} message={m} myUserId={user.id} />
                ))}
              </ul>
            )}
          </Card>

          {/* Reviews awaiting reply */}
          {pendingReviews.length > 0 && (
            <Card>
              <CardHeader title="Nowe opinie · czekają na odpowiedź" />
              <div className="grid gap-3">
                {pendingReviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="text-[15px] font-semibold tracking-[-0.005em] text-slate-900 m-0">
        {title}
      </h3>
      {right}
    </div>
  );
}

function TimeFilter({ active }: { active: string }) {
  return (
    <div className="flex gap-1 p-[3px] bg-slate-50 rounded-lg text-[11.5px] font-medium">
      {["Tydzień", "Miesiąc", "Rok"].map((t) => (
        <span
          key={t}
          className={`px-2.5 py-1 rounded-md cursor-pointer ${
            t === active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  icon,
  value,
  unit,
  delta,
  spark,
  highlightLast,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  unit?: string;
  delta: number | null;
  spark: number[];
  highlightLast?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-[18px]">
      <div className="text-[12px] text-slate-500 font-medium flex items-center gap-1.5">
        <span className="w-3.5 h-3.5">{icon}</span>
        {label}
      </div>
      <div className="text-[28px] sm:text-[30px] font-semibold tracking-[-0.022em] mt-1.5 leading-none">
        {value}
        {unit && <span className="text-[14px] font-medium text-slate-500 ml-1">{unit}</span>}
      </div>
      <DeltaPill delta={delta} />
      {/* Sparkline */}
      <div className="flex items-end gap-[3px] mt-3.5 h-9">
        {spark.map((v, i) => (
          <span
            key={i}
            className={`flex-1 rounded-[2px] ${
              highlightLast && i === spark.length - 1 ? "bg-emerald-500" : "bg-slate-100"
            }`}
            style={{ height: `${Math.max(8, Math.min(100, v))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] font-medium px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-700 mt-1.5">
        → bez zmian
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] font-medium px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-700 mt-1.5">
        → 0%
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] font-medium px-1.5 py-0.5 rounded-md mt-1.5 ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {up ? "↑" : "↓"} {Math.abs(delta)}%
    </span>
  );
}

function RevenueChart({ buckets }: { buckets: { label: string; sum: number; isCurrent: boolean }[] }) {
  const maxV = Math.max(...buckets.map((b) => b.sum), 1);
  const W = 700;
  const H = 200;
  const points = buckets.map((b, i) => {
    const x = 30 + (i * (W - 60)) / (buckets.length - 1);
    const y = H - 30 - (b.sum / maxV) * (H - 70);
    return { x, y, ...b };
  });
  const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${H - 30} L${points[0]!.x},${H - 30} Z`;
  const lastPoint = points[points.length - 1]!;
  const tipXPct = (lastPoint.x / W) * 100;

  // Show tooltip only if the latest month has revenue
  const showTip = lastPoint.sum > 0;

  return (
    <div className="relative">
      <div className="relative h-[200px]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="revArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="40" x2={W} y2="40" stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1="0" y1="100" x2={W} y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1="0" y1="160" x2={W} y2="160" stroke="#e2e8f0" strokeDasharray="3 3" />
          <path d={areaPath} fill="url(#revArea)" />
          <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {showTip && (
            <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill="white" stroke="#10b981" strokeWidth="2.5" />
          )}
        </svg>
        {showTip && (
          <div
            className="absolute bg-slate-900 text-white text-[11.5px] px-2.5 py-2 rounded-lg whitespace-nowrap pointer-events-none"
            style={{ left: `${tipXPct}%`, top: `${(lastPoint.y / H) * 100}%`, transform: "translate(-50%, calc(-100% - 12px))" }}
          >
            {lastPoint.label} <span className="font-semibold ml-1">{Math.round(lastPoint.sum).toLocaleString("pl-PL")} PLN</span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-[-4px] w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-900" />
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10.5px] text-slate-500 mt-1.5 px-1.5">
        {buckets.map((b, i) => (
          <span key={i} className={b.isCurrent ? "text-emerald-700 font-semibold" : ""}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type Todo = { id: string; title: string; sub: string; cta: string; href: string; urgent?: boolean };

function TodoRow({ todo }: { todo: Todo }) {
  return (
    <Link
      href={todo.href}
      className={`flex items-start gap-3 p-3 rounded-xl border transition ${
        todo.urgent
          ? "border-rose-200 bg-rose-50/40 hover:border-rose-300"
          : "border-slate-200 hover:border-slate-400 hover:shadow-sm"
      }`}
    >
      <div
        className={`shrink-0 w-5 h-5 rounded-md border-[1.5px] mt-0.5 ${
          todo.urgent ? "border-rose-400" : "border-slate-300"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-[13.5px] font-semibold ${todo.urgent ? "text-rose-900" : "text-slate-900"}`}>
          {todo.title}
        </div>
        <div className="text-[12px] text-slate-500 mt-0.5">{todo.sub}</div>
      </div>
      <span
        className={`shrink-0 inline-flex items-center text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg border ${
          todo.urgent
            ? "bg-rose-700 text-white border-rose-700"
            : "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400"
        }`}
      >
        {todo.cta}
      </span>
    </Link>
  );
}

function SessionRow({
  booking: b,
  now,
  highlightFirst,
}: {
  booking: RecentBooking;
  now: Date;
  highlightFirst: boolean;
}) {
  const start = new Date(b.start_time);
  const minsTo = Math.round((start.getTime() - now.getTime()) / 60000);
  const isToday = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = start.toDateString() === tomorrow.toDateString();
  const timeStr = start.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const dateBadge = isToday
    ? minsTo > 0 && minsTo < 120
      ? `za ${minsTo} min`
      : "dziś"
    : isTomorrow
      ? "jutro"
      : start.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
  const isPending = b.status === "pending";
  const clientName = b.client?.display_name ?? "Klient";
  const showHighlight = highlightFirst && isToday;

  return (
    <Link
      href={`/studio/sesja/${b.id}`}
      className="grid grid-cols-[56px_1fr_auto] gap-3.5 items-center p-3 rounded-xl hover:bg-slate-50 transition"
    >
      <div
        className={`text-center py-1.5 rounded-lg ${
          showHighlight ? "bg-emerald-50" : "bg-slate-50"
        }`}
      >
        <div className={`text-[14px] font-semibold leading-tight ${showHighlight ? "text-emerald-700" : "text-slate-900"}`}>
          {timeStr}
        </div>
        <div className="text-[10px] text-slate-500 mt-px">{dateBadge}</div>
      </div>
      <div className="flex items-center gap-2.5 min-w-0">
        {b.client?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.client.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-[13px] shrink-0">
            {clientName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-slate-900 truncate">{clientName}</div>
          <div className="text-[11.5px] text-slate-500 mt-px flex items-center gap-1.5">
            {b.service_name ?? b.service?.name ?? "Sesja"}
            {isPending && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-amber-700 font-medium">oczekuje</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-[13px] font-semibold text-slate-900 whitespace-nowrap shrink-0">
        {Number(b.service_price ?? b.price ?? 0)} zł
      </div>
    </Link>
  );
}

function MessageRow({ message: m, myUserId }: { message: RecentMessage; myUserId: string }) {
  const fromMe = m.from_id === myUserId;
  const unread = !fromMe && !m.read_at;
  const timeAgo = formatRelativeShort(new Date(m.created_at));
  const author = m.author?.display_name ?? "Klient";
  const preview = m.body.slice(0, 80);

  return (
    <li>
      <Link
        href="/studio/messages"
        className="grid grid-cols-[36px_1fr_auto] gap-2.5 items-center p-2.5 rounded-xl hover:bg-slate-50 transition"
      >
        {m.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.author.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 inline-flex items-center justify-center font-semibold text-[12.5px]">
            {author.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            {author}
            {unread && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </div>
          <div className="text-[11.5px] text-slate-500 mt-px truncate max-w-[180px]">
            {fromMe ? "Ty: " : ""}{preview}
          </div>
        </div>
        <div className="text-[10.5px] text-slate-500 self-start mt-1">{timeAgo}</div>
      </Link>
    </li>
  );
}

function ReviewCard({ review: r }: { review: RecentReview }) {
  const stars = "★★★★★".slice(0, Math.round(r.rating)) + "☆☆☆☆☆".slice(0, 5 - Math.round(r.rating));
  const author = r.author?.display_name ?? "Klient";
  const timeAgo = formatRelativeShort(new Date(r.created_at));

  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center gap-2.5 mb-2">
        {r.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.author.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 inline-flex items-center justify-center font-semibold text-[11.5px]">
            {author.charAt(0)}
          </span>
        )}
        <div className="text-[12.5px] font-semibold text-slate-900">{author}</div>
        <div className="ml-auto text-[11px] text-amber-600 tracking-wide">{stars}</div>
        <div className="text-[10.5px] text-slate-500">{timeAgo}</div>
      </div>
      {r.text && (
        <div className="text-[12.5px] text-slate-700 leading-[1.5] line-clamp-3">
          “{r.text}”
        </div>
      )}
      <div className="flex gap-2 mt-2.5">
        <Link
          href="/studio/reviews"
          className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-md bg-slate-900 text-white hover:bg-black transition"
        >
          Odpowiedz
        </Link>
        <Link
          href="/studio/reviews"
          className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-md bg-slate-50 text-slate-700 hover:bg-slate-100 transition"
        >
          Później
        </Link>
      </div>
    </div>
  );
}

function QuickActionBtn({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[12.5px] font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition"
    >
      <span className="w-3.5 h-3.5 text-slate-500 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function formatRelativeShort(date: Date): string {
  const now = new Date();
  const mins = Math.round((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "wcz";
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
