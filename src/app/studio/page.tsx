import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type RecentBooking = {
  id: string;
  start_time: string;
  status: string;
  price: number;
  // Snapshot field preferred over JOIN (migration 018).
  service_name: string | null;
  service: { name: string } | null;
  client: { display_name: string; avatar_url: string | null } | null;
};

export default async function StudioHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
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
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { count: pendingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", user.id)
    .eq("status", "pending");

  // Pending reschedule requests where I'm the OTHER party (i.e. proposed by the client).
  // Done in two steps: count proposals where requested_by != me but the booking is mine.
  // Postgrest can't filter on a joined column, so we pull pending request booking_ids and intersect.
  const { data: myBookingIds } = await supabase
    .from("bookings")
    .select("id")
    .eq("trainer_id", user.id);
  const bookingIdSet = new Set((myBookingIds ?? []).map((r) => r.id as string));
  const { data: pendingResRows } = await supabase
    .from("reschedule_requests")
    .select("booking_id, requested_by")
    .eq("status", "pending");
  const pendingReschedulesNeedingMe = (pendingResRows ?? []).filter(
    (r) => bookingIdSet.has(r.booking_id as string) && r.requested_by !== user.id,
  ).length;

  const { count: todayCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", user.id)
    .in("status", ["confirmed", "paid"])
    .gte("start_time", startOfToday.toISOString())
    .lte("start_time", endOfToday.toISOString());

  const { count: weekCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", user.id)
    .in("status", ["confirmed", "paid", "completed"])
    .gte("start_time", sevenDaysAgo.toISOString());

  const { data: weekBookings } = await supabase
    .from("bookings")
    .select("price")
    .eq("trainer_id", user.id)
    .in("status", ["completed", "paid"])
    .gte("start_time", sevenDaysAgo.toISOString());
  const weekEarnings = (weekBookings ?? []).reduce((s, b) => s + b.price, 0);

  const { data: upcoming } = await supabase
    .from("bookings")
    .select(`
      id, start_time, status, price,
      service_name,
      service:services ( name ),
      client:profiles!client_id ( display_name, avatar_url )
    `)
    .eq("trainer_id", user.id)
    .in("status", ["confirmed", "paid", "pending"])
    .gte("start_time", now.toISOString())
    .order("start_time", { ascending: true })
    .limit(5);
  const upcomingList = (upcoming ?? []) as unknown as RecentBooking[];

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
      <header className="mb-8">
        <p className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
          {greeting()} 👋
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
          {profile?.display_name ?? ""}
        </h1>
        {!trainer?.published && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 inline-flex items-start gap-3">
            <span>⚠</span>
            <div>
              <strong className="font-semibold">Profil w trybie szkicu.</strong> Klienci jeszcze go nie widzą.
              Włącz „Opublikowany" w{" "}
              <Link href="/studio/profile" className="underline font-medium">Mój profil</Link>.
            </div>
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Stat label="Dziś" value={todayCount ?? 0} hint="zaplanowane sesje" tone="emerald" />
        <Stat label="Czeka na potwierdzenie" value={pendingCount ?? 0} tone="amber" />
        <Stat label="Sesje w tym tygodniu" value={weekCount ?? 0} tone="slate" />
        <Stat label="Zarobek tygodnia" value={`${weekEarnings} zł`} tone="slate" />
      </section>

      {pendingReschedulesNeedingMe > 0 && (
        <Link
          href="/studio/messages"
          className="block mb-8 px-5 py-3.5 rounded-[12px] border border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400 transition"
        >
          <strong className="font-semibold">{pendingReschedulesNeedingMe}</strong>{" "}
          {pendingReschedulesNeedingMe === 1 ? "klient czeka" : "klientów czeka"} na Twoją odpowiedź w sprawie zmiany terminu →
        </Link>
      )}

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Najbliższe sesje</h2>
          <Link href="/studio/bookings" className="text-[13px] text-emerald-700 font-medium hover:underline">
            Zobacz wszystkie →
          </Link>
        </div>
        {upcomingList.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 py-10 text-center text-slate-500">
            Brak nadchodzących sesji.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {upcomingList.map((b) => (
              <UpcomingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Szybkie akcje</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <QuickLink href="/studio/design"       icon="🎨" label="Edytuj profil" />
          <QuickLink href="/studio/bookings"     icon="📅" label="Rezerwacje" />
          <QuickLink href="/studio/messages"     icon="💬" label="Wiadomości" />
          {trainer?.slug && (
            <QuickLink href={`/trainers/${trainer.slug}`} icon="🌐" label="Strona publiczna" external />
          )}
        </div>
      </section>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Dzień dobry";
  if (h < 18) return "Witaj";
  return "Dobry wieczór";
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone: "emerald" | "amber" | "slate";
}) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`text-3xl font-semibold tracking-tight ${color}`}>{value}</div>
      <div className="text-[13px] text-slate-700 mt-1.5 font-medium">{label}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function UpcomingRow({ booking: b }: { booking: RecentBooking }) {
  const dateStr = new Date(b.start_time).toLocaleDateString("pl-PL", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Warsaw",
  });
  const timeStr = new Date(b.start_time).toLocaleTimeString("pl-PL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
  });
  const clientName = b.client?.display_name ?? "Klient";
  const isPending = b.status === "pending";
  return (
    <Link
      href="/studio/bookings"
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:border-emerald-400 hover:shadow-sm transition"
    >
      {b.client?.avatar_url ? (
        <img src={b.client.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
          {clientName.charAt(0)}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[14px]">
          <strong className="text-slate-900">{clientName}</strong>
          {isPending && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
              Oczekuje
            </span>
          )}
        </div>
        <div className="text-[12px] text-slate-500">
          {b.service_name ?? b.service?.name ?? "Sesja"} · {dateStr}, {timeStr}
        </div>
      </div>
      <div className="text-[14px] font-semibold text-slate-900 whitespace-nowrap">
        {b.price} zł
      </div>
    </Link>
  );
}

function QuickLink({
  href,
  icon,
  label,
  external = false,
}: {
  href: string;
  icon: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 hover:border-emerald-400 hover:shadow-sm transition"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[14px] font-medium text-slate-800 flex-1">{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
