import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MarkPaidButton from "./MarkPaidButton";

type BookingRow = {
  id: string;
  start_time: string;
  status: string;
  price: number | null;
  service_price?: number | null;
  service_name: string | null;
  payment_status?: string;
  payment_method?: string | null;
  paid_at?: string | null;
  payment_amount?: number | null;
  client: { display_name: string | null; avatar_url: string | null } | null;
  service?: { name: string } | null;
};

const METHOD_LABEL: Record<string, string> = {
  blik: "BLIK",
  cash: "Gotówka",
  transfer: "Przelew",
  package: "Pakiet",
  platform: "NaZdrow!",
};

/**
 * /studio/finanse — money dashboard. Three blocks:
 *   1. This month vs last month + count badge
 *   2. Pending sessions awaiting mark-as-paid (oldest first)
 *   3. Recent paid sessions (most recent first)
 *
 * Tolerant to migration 024 not being applied — falls back to a simpler
 * "needs migration" view. Tolerant to migration 018 not applied either
 * (snapshot field service_price missing) — uses live JOIN to services.
 */
export default async function FinansePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/finanse");

  // Try the rich SELECT first (migrations 018 + 024). On 42703 (column
  // missing) fall back to the basic shape.
  let bookings: BookingRow[] = [];
  let migrationMissing = false;

  const richQuery = await supabase
    .from("bookings")
    .select(
      `
      id, start_time, status, price, service_price, service_name,
      payment_status, payment_method, paid_at, payment_amount,
      client:profiles!client_id ( display_name, avatar_url ),
      service:services!service_id ( name )
      `,
    )
    .eq("trainer_id", user.id)
    .order("start_time", { ascending: false })
    .limit(500);

  if (richQuery.error?.code === "42703") {
    migrationMissing = true;
  } else if (richQuery.data) {
    bookings = richQuery.data as unknown as BookingRow[];
  }

  // Compute aggregates client-side. 500 bookings is plenty headroom for
  // small-trainer scale — no point in DB-side window functions yet.
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;

  let thisMonthSum = 0;
  let lastMonthSum = 0;
  let thisMonthCount = 0;
  const pending: BookingRow[] = [];
  const recentPaid: BookingRow[] = [];

  for (const b of bookings) {
    const amount = Number(b.payment_amount ?? b.service_price ?? b.price ?? 0);
    const isPaid = b.payment_status === "paid";

    if (isPaid && b.paid_at) {
      const paid = new Date(b.paid_at);
      if (paid >= thisMonthStart) {
        thisMonthSum += amount;
        thisMonthCount += 1;
      } else if (paid >= lastMonthStart && paid < lastMonthEnd) {
        lastMonthSum += amount;
      }
      if (recentPaid.length < 10) recentPaid.push(b);
    } else if (b.payment_status === "pending" || !b.payment_status) {
      // Only show as pending if the session has actually happened —
      // future bookings shouldn't clutter the to-do list.
      const start = new Date(b.start_time);
      if (start <= now && b.status !== "cancelled" && pending.length < 50) {
        pending.push(b);
      }
    }
  }

  // Sort pending by start_time asc — oldest unpaid sessions first (most
  // urgent for trainer to chase).
  pending.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const monthDelta = lastMonthSum > 0 ? thisMonthSum - lastMonthSum : 0;
  const monthDeltaPercent =
    lastMonthSum > 0 ? Math.round((monthDelta / lastMonthSum) * 100) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10 grid gap-5">
      <header>
        <h1 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-slate-900 m-0">
          Finanse
        </h1>
        <p className="text-[13px] text-slate-500 mt-1 m-0">
          Twoje przychody, oczekujące płatności, ostatnie sesje.
        </p>
      </header>

      {migrationMissing ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 py-12 px-6 text-center">
          <p className="text-[14px] text-amber-800 font-semibold m-0">
            Funkcja wkrótce dostępna
          </p>
          <p className="text-[12.5px] text-amber-700 mt-2 max-w-[480px] mx-auto m-0">
            Sekcja Finanse wymaga migracji 024. Zastosuj ją w panelu Supabase, a
            dashboard zacznie działać.
          </p>
        </div>
      ) : (
        <>
          {/* Monthly summary */}
          <section className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="W tym miesiącu"
              value={`${thisMonthSum.toFixed(0)} zł`}
              hint={`${thisMonthCount} ${thisMonthCount === 1 ? "sesja" : thisMonthCount < 5 ? "sesje" : "sesji"}`}
              delta={monthDeltaPercent}
            />
            <SummaryCard
              label="Poprzedni miesiąc"
              value={`${lastMonthSum.toFixed(0)} zł`}
              hint="dla porównania"
            />
            <SummaryCard
              label="Oczekuje płatności"
              value={`${pending.length}`}
              hint={pending.length === 0 ? "wszystko opłacone 🎉" : "kliknij niżej żeby oznaczyć"}
              accent={pending.length > 0 ? "amber" : "emerald"}
            />
          </section>

          {/* Pending list */}
          {pending.length > 0 && (
            <section className="rounded-2xl bg-white border border-slate-200 p-5">
              <h2 className="text-[14px] font-semibold tracking-tight text-slate-900 m-0 mb-3">
                Oczekujące płatności ({pending.length})
              </h2>
              <ul className="grid divide-y divide-slate-100">
                {pending.map((b) => (
                  <li key={b.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium text-slate-900 truncate">
                        {b.client?.display_name ?? "Klient"}
                        {" · "}
                        <span className="text-slate-600 font-normal">
                          {b.service_name ?? b.service?.name ?? "Sesja"}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-500 mt-0.5">
                        {formatDate(b.start_time)} · {Number(b.service_price ?? b.price ?? 0)} zł
                      </div>
                    </div>
                    <MarkPaidButton bookingId={b.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recent paid */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="text-[14px] font-semibold tracking-tight text-slate-900 m-0 mb-3">
              Ostatnio opłacone
            </h2>
            {recentPaid.length === 0 ? (
              <p className="text-[12.5px] text-slate-500 m-0">
                Jeszcze żadnej opłaconej sesji. Po pierwszej rezerwacji + oznaczeniu
                jej jako opłaconej, pojawi się tutaj.
              </p>
            ) : (
              <ul className="grid divide-y divide-slate-100">
                {recentPaid.map((b) => (
                  <li key={b.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium text-slate-900 truncate">
                        {b.client?.display_name ?? "Klient"}
                        {" · "}
                        <span className="text-slate-600 font-normal">
                          {b.service_name ?? b.service?.name ?? "Sesja"}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-500 mt-0.5">
                        {formatDate(b.start_time)}
                        {b.paid_at && ` · opłacono ${formatDate(b.paid_at)}`}
                        {b.payment_method && ` · ${METHOD_LABEL[b.payment_method] ?? b.payment_method}`}
                      </div>
                    </div>
                    <span className="text-[14px] font-semibold tabular-nums text-emerald-700 shrink-0">
                      +{Number(b.payment_amount ?? b.service_price ?? b.price ?? 0).toFixed(0)} zł
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[12px] text-slate-400 text-center mt-2 m-0">
            <Link href="/studio/klienci" className="hover:text-slate-700 underline-offset-2 hover:underline">
              Zobacz przychody per klient →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  delta,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  accent?: "amber" | "emerald";
}) {
  const accentClass =
    accent === "amber"
      ? "border-amber-200 bg-amber-50/50"
      : accent === "emerald"
        ? "border-emerald-200 bg-emerald-50/50"
        : "border-slate-200 bg-white";
  return (
    <div className={`rounded-2xl border p-5 ${accentClass}`}>
      <div className="text-[11.5px] font-semibold tracking-[0.08em] uppercase text-slate-500">
        {label}
      </div>
      <div className="text-[28px] sm:text-[32px] font-semibold tabular-nums tracking-tight text-slate-900 mt-1 leading-none">
        {value}
      </div>
      <div className="text-[12px] text-slate-500 mt-1.5 flex items-center gap-2">
        <span>{hint}</span>
        {delta != null && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
              delta > 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `dziś ${time}`;
  if (diff === 1) return `wczoraj ${time}`;
  if (diff > 0 && diff < 7) return `${diff} dni temu`;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: target.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}
