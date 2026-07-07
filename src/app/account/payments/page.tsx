import { redirect } from "next/navigation";
import { ACCOUNT_LITE } from "@/lib/feature-flags";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Platnosci, {
  type PaymentsData,
  type Tx,
  type TxKind,
  type MonthSpending,
  type SpendingBreakdown,
} from "./Platnosci";

const PL_MONTHS_NOM = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];
const PL_MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const PL_MONTHS_TX_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

const DONE_STATUSES = ["completed", "paid"];

/**
 * /account/payments — Płatności (design 41).
 *
 * Reconstructs a "payments history" from real bookings since the platform
 * doesn't store transactions (memory: model is direct trainer↔client,
 * no merchant-of-record). Each booking = one row with its price + status.
 * Cancelled rows show as zero-impact (no charge); completed/confirmed as
 * negative amounts. Other modes (faktury, cards, subscriptions, vouchers)
 * render explicit "we don't process payments" copy.
 */
export default async function PaymentsPage() {
  // ACCOUNT_LITE: page hidden (витрина strategy) — flag flip restores it.
  if (ACCOUNT_LITE) redirect("/account/bookings");

  const { user } = await requireClient("/account/payments");
  const supabase = await createClient();

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      `
      id, trainer_id, start_time, status, price, package_id,
      service_name, package_name,
      service:services ( name ),
      package:packages ( name ),
      trainer:trainers ( profile:profiles!id ( display_name ) )
    `,
    )
    .eq("client_id", user.id)
    .order("start_time", { ascending: false });

  const bookings = (bookingsRaw ?? []) as unknown as Array<{
    id: string;
    trainer_id: string;
    start_time: string;
    status: string;
    price: number;
    package_id: string | null;
    service_name: string | null;
    package_name: string | null;
    service: { name: string } | null;
    package: { name: string } | null;
    trainer: { profile: { display_name: string | null } | null } | null;
  }>;

  // Build tx list — group package bookings by package_id (one tx per package
  // purchase, sum of session prices) and treat standalone bookings as
  // individual session transactions. Cancelled bookings show as refunds
  // (positive amounts, but only when this client got the slot back).
  const txList: Tx[] = [];
  const seenPackages = new Set<string>();

  for (const b of bookings) {
    const trainerName = b.trainer?.profile?.display_name ?? "Trener";
    const d = new Date(b.start_time);
    const monthShort = PL_MONTHS_TX_SHORT[d.getMonth()];
    const dayNum = d.getDate();
    const isCancelled = b.status === "cancelled";

    if (b.package_id && b.package?.name) {
      // Package — emit one tx the first time we see this package_id.
      // The price shown is the package price (bookings inherit the same
      // price across the package), so first occurrence captures it.
      if (seenPackages.has(b.package_id)) continue;
      seenPackages.add(b.package_id);
      txList.push({
        id: `pkg-${b.package_id}`,
        iso: b.start_time,
        monthShort,
        dayNum,
        description: `Pakiet ${b.package.name}`,
        meta: `Trener: ${trainerName}`,
        kind: "package",
        trainerName,
        status: isCancelled ? "cancelled" : "completed",
        amountPln: -Math.abs(b.price),
        invoiceNo: null,
      });
      continue;
    }

    // Standalone session — categorize by service name.
    const name = b.service_name ?? b.service?.name ?? "Sesja";
    const lower = name.toLowerCase();
    const kind: TxKind = /diagnost|fms|test|pomiar/i.test(lower) ? "diagnostics" : "session";

    if (isCancelled) {
      // Cancelled stand-alone: no charge applied → don't show as a tx.
      // (Real platforms would show it as "Zwrot"; we don't track that.)
      continue;
    }

    txList.push({
      id: b.id,
      iso: b.start_time,
      monthShort,
      dayNum,
      description: name,
      meta: `Trener: ${trainerName}`,
      kind,
      trainerName,
      status: b.status,
      amountPln: -Math.abs(b.price),
      invoiceNo: null,
    });
  }

  // Totals.
  const totalSpent = txList.reduce(
    (acc, t) => acc + (t.amountPln < 0 ? Math.abs(t.amountPln) : 0),
    0,
  );
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthSpent = txList.reduce(
    (acc, t) => (t.amountPln < 0 && new Date(t.iso) >= monthStart ? acc + Math.abs(t.amountPln) : acc),
    0,
  );

  // Monthly chart — last 6 months (oldest → newest).
  const monthlyChart: MonthSpending[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const sum = txList.reduce((acc, t) => {
      const tt = new Date(t.iso);
      if (tt >= d && tt < next && t.amountPln < 0) return acc + Math.abs(t.amountPln);
      return acc;
    }, 0);
    monthlyChart.push({
      month: PL_MONTHS_SHORT[d.getMonth()],
      pln: sum,
      isCurrent: i === 0,
    });
  }

  // Breakdown — bucket by kind, compute pct.
  const buckets = new Map<TxKind, number>();
  for (const t of txList) {
    if (t.amountPln < 0) {
      buckets.set(t.kind, (buckets.get(t.kind) ?? 0) + Math.abs(t.amountPln));
    }
  }
  const palette: Record<TxKind, { label: string; emoji: string; color: string }> = {
    package: { label: "Pakiety treningowe", emoji: "📦", color: "linear-gradient(90deg,#10b981,#0d9488)" },
    session: { label: "Sesje pojedyncze", emoji: "🏋", color: "#0ea5e9" },
    diagnostics: { label: "Diagnostyka", emoji: "📊", color: "#a855f7" },
    refund: { label: "Zwroty", emoji: "↩", color: "#94a3b8" },
    voucher: { label: "Vouchery", emoji: "🎁", color: "#f59e0b" },
  };
  const breakdown: SpendingBreakdown = {
    totalPln: totalSpent,
    rows: Array.from(buckets.entries())
      .filter(([, pln]) => pln > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([kind, pln]) => ({
        label: palette[kind].label,
        emoji: palette[kind].emoji,
        color: palette[kind].color,
        pln,
        pct: totalSpent > 0 ? Math.round((pln / totalSpent) * 100) : 0,
      })),
    averagePerSession: (() => {
      const completedCount = bookings.filter((b) => DONE_STATUSES.includes(b.status) || (b.status === "confirmed" && new Date(b.start_time) < now)).length;
      if (completedCount === 0) return null;
      return Math.round(totalSpent / completedCount);
    })(),
  };

  const data: PaymentsData = {
    monthlyChart,
    breakdown,
    totalSpent,
    thisMonthSpent,
    thisMonthLabel: PL_MONTHS_NOM[now.getMonth()],
    txCount: txList.length,
    txList,
  };

  return <Platnosci data={data} />;
}
