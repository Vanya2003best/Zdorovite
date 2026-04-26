import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// ----- Mock data: see project_account_dashboard_followups memory.
// Real version needs client_health, client_goals, client_weight_log tables. -----
const MOCK_GOALS = [
  { title: "Powrót do biegania · 5 km", pct: 62, note: "Cel: czerwiec 2026 · idziesz w plan" },
  { title: "Schudnąć do 78 kg", pct: 78, note: "83,8 → 77,6 kg · zostało 0,4 kg" },
  { title: "Pull-up bez gumy", pct: 30, note: "2 powtórzenia z 6" },
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

const MOCK_WEIGHT = {
  current: "77,6 kg",
  delta: "−6,2 kg",
  // Path coords for an SVG line chart, viewBox 320x80
  linePath: "M 0 20 L 50 25 L 100 35 L 150 30 L 200 50 L 250 60 L 320 70",
  fillPath: "M 0 20 L 50 25 L 100 35 L 150 30 L 200 50 L 250 60 L 320 70 L 320 80 L 0 80 Z",
  months: ["Sty", "Lut", "Mar", "Kwi"],
};

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
  const m = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

export default async function ProgressPage() {
  await requireClient("/account/progress");
  const supabase = await createClient();

  // Activity from real bookings
  const { data: rawActivity } = await supabase
    .from("bookings")
    .select(`
      id, start_time, status, created_at,
      service:services ( name ),
      package:packages ( name ),
      trainer:trainers!trainer_id ( profile:profiles!id ( display_name ) )
    `)
    .order("created_at", { ascending: false })
    .limit(5);
  const activity = (rawActivity ?? []) as unknown as ActivityRow[];

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
          Cele długoterminowe, paszport zdrowia i historia aktywności.
        </p>
      </header>

      <div className="grid gap-3 md:gap-5 md:grid-cols-2">
        {/* Big weight chart card — full width on mobile, col-span-2 desktop */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[16px] p-4 md:p-6 md:col-span-2">
          <div className="text-[11px] opacity-70 uppercase tracking-wider font-semibold">
            Waga · ostatnie 4 mies.
          </div>
          <div className="text-[34px] font-bold tracking-[-0.02em] mt-1.5 mb-3">
            {MOCK_WEIGHT.current}{" "}
            <span className="text-[13px] text-emerald-300 font-medium">{MOCK_WEIGHT.delta}</span>
          </div>
          <svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="weight-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#10b981" />
                <stop offset="1" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={MOCK_WEIGHT.fillPath} fill="url(#weight-grad)" opacity="0.3" />
            <path d={MOCK_WEIGHT.linePath} stroke="#10b981" strokeWidth="2.5" fill="none" />
            <circle cx="320" cy="70" r="8" fill="#10b981" opacity="0.25" />
            <circle cx="320" cy="70" r="4" fill="#10b981" />
          </svg>
          <div className="flex justify-between text-[10px] opacity-50 mt-1">
            {MOCK_WEIGHT.months.map((m) => <span key={m}>{m}</span>)}
          </div>
        </section>

        {/* Cele długoterminowe */}
        <section className="bg-white border border-slate-200 rounded-[16px] p-4 md:p-5">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Cele długoterminowe</h2>
            <Link href="#" className="text-[11.5px] text-emerald-700 font-medium">Edytuj</Link>
          </div>
          {MOCK_GOALS.map((g) => (
            <div key={g.title} className="py-2.5 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0">
              <div className="flex justify-between mb-1.5 text-[12.5px]">
                <span className="font-semibold">{g.title}</span>
                <span className="text-emerald-700 font-semibold">{g.pct}%</span>
              </div>
              <div className="h-1 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  style={{ width: `${g.pct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{g.note}</div>
            </div>
          ))}
        </section>

        {/* Paszport zdrowia */}
        <section className="bg-white border border-slate-200 rounded-[16px] p-4 md:p-5">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] m-0">Paszport zdrowia</h2>
            <Link href="#" className="text-[11.5px] text-emerald-700 font-medium">Edytuj</Link>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed mb-3">{MOCK_HEALTH.note}</p>
          <div className="grid grid-cols-2 gap-1.5">
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
