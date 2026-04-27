import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/db/goals";
import { getLatestWeight, getWeightLog, getYearStartWeight, type WeightPoint } from "@/lib/db/weight";
import GoalsEditor from "./GoalsEditor";
import WeightLogger from "./WeightLogger";

// Health passport remains mock until its own migration lands. See project_account_dashboard_followups.
const MOCK_HEALTH = {
  note: "ACL prawego kolana, 9 mies. po op. Cel: czerwiec — bieganie.",
  metrics: [
    ["Wzrost", "182 cm"],
    ["FMS", "14 / 21"],
    ["Tętno spocz.", "62 bpm"],
  ] as const,
};

const PL_MONTH_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type ActivityRow = {
  id: string;
  start_time: string;
  status: string;
  created_at: string;
  service: { name: string } | null;
  package: { name: string } | null;
  trainer: {
    profile: { display_name: string } | null;
  } | null;
};

function fmtRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffH = Math.round(diffMs / 3_600_000);
  const diffD = Math.round(diffMs / 86_400_000);
  if (diffMin < 60) return `${Math.max(1, diffMin)} min temu`;
  if (diffH < 24) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diffD === 1) return "wczoraj";
  if (diffD < 7) return `${diffD} dni temu`;
  return `${d.getDate()} ${PL_MONTH_SHORT[d.getMonth()]}`;
}

function fmtKg(kg: number): string {
  return `${kg.toFixed(1).replace(".", ",")} kg`;
}

function fmtDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return "±0 kg";
  const sign = delta < 0 ? "−" : "+";
  return `${sign}${Math.abs(delta).toFixed(1).replace(".", ",")} kg`;
}

/**
 * Build SVG path coords from weight points. viewBox 320×80; X spaced by date,
 * Y inverted so heavier = lower in the chart. Returns null if there's not
 * enough data (need ≥2 points across ≥1 day).
 */
function buildWeightSvg(points: WeightPoint[]): {
  linePath: string;
  fillPath: string;
  monthLabels: string[];
  lastX: number;
  lastY: number;
} | null {
  if (points.length < 2) return null;
  const W = 320, H = 80;

  const t0 = new Date(points[0].recordedAt).getTime();
  const tN = new Date(points[points.length - 1].recordedAt).getTime();
  const span = Math.max(1, tN - t0); // avoid div-by-0

  const min = Math.min(...points.map((p) => p.weightKg));
  const max = Math.max(...points.map((p) => p.weightKg));
  const range = Math.max(0.5, max - min); // at least 0.5 kg range so flat lines aren't a thin slit

  const coords = points.map((p) => {
    const x = ((new Date(p.recordedAt).getTime() - t0) / span) * W;
    const y = H - ((p.weightKg - min) / range) * (H - 8) - 4; // 4px top/bottom inset
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const fillPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  // Month labels — first day of each month encountered.
  const seen = new Set<number>();
  const monthLabels: string[] = [];
  for (const p of points) {
    const d = new Date(p.recordedAt);
    const m = d.getMonth();
    if (!seen.has(m)) {
      seen.add(m);
      monthLabels.push(PL_MONTH_SHORT[m]);
    }
  }

  const last = coords[coords.length - 1];
  return { linePath, fillPath, monthLabels, lastX: last.x, lastY: last.y };
}

export default async function ProgressPage() {
  const { user } = await requireClient("/account/progress");
  const supabase = await createClient();

  const [goals, weightLog, latestWeight, yearStartWeight, rawActivity] = await Promise.all([
    getGoals(user.id),
    getWeightLog(user.id, 60),
    getLatestWeight(user.id),
    getYearStartWeight(user.id),
    supabase
      .from("bookings")
      .select(`
        id, start_time, status, created_at,
        service:services ( name ),
        package:packages ( name ),
        trainer:trainers!trainer_id ( profile:profiles!id ( display_name ) )
      `)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activity = ((rawActivity.data ?? []) as unknown as ActivityRow[]);

  const weightDelta =
    latestWeight && yearStartWeight && latestWeight.recordedAt !== yearStartWeight.recordedAt
      ? latestWeight.weightKg - yearStartWeight.weightKg
      : null;
  const chart = buildWeightSvg(weightLog);

  // Span label "ostatnie X mies." — best-effort, falls back to "od stycznia" if data spans the year.
  const spanLabel = (() => {
    if (weightLog.length === 0) return "Brak pomiarów";
    if (!chart) return "Pierwszy pomiar";
    const days = Math.round((new Date(weightLog[weightLog.length - 1].recordedAt).getTime() - new Date(weightLog[0].recordedAt).getTime()) / 86_400_000);
    const months = Math.max(1, Math.round(days / 30));
    return `Waga · ostatnie ${months} ${months === 1 ? "miesiąc" : months < 5 ? "miesiące" : "miesięcy"}`;
  })();

  return (
    <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-5 sm:py-8">
      {/* Mobile header */}
      <header className="md:hidden mb-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          Twój dziennik
        </div>
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">
          Postępy {new Date().getFullYear()}
        </h1>
      </header>
      {/* Desktop header */}
      <header className="hidden md:block mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Twoje postępy
        </h1>
        <p className="text-sm text-slate-600 mt-1.5">
          Cele długoterminowe, dziennik wagi i historia aktywności.
        </p>
      </header>

      <div className="grid gap-3 md:gap-5 md:grid-cols-2">
        {/* Weight chart card */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[16px] p-4 md:p-6 md:col-span-2">
          <div className="flex justify-between items-baseline">
            <div className="text-[11px] opacity-70 uppercase tracking-wider font-semibold">{spanLabel}</div>
            <WeightLogger latest={latestWeight} />
          </div>

          {weightLog.length === 0 ? (
            <p className="mt-4 text-[13px] text-white/70">
              Zacznij dziennik wagi — zapisz pierwszy pomiar przyciskiem powyżej, by zobaczyć trend i statystykę „od stycznia".
            </p>
          ) : (
            <>
              <div className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] mt-1.5 mb-3">
                {fmtKg(latestWeight!.weightKg)}{" "}
                {weightDelta !== null && (
                  <span className={`text-[13px] font-medium ${weightDelta < 0 ? "text-emerald-300" : weightDelta > 0 ? "text-rose-300" : "text-white/60"}`}>
                    {fmtDelta(weightDelta)}
                  </span>
                )}
              </div>
              {chart ? (
                <>
                  <svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none" aria-hidden>
                    <defs>
                      <linearGradient id="weight-grad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor="#10b981" />
                        <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={chart.fillPath} fill="url(#weight-grad)" opacity="0.3" />
                    <path d={chart.linePath} stroke="#10b981" strokeWidth="2.5" fill="none" />
                    <circle cx={chart.lastX} cy={chart.lastY} r="8" fill="#10b981" opacity="0.25" />
                    <circle cx={chart.lastX} cy={chart.lastY} r="4" fill="#10b981" />
                  </svg>
                  <div className="flex justify-between text-[10px] opacity-50 mt-1">
                    {chart.monthLabels.map((m) => <span key={m}>{m}</span>)}
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] text-white/60 mt-2">
                  Zapisz drugi pomiar (innego dnia), by zobaczyć trend.
                </p>
              )}
            </>
          )}
        </section>

        {/* Cele długoterminowe — real, with editor */}
        <section className="bg-white border border-slate-200 rounded-[16px] p-4 md:p-5">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Cele długoterminowe</h2>
          </div>
          <GoalsEditor initialGoals={goals} />
        </section>

        {/* Paszport zdrowia — still mock until client_health migration. */}
        <section className="bg-white border border-slate-200 rounded-[16px] p-4 md:p-5">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Paszport zdrowia</h2>
            <Link href="#" className="text-[11.5px] text-emerald-700 font-medium">Edytuj</Link>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed mb-3">{MOCK_HEALTH.note}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Latest weight slot pulled from the real log; the rest stay mock. */}
            <div className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
              <div className="text-[11px] text-slate-500">Waga</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5">
                {latestWeight ? fmtKg(latestWeight.weightKg) : "—"}
              </div>
            </div>
            {MOCK_HEALTH.metrics.map(([label, value]) => (
              <div key={label} className="px-2 py-1.5 bg-slate-50 rounded-[7px]">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Ostatnia aktywność */}
        <section className="bg-white border border-slate-200 rounded-[16px] p-4 md:p-5 md:col-span-2">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Ostatnia aktywność</h2>
            <Link href="/account/bookings?tab=history" className="text-[11.5px] text-emerald-700 font-medium">
              Pełna historia →
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">Brak aktywności.</p>
          ) : (
            <div>
              {activity.map((a) => {
                const completed = a.status === "completed";
                const trainerName = a.trainer?.profile?.display_name ?? "Trener";
                const what = a.service?.name ?? a.package?.name ?? "Sesja";
                return (
                  <div key={a.id} className="flex gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                    <div
                      className={`w-7.5 h-7.5 min-w-[30px] h-[30px] rounded-[8px] inline-flex items-center justify-center shrink-0 ${
                        completed ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {completed ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate">
                        {completed ? `Sesja ukończona — ${trainerName}` : `Sesja zarezerwowana — ${trainerName}`}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{what}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 self-start pt-1 shrink-0">
                      {fmtRelative(a.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
