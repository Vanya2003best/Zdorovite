import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptReschedule, declineReschedule } from "@/lib/actions/reschedule";
import {
  cancelAsTrainer,
  confirmBooking,
  markCompleted,
  markNoShow,
} from "./actions";

/**
 * Skrzynka działań — the trainer's morning "what needs your attention" feed.
 * Replaces the old bookings list (calendar view at /studio/calendar already
 * shows the same data spatially). Surfaces only items that need the trainer
 * to ACT, in priority order:
 *   1. Pending booking requests (Potwierdź / Odrzuć)
 *   2. Reschedule requests from clients (Akceptuj / Odrzuć)
 *   3. Past sessions waiting for finalisation (Zakończona / Nieobecność)
 *   4. Tomorrow's sessions with client notes (info, no action needed)
 *
 * If everything is handled, shows a clean empty state.
 */

const POL_DAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
const POL_MONTHS_GEN = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

type BookingRow = {
  id: string;
  client_id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  note: string | null;
  service_name: string | null;
  package_name: string | null;
  service: { name: string } | null;
  package: { name: string } | null;
  client: { display_name: string | null; avatar_url: string | null } | null;
};

type RescheduleRow = {
  id: string;
  booking_id: string;
  requested_by: string;
  proposed_start: string;
  proposed_end: string;
  reason: string | null;
  created_at: string;
  booking: {
    start_time: string;
    client_id: string;
    service_name: string | null;
    package_name: string | null;
    service: { name: string } | null;
    package: { name: string } | null;
    client: { display_name: string | null; avatar_url: string | null } | null;
  } | null;
};

function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  return `${POL_DAYS[d.getDay()]}, ${d.getDate()} ${POL_MONTHS_GEN[d.getMonth()]}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isTomorrow(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export default async function StudioInboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/bookings");

  const trainerId = user.id;
  const nowIso = new Date().toISOString();
  const tomorrowEnd = new Date();
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);
  tomorrowEnd.setHours(0, 0, 0, 0);
  const dayAfterIso = tomorrowEnd.toISOString();

  const [
    { data: pendingRows },
    { data: pastRows },
    { data: tomorrowRows },
    { data: reschedRows },
  ] = await Promise.all([
    // 1. Pending confirmation
    supabase
      .from("bookings")
      .select(`
        id, client_id, start_time, end_time, status, price, note,
        service_name, package_name,
        service:services ( name ),
        package:packages ( name ),
        client:profiles!client_id ( display_name, avatar_url )
      `)
      .eq("trainer_id", trainerId)
      .eq("status", "pending")
      .order("start_time", { ascending: true }),
    // 2. Past sessions awaiting finalisation
    supabase
      .from("bookings")
      .select(`
        id, client_id, start_time, end_time, status, price, note,
        service_name, package_name,
        service:services ( name ),
        package:packages ( name ),
        client:profiles!client_id ( display_name, avatar_url )
      `)
      .eq("trainer_id", trainerId)
      .in("status", ["paid", "confirmed"])
      .lt("end_time", nowIso)
      .order("end_time", { ascending: false })
      .limit(20),
    // 3. Tomorrow's sessions with notes (information panel)
    supabase
      .from("bookings")
      .select(`
        id, client_id, start_time, end_time, status, price, note,
        service_name, package_name,
        service:services ( name ),
        package:packages ( name ),
        client:profiles!client_id ( display_name, avatar_url )
      `)
      .eq("trainer_id", trainerId)
      .in("status", ["paid", "confirmed", "pending"])
      .gte("start_time", nowIso)
      .lt("start_time", dayAfterIso)
      .order("start_time", { ascending: true }),
    // 4. Reschedule requests from clients
    supabase
      .from("reschedule_requests")
      .select(`
        id, booking_id, requested_by, proposed_start, proposed_end, reason, created_at,
        booking:bookings!booking_id (
          start_time, client_id, service_name, package_name,
          service:services ( name ),
          package:packages ( name ),
          client:profiles!client_id ( display_name, avatar_url )
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const pending = (pendingRows ?? []) as unknown as BookingRow[];
  const past = (pastRows ?? []) as unknown as BookingRow[];
  const tomorrow = ((tomorrowRows ?? []) as unknown as BookingRow[]).filter((b) =>
    isTomorrow(b.start_time) && (b.note?.trim().length ?? 0) > 0,
  );
  // Filter reschedule requests: only ones requested BY the client (not by us
  // as the trainer — those are awaiting client decision, not ours), and only
  // ones whose underlying booking belongs to this trainer.
  const reschedules = ((reschedRows ?? []) as unknown as RescheduleRow[]).filter(
    (r) => r.booking != null && r.requested_by !== trainerId,
  );

  const totalActions = pending.length + reschedules.length + past.length;
  const hasInfo = tomorrow.length > 0;

  return (
    <div className="mx-auto max-w-[860px] px-4 sm:px-8 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-slate-900 m-0">
          Skrzynka działań
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">
          {totalActions === 0
            ? "Wszystko zrobione 👌"
            : `${totalActions} ${totalActions === 1 ? "rzecz wymaga" : totalActions < 5 ? "rzeczy wymagają" : "rzeczy wymaga"} Twojej uwagi.`}
        </p>
      </header>

      {/* 1. PENDING ───────────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <Section
          title="Czeka na potwierdzenie"
          tone="amber"
          count={pending.length}
        >
          {pending.map((b) => (
            <ActionCard
              key={b.id}
              client={b.client}
              title={b.service_name ?? b.service?.name ?? b.package_name ?? b.package?.name ?? "Sesja"}
              subtitle={`${fmtDateLong(b.start_time)}, ${fmtTime(b.start_time)}`}
              note={b.note}
              price={b.price}
              actions={
                <>
                  <ServerButton action={confirmBooking} bookingId={b.id} variant="primary">
                    Potwierdź
                  </ServerButton>
                  <ServerButton action={cancelAsTrainer} bookingId={b.id} variant="ghost">
                    Odrzuć
                  </ServerButton>
                </>
              }
            />
          ))}
        </Section>
      )}

      {/* 2. RESCHEDULE REQUESTS ──────────────────────────────────────── */}
      {reschedules.length > 0 && (
        <Section
          title="Klient prosi o zmianę terminu"
          tone="blue"
          count={reschedules.length}
        >
          {reschedules.map((r) => {
            const booking = r.booking!;
            const oldLabel = `${fmtDateLong(booking.start_time)}, ${fmtTime(booking.start_time)}`;
            const newLabel = `${fmtDateLong(r.proposed_start)}, ${fmtTime(r.proposed_start)}`;
            return (
              <ActionCard
                key={r.id}
                client={booking.client}
                title={booking.service_name ?? booking.service?.name ?? booking.package_name ?? booking.package?.name ?? "Sesja"}
                subtitle={
                  <span>
                    <span className="line-through text-slate-400">{oldLabel}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="font-medium text-slate-900">{newLabel}</span>
                  </span>
                }
                note={r.reason}
                actions={
                  <>
                    <ServerButton actionRaw={acceptReschedule.bind(null, r.id)} variant="primary">
                      Akceptuj zmianę
                    </ServerButton>
                    <ServerButton actionRaw={declineReschedule.bind(null, r.id)} variant="ghost">
                      Odrzuć
                    </ServerButton>
                    <Link
                      href={`/studio/messages?with=${booking.client_id}`}
                      className="h-9 inline-flex items-center px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-400 transition"
                    >
                      Napisz
                    </Link>
                  </>
                }
              />
            );
          })}
        </Section>
      )}

      {/* 3. PAST — finalize ──────────────────────────────────────────── */}
      {past.length > 0 && (
        <Section
          title="Sesje do oznaczenia"
          tone="slate"
          count={past.length}
        >
          {past.map((b) => (
            <ActionCard
              key={b.id}
              client={b.client}
              title={b.service_name ?? b.service?.name ?? b.package_name ?? b.package?.name ?? "Sesja"}
              subtitle={`${fmtDateLong(b.start_time)}, ${fmtTime(b.start_time)}`}
              note={b.note}
              price={b.price}
              actions={
                <>
                  <ServerButton action={markCompleted} bookingId={b.id} variant="primary">
                    Zakończona
                  </ServerButton>
                  <ServerButton action={markNoShow} bookingId={b.id} variant="ghost">
                    Nieobecność
                  </ServerButton>
                </>
              }
            />
          ))}
        </Section>
      )}

      {/* 4. TOMORROW — info ─────────────────────────────────────────── */}
      {hasInfo && (
        <Section
          title="Jutrzejsze sesje z notatkami"
          tone="emerald"
          count={tomorrow.length}
          subtitle="Klienci dodali kontekst — przejrzyj przed treningiem."
        >
          {tomorrow.map((b) => (
            <InfoCard
              key={b.id}
              client={b.client}
              title={b.service_name ?? b.service?.name ?? b.package_name ?? b.package?.name ?? "Sesja"}
              time={fmtTime(b.start_time)}
              note={b.note ?? ""}
            />
          ))}
        </Section>
      )}

      {/* EMPTY STATE ────────────────────────────────────────────────── */}
      {totalActions === 0 && !hasInfo && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center bg-white">
          <div className="text-3xl mb-3">✓</div>
          <p className="text-[15px] font-medium text-slate-700">Skrzynka pusta</p>
          <p className="text-[13px] text-slate-500 mt-1.5">
            Brak rzeczy oczekujących na Twoją reakcję.
          </p>
          <Link
            href="/studio/calendar"
            className="inline-flex mt-5 h-9 items-center px-4 rounded-lg bg-slate-900 text-white text-[13px] font-medium hover:bg-black transition"
          >
            Otwórz kalendarz →
          </Link>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function Section({
  title,
  tone,
  count,
  subtitle,
  children,
}: {
  title: string;
  tone: "amber" | "blue" | "slate" | "emerald";
  count: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const dot = {
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    slate: "bg-slate-400",
    emerald: "bg-emerald-500",
  }[tone];
  return (
    <section className="mb-7">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-slate-900 m-0">
          {title}
        </h2>
        <span className="text-[11.5px] text-slate-500 font-medium">{count}</span>
      </div>
      {subtitle && (
        <p className="text-[12px] text-slate-500 mb-2.5 -mt-1.5 ml-[18px]">{subtitle}</p>
      )}
      <div className="grid gap-2.5">{children}</div>
    </section>
  );
}

function ActionCard({
  client,
  title,
  subtitle,
  note,
  price,
  actions,
}: {
  client: { display_name: string | null; avatar_url: string | null } | null;
  title: string;
  subtitle: React.ReactNode;
  note: string | null;
  price?: number;
  actions: React.ReactNode;
}) {
  const name = client?.display_name ?? "Klient";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      {client?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={client.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold text-slate-900 truncate">{name}</div>
        <div className="text-[13px] text-slate-700 mt-0.5">{title}</div>
        <div className="text-[12.5px] text-slate-500 mt-0.5">{subtitle}</div>
        {note && (
          <div className="text-[12.5px] text-slate-600 mt-2.5 bg-slate-50 rounded-lg px-3 py-2 italic leading-relaxed">
            „{note}"
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3">{actions}</div>
      </div>
      {typeof price === "number" && price > 0 && (
        <div className="text-[14px] font-semibold text-slate-900 whitespace-nowrap tabular-nums">
          {price} zł
        </div>
      )}
    </div>
  );
}

function InfoCard({
  client,
  title,
  time,
  note,
}: {
  client: { display_name: string | null; avatar_url: string | null } | null;
  title: string;
  time: string;
  note: string;
}) {
  const name = client?.display_name ?? "Klient";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/40 p-4 flex items-start gap-3.5">
      {client?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={client.avatar_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0 text-[12px]">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-slate-900">{name}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{title}</span>
          <span className="ml-auto text-[12px] tabular-nums font-medium text-emerald-700">{time}</span>
        </div>
        <div className="text-[12.5px] text-slate-700 mt-1 italic">„{note}"</div>
      </div>
    </div>
  );
}

/** Wraps server actions as small forms so the button styles stay in one place.
 *  `action`: bookingId-style action that needs a hidden booking_id input.
 *  `actionRaw`: bound server action (no inputs needed). */
function ServerButton({
  action,
  actionRaw,
  bookingId,
  variant,
  children,
}: {
  action?: (formData: FormData) => Promise<unknown>;
  actionRaw?: () => Promise<unknown>;
  bookingId?: string;
  variant: "primary" | "ghost";
  children: React.ReactNode;
}) {
  const cls =
    variant === "primary"
      ? "h-9 px-3.5 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition"
      : "h-9 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-slate-400 transition";
  if (actionRaw) {
    return (
      <form action={async () => { await actionRaw(); }}>
        <button type="submit" className={cls}>{children}</button>
      </form>
    );
  }
  return (
    <form action={async (fd) => { await action!(fd); }}>
      {bookingId && <input type="hidden" name="booking_id" value={bookingId} />}
      <button type="submit" className={cls}>{children}</button>
    </form>
  );
}
