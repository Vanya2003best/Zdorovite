"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * /account/payments — Płatności (design 41).
 *
 * Five modes: Historia / Faktury / Metody płatności / Subskrypcje /
 * Kody i vouchery. Schema reality:
 *   - Platform is not merchant-of-record (memory: "Money goes trainer↔
 *     client direct (BLIK/cash/own-Stripe)") — there are no transaction,
 *     invoice, payment_method, subscription, or voucher tables.
 *   - bookings.price is the only real "amount" datapoint.
 *
 * So Historia is partially real (each booking is shown as one row with
 * its price), and the other modes carry explicit copy explaining why
 * they're empty: NaZdrow! doesn't process payments — your bank does.
 */

export type Tx = {
  id: string;
  iso: string;
  monthShort: string;
  dayNum: number;
  description: string;
  meta: string;
  /** -- "package" | "session" | "diagnostics" | "refund" | "voucher" -- */
  kind: TxKind;
  /** Trainer's display name. */
  trainerName: string;
  /** Booking status: "completed" | "confirmed" | "cancelled" | "pending". */
  status: string;
  /** Negative for paid, positive for refund/credit. */
  amountPln: number;
  /** Optional FV pseudo-number for display only. */
  invoiceNo: string | null;
};

export type TxKind = "package" | "session" | "diagnostics" | "refund" | "voucher";

export type MonthSpending = { month: string; pln: number; isCurrent: boolean };

export type SpendingBreakdown = {
  /** label → [pln, pct] */
  rows: { label: string; emoji: string; pln: number; pct: number; color: string }[];
  totalPln: number;
  averagePerSession: number | null;
};

export type PaymentsData = {
  monthlyChart: MonthSpending[];
  breakdown: SpendingBreakdown;
  totalSpent: number;
  thisMonthSpent: number;
  thisMonthLabel: string;
  txCount: number;
  txList: Tx[];
};

type Mode = "tx" | "fv" | "cards" | "subs" | "codes";

export default function Platnosci({ data }: { data: PaymentsData }) {
  const [mode, setMode] = useState<Mode>("tx");
  const [filter, setFilter] = useState<TxKind | "all">("all");

  const filteredTx =
    filter === "all" ? data.txList : data.txList.filter((t) => t.kind === filter);

  return (
    <div className="px-4 sm:px-7 pt-2 pb-8">
      <Topbar data={data} />
      <SummaryStrip data={data} />
      <ModeBar mode={mode} onChange={setMode} txCount={data.txCount} />
      <ModeBanner mode={mode} data={data} />

      {mode === "tx" && (
        <TxPanel
          tx={filteredTx}
          filter={filter}
          onFilterChange={setFilter}
          monthly={data.monthlyChart}
          breakdown={data.breakdown}
        />
      )}
      {mode === "fv" && <InvoicesPanel />}
      {mode === "cards" && <CardsPanel />}
      {mode === "subs" && <SubsPanel />}
      {mode === "codes" && <VouchersPanel />}
    </div>
  );
}

/* ====================== TOPBAR ====================== */

function Topbar({ data }: { data: PaymentsData }) {
  const sub = data.txCount > 0
    ? `${data.txCount} ${plural(data.txCount, "transakcja", "transakcje", "transakcji")} · łącznie ${formatPln(data.totalSpent)} PLN`
    : "Brak płatności w naszej historii — pakiety opłacasz bezpośrednio u trenera";
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-3.5">
      <div>
        <h1 className="text-[24px] tracking-[-0.022em] font-semibold m-0">Płatności</h1>
        <div className="text-[12.5px] text-slate-500 mt-1">{sub}</div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[9px] bg-white border border-slate-200 text-[12.5px] font-medium text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Eksport raportu — wkrótce"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Raport (PDF)
        </button>
      </div>
    </div>
  );
}

/* ====================== SUMMARY STRIP ====================== */

function SummaryStrip({ data }: { data: PaymentsData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3.5">
      <SumCard label="Wydano łącznie" value={formatPln(data.totalSpent)} unit="PLN" detail={data.txCount > 0 ? `${data.txCount} ${plural(data.txCount, "płatność", "płatności", "płatności")}` : "—"} />
      <SumCard label="Ten miesiąc" value={formatPln(data.thisMonthSpent)} unit="PLN" detail={data.thisMonthLabel} />
      <SumCard label="Saldo bonusowe" value="—" unit="PLN" detail="Wkrótce" muted />
      <SumCard label="Następne obciążenie" value="—" unit="" detail="Brak auto-odnowień" muted />
      <SumCard label="Faktury" value="—" unit="" detail="Wkrótce" muted />
    </div>
  );
}

function SumCard({ label, value, unit, detail, muted }: { label: string; value: string; unit?: string; detail: string; muted?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.07em] text-slate-500 font-semibold mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={"text-[22px] font-bold tabular-nums tracking-[-0.02em] " + (muted ? "text-slate-400" : "text-slate-900")}>
          {value}
        </span>
        {unit && <span className="text-[12px] font-medium text-slate-500">{unit}</span>}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{detail}</div>
    </div>
  );
}

/* ====================== MODE BAR + BANNERS ====================== */

function ModeBar({ mode, onChange, txCount }: { mode: Mode; onChange: (m: Mode) => void; txCount: number }) {
  return (
    <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
      <div className="inline-flex p-1 bg-slate-100 rounded-[11px] gap-0.5 text-[13px] font-medium">
        {(
          [
            { id: "tx", label: "Historia", badge: txCount > 0 ? String(txCount) : "" },
            { id: "fv", label: "Faktury", badge: "" },
            { id: "cards", label: "Metody płatności", badge: "" },
            { id: "subs", label: "Subskrypcje", badge: "" },
            { id: "codes", label: "Kody i vouchery", badge: "" },
          ] as { id: Mode; label: string; badge: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={
              "inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] whitespace-nowrap transition " +
              (mode === m.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "text-slate-600 hover:text-slate-900")
            }
          >
            {m.label}
            {m.badge && (
              <span
                className={
                  "text-[10.5px] font-semibold px-[6px] py-[1px] rounded-[5px] " +
                  (mode === m.id ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700")
                }
              >
                {m.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeBanner({ mode, data }: { mode: Mode; data: PaymentsData }) {
  const cls = "flex items-center gap-3.5 px-4 py-3 rounded-[11px] text-[12.5px] mb-3.5 border ";
  if (mode === "tx") {
    return (
      <div className={cls + "bg-sky-50 border-sky-200 text-sky-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-sky-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="10" /></svg>
        </span>
        <div>
          <b className="font-semibold">
            {data.txCount > 0
              ? `${data.txCount} ${plural(data.txCount, "płatność", "płatności", "płatności")} · łącznie ${formatPln(data.totalSpent)} PLN`
              : "Brak płatności w historii"}
          </b>
          <div className="text-sky-800/80 mt-0.5">
            Historia tworzona z zarejestrowanych sesji. Faktyczne obciążenia kart/BLIKa zobaczysz w wyciągu z banku — NaZdrow! nie pośredniczy w przelewach.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "fv") {
    return (
      <div className={cls + "bg-emerald-50 border-emerald-200 text-emerald-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
        </span>
        <div>
          <b className="font-semibold">Faktury — moduł w przygotowaniu</b>
          <div className="text-emerald-800/80 mt-0.5">
            Każdy trener wystawia własne faktury (jeśli prowadzi działalność) bezpośrednio. Poproś trenera o FV, gdy potrzebujesz dokumentu.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "cards") {
    return (
      <div className={cls + "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-fuchsia-500 text-white inline-flex items-center justify-center shrink-0">
          💳
        </span>
        <div>
          <b className="font-semibold">Metody płatności — wkrótce</b>
          <div className="text-fuchsia-800/80 mt-0.5">
            Obecnie pakiety i sesje opłacasz bezpośrednio u trenera (BLIK / przelew / gotówka). Karta na platformie pojawi się przy wprowadzeniu opłat za usługi premium NaZdrow!.
          </div>
        </div>
      </div>
    );
  }
  if (mode === "subs") {
    return (
      <div className={cls + "bg-amber-50 border-amber-200 text-amber-900"}>
        <span className="w-7 h-7 rounded-[8px] bg-amber-500 text-white inline-flex items-center justify-center shrink-0">
          ↻
        </span>
        <div>
          <b className="font-semibold">Subskrypcje — brak aktywnych</b>
          <div className="text-amber-800/80 mt-0.5">
            Pakiety treningowe nie odnawiają się automatycznie — kupujesz nowy ręcznie u trenera, gdy dotychczasowy się skończy.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cls + "bg-slate-100 border-slate-200 text-slate-700"}>
      <span className="w-7 h-7 rounded-[8px] bg-slate-500 text-white inline-flex items-center justify-center shrink-0">🎁</span>
      <div>
        <b className="font-semibold">Kody i vouchery — wkrótce</b>
        <div className="text-slate-500 mt-0.5">
          System zniżek i bonusów (np. polecenia, opinie) pojawi się w jednej z najbliższych aktualizacji.
        </div>
      </div>
    </div>
  );
}

/* ====================== TX PANEL ====================== */

function TxPanel({
  tx,
  filter,
  onFilterChange,
  monthly,
  breakdown,
}: {
  tx: Tx[];
  filter: TxKind | "all";
  onFilterChange: (f: TxKind | "all") => void;
  monthly: MonthSpending[];
  breakdown: SpendingBreakdown;
}) {
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title={`Wydatki · ${monthly.length} ${plural(monthly.length, "miesiąc", "miesiące", "miesięcy")}`} sub={`${formatPln(breakdown.totalPln)} PLN razem`} />
          {monthly.length === 0 ? (
            <PlaceholderEmpty text="Brak danych — pierwsze sesje pojawią się tu jako historia wydatków." />
          ) : (
            <MonthlyChart data={monthly} />
          )}
        </Card>
        <Card>
          <CardHeader title="Rozkład wydatków" />
          {breakdown.rows.length === 0 ? (
            <PlaceholderEmpty text="Po pierwszej zarejestrowanej sesji zobaczysz strukturę wydatków." />
          ) : (
            <BreakdownBars data={breakdown} />
          )}
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-3.5 flex-wrap gap-3">
          <h3 className="text-[14px] font-bold text-slate-900 m-0">
            Wszystkie transakcje · {tx.length}
          </h3>
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { id: "all", label: "Wszystkie" },
                { id: "package", label: "Pakiety" },
                { id: "session", label: "Sesje" },
                { id: "diagnostics", label: "Diagnostyka" },
                { id: "refund", label: "Zwroty" },
              ] as { id: TxKind | "all"; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onFilterChange(p.id)}
                className={
                  "h-7 px-3 inline-flex items-center rounded-[8px] border text-[11.5px] font-medium transition " +
                  (filter === p.id
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {tx.length === 0 ? (
          <PlaceholderEmpty text="Brak transakcji w wybranej kategorii." />
        ) : (
          <div className="flex flex-col">
            <div className="hidden md:grid grid-cols-[60px_2fr_1fr_120px_110px_60px] gap-3 pb-2 border-b border-slate-200 text-[10px] uppercase tracking-[0.07em] font-bold text-slate-500">
              <div>Data</div>
              <div>Opis</div>
              <div>Trener</div>
              <div>Status</div>
              <div className="text-right">Kwota</div>
              <div></div>
            </div>
            {tx.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function TxRow({ t }: { t: Tx }) {
  const isRefund = t.amountPln > 0;
  const statusLabel = (() => {
    if (t.status === "completed" || t.status === "paid") return "✓ Zarejestrowana";
    if (t.status === "confirmed") return "✓ Potwierdzona";
    if (t.status === "cancelled") return "⊘ Anulowana";
    if (t.status === "pending") return "⏳ Oczekuje";
    return t.status;
  })();
  const statusTone =
    t.status === "completed" || t.status === "paid" || t.status === "confirmed"
      ? "bg-emerald-50 text-emerald-700"
      : t.status === "cancelled"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-900";
  const kindEmoji = {
    package: "📦",
    session: "🏋",
    diagnostics: "📊",
    refund: "↩",
    voucher: "🎁",
  } as const;
  return (
    <div className="grid md:grid-cols-[60px_2fr_1fr_120px_110px_60px] grid-cols-[60px_1fr_auto] gap-3 py-3 border-b border-dashed border-slate-100 last:border-0 items-center">
      <div className="text-center">
        <div className="text-[18px] font-bold leading-none text-slate-900">{t.dayNum}</div>
        <div className="text-[10px] uppercase tracking-[0.06em] text-slate-500 font-bold mt-0.5">{t.monthShort}</div>
      </div>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-[9px] bg-slate-100 inline-flex items-center justify-center text-[16px] shrink-0">
          {kindEmoji[t.kind]}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 truncate">{t.description}</div>
          {t.meta && <div className="text-[11px] text-slate-500 truncate mt-0.5">{t.meta}</div>}
        </div>
      </div>
      <div className="text-[12px] text-slate-700 truncate hidden md:block">{t.trainerName}</div>
      <div className="hidden md:block">
        <span className={`text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-[3px] rounded-full ${statusTone}`}>
          {statusLabel}
        </span>
      </div>
      <div
        className={
          "text-right font-bold tabular-nums " +
          (isRefund ? "text-emerald-700" : "text-slate-900")
        }
      >
        {isRefund ? "+" : "−"}
        {formatPln(Math.abs(t.amountPln))} PLN
      </div>
      <div className="text-right md:text-center hidden md:block text-[11px] text-slate-400">
        {t.invoiceNo ? <span className="text-slate-600">{t.invoiceNo}</span> : "—"}
      </div>
    </div>
  );
}

/* ====================== CHART + BREAKDOWN ====================== */

function MonthlyChart({ data }: { data: MonthSpending[] }) {
  const max = Math.max(...data.map((d) => d.pln), 1);
  return (
    <>
      <div className="flex items-end gap-2 h-[160px] mt-2">
        {data.map((m) => {
          const h = Math.max(8, Math.round((m.pln / max) * 140));
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 justify-end">
              <div className="text-[10px] text-slate-700 font-bold tabular-nums">
                {formatPln(m.pln)}
              </div>
              <div
                className={
                  "w-full rounded-t-[4px] " +
                  (m.isCurrent ? "bg-gradient-to-b from-emerald-500 to-teal-500" : "bg-slate-200")
                }
                style={{ height: `${h}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        {data.map((m) => (
          <div
            key={m.month}
            className={
              "flex-1 text-center text-[10px] " +
              (m.isCurrent ? "text-emerald-700 font-bold" : "text-slate-500")
            }
          >
            {m.month}
          </div>
        ))}
      </div>
    </>
  );
}

function BreakdownBars({ data }: { data: SpendingBreakdown }) {
  return (
    <div className="flex flex-col gap-3">
      {data.rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between items-baseline text-[12px] mb-1">
            <span className="text-slate-700 font-semibold">
              {r.emoji} {r.label}
            </span>
            <span className="text-slate-900 font-bold tabular-nums">
              {formatPln(r.pln)} PLN · {r.pct}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full" style={{ width: `${r.pct}%`, background: r.color }} />
          </div>
        </div>
      ))}
      {data.averagePerSession != null && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11.5px] text-slate-500 text-center">
          Średnio na sesję: <b className="text-slate-900">{formatPln(data.averagePerSession)} PLN</b>
        </div>
      )}
    </div>
  );
}

/* ====================== EMPTY MODES ====================== */

function InvoicesPanel() {
  return (
    <Card>
      <CardHeader title="Faktury" sub="moduł fakturowy w przygotowaniu" />
      <PlaceholderEmpty
        text={'Faktury (FV) wystawia bezpośrednio trener jeśli prowadzi działalność gospodarczą. NaZdrow! nie pośredniczy w przelewach (model „direct trainer-client") i nie generuje faktur za swoje usługi w fazie startowej.'}
        cta={{ label: "Zapytaj trenera o FV", href: "/account/messages" }}
      />
    </Card>
  );
}

function CardsPanel() {
  return (
    <Card>
      <CardHeader title="Karty i metody płatności" />
      <PlaceholderEmpty
        text="Obecnie pakiety i pojedyncze sesje opłacasz bezpośrednio u trenera — BLIK-iem, przelewem na konto lub gotówką. Karta zapisana w aplikacji pojawi się, gdy wprowadzimy płatne plany NaZdrow!."
      />
    </Card>
  );
}

function SubsPanel() {
  return (
    <Card>
      <CardHeader title="Subskrypcje" sub="brak aktywnych" />
      <PlaceholderEmpty
        text="Pakiety treningowe nie odnawiają się automatycznie. Po skończeniu pakietu kupujesz nowy ręcznie u trenera, gdy będziesz gotowa kontynuować."
        cta={{ label: "Zobacz pakiety", href: "/account/package" }}
      />
    </Card>
  );
}

function VouchersPanel() {
  return (
    <Card>
      <CardHeader title="Kody promocyjne i vouchery" />
      <PlaceholderEmpty
        text="System zniżek (kody, polecenia, voucher za opinię) pojawi się w jednej z najbliższych aktualizacji. Do tego czasu — śledzimy każdą wystawioną opinię, by przy starcie modułu nagrodzić Cię retroaktywnie."
      />
    </Card>
  );
}

/* ====================== SHARED ====================== */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded-[14px] px-5 py-[18px]">{children}</div>;
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center mb-3.5">
      <h3 className="text-[14px] font-bold text-slate-900 m-0">{title}</h3>
      {sub && <span className="text-[11px] text-slate-500 font-medium">{sub}</span>}
    </div>
  );
}

function PlaceholderEmpty({ text, cta }: { text: string; cta?: { label: string; href: string } }) {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-slate-200 py-10 px-6 text-center">
      <p className="text-[13px] text-slate-500 leading-[1.5] max-w-[480px] mx-auto">{text}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center mt-3 h-9 px-3.5 rounded-[9px] bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-black"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

/* ====================== HELPERS ====================== */

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function formatPln(n: number): string {
  return Number(n).toLocaleString("pl-PL", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}
