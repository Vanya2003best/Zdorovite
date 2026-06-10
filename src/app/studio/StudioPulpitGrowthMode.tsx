import Link from "next/link";

/**
 * Pulpit · Growth mode (design 42, m-growth).
 *
 * For established trainers with enough volume to care about insights,
 * ranking, and per-client action queue. Lots of MOCK data — the real
 * implementation needs:
 *   - quarterly_revenue_goals table (trainer-set goals)
 *   - search_ranking_snapshot view (position per keyword over time)
 *   - conversion_metrics view (msg → booking ratio + benchmark)
 *   - inactive_clients view (>30 days since last booking)
 *   - per-slot fill-rate aggregates (booking hour → utilisation)
 *
 * Real signals plumbed today: thisMonthRevenue, reviewCount, rating —
 * everything else falls back to representative hardcoded values flagged
 * inline.
 */
export default function StudioPulpitGrowthMode({
  thisMonthRevenue,
  reviewCount,
  rating,
}: {
  thisMonthRevenue: number;
  reviewCount: number;
  rating: number;
}) {
  // MOCK: quarterly goal — would come from trainer_goals table
  const quarterGoal = 30000;
  const quarterToDate = thisMonthRevenue * 2; // rough proxy for "so far in Q"
  const quarterPct = Math.min(100, Math.round((quarterToDate / quarterGoal) * 100));
  const dailyPace = Math.round(thisMonthRevenue / 30) || 420;
  const dailyGoal = Math.round(quarterGoal / 90);

  return (
    <section className="bg-slate-50 py-5">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 grid gap-4">
        {/* HEAD */}
        <div className="flex items-end justify-between gap-3 flex-wrap pb-1">
          <div>
            <h1 className="m-0 text-[26px] text-[#002f34] font-extrabold tracking-[-0.025em]">
              Tryb wzrostu
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 m-0">
              Maj 2026 · cel kwartalny: {quarterGoal.toLocaleString("pl-PL")} zł · jesteś na <b className="text-orange-600 font-bold">{quarterPct}%</b>
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="px-4 py-2.5 rounded-[7px] bg-white border border-slate-300 text-[#002f34] text-[13px] font-bold hover:bg-slate-50 transition">
              📊 Pełny raport
            </button>
            <button type="button" className="px-4 py-2.5 rounded-[7px] bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-bold transition">
              Ustaw nowy cel
            </button>
          </div>
        </div>

        {/* GROWTH HERO — quarterly goal + tempo + weeks-to-go */}
        <div className="bg-white rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)] grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr] gap-6 items-center">
          <div>
            <h2 className="m-0 mb-1.5 text-[17px] font-extrabold text-[#002f34] tracking-[-0.01em]">
              Cel kwartalny · Q2 2026
            </h2>
            <p className="m-0 mb-3.5 text-[12px] text-slate-500">
              {/* MOCK: forecast — needs linear regression over weekly rev */}
              Tempo wskazuje, że skończysz kwartał na <b className="text-[#002f34]">{Math.round(quarterToDate * 1.5).toLocaleString("pl-PL")} zł</b> — możesz dobić do celu zwiększając pakiety o 2 / tyg.
            </p>
            <div className="relative h-3 bg-slate-100 rounded-md overflow-hidden mb-2">
              <div className="h-full rounded-md" style={{ width: `${quarterPct}%`, background: "linear-gradient(90deg, #f97316, #fb923c)" }} />
              <div className="absolute -top-1 -bottom-1 w-0.5 bg-[#002f34]" style={{ left: `${quarterPct}%` }}>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9.5px] text-slate-500 font-bold whitespace-nowrap">teraz</span>
              </div>
            </div>
            <div className="flex justify-between text-[11.5px] font-semibold">
              <span className="text-slate-500">0 zł</span>
              <span className="text-[#002f34]"><b>{quarterToDate.toLocaleString("pl-PL")} zł</b> z {quarterGoal.toLocaleString("pl-PL")} zł</span>
            </div>
          </div>
          <GrowthBlock
            lab="Tempo dziennie"
            val={dailyPace.toString()}
            unit="zł"
            sub={<>cel: <b className="text-[#002f34]">{dailyGoal} zł</b> — brakuje {Math.max(0, dailyGoal - dailyPace)} zł / dzień</>}
          />
          <GrowthBlock
            lab="Tygodnie do końca Q2"
            val="7"
            sub={<>obecnie: <b className="text-[#002f34]">17 sesji / tydz.</b> · cel: 20</>}
          />
        </div>

        {/* INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          <Insight
            tone="good"
            badge="DOBRA WIADOMOŚĆ"
            title="Konwersja z wiadomości"
            stat="38%"
            statSmall="vs śr. platformy 24%"
            body={<>Z każdych 10 wiadomości, które dostajesz, <b className="text-[#002f34]">4 osoby</b> rezerwują sesję. To powyżej średniej.</>}
            actLabel="Co działa najlepiej? →"
          />
          <Insight
            tone="warn"
            badge="UWAGA"
            title="Klienci w ryzyku rezygnacji"
            stat="3"
            statSmall="klientów nieaktywnych ≥ 30 dni"
            body={<><b className="text-[#002f34]">Karolina W., Maciej B., Patrycja S.</b> — nie ma sesji od ponad miesiąca. Czas na re-engagement.</>}
            actLabel="Wyślij ofertę powrotną →"
          />
          <Insight
            tone="opp"
            badge="SZANSA"
            title="Pakiet 8× sprzedaje się 3× lepiej niż 4×"
            stat="+47%"
            statSmall="marży na pakietach 8×"
            body={<>Klienci pakietu 8× zostają średnio <b className="text-[#002f34]">4 miesiące dłużej</b>. Możesz mocniej go promować.</>}
            actLabel="Edytuj pakiety →"
          />
        </div>

        {/* RANKING + INSIGHTS OF THE MONTH */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
          <div className="bg-white rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)]">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="m-0 text-[14px] text-[#002f34] font-extrabold tracking-[-0.005em]">
                Twoja pozycja w wynikach
              </h3>
              <Link href="/studio/reviews" className="text-[11.5px] text-slate-500 font-semibold hover:text-orange-600">
                Wszystkie keywordy →
              </Link>
            </div>
            <div className="text-[11.5px] text-slate-500 font-semibold mb-1.5">
              Keyword: <b className="text-[#002f34]">"trener personalny warszawa"</b> · 1 850 wyszukiwań / mies.
            </div>
            <div className="flex items-baseline gap-3 pt-2 pb-4 border-b border-slate-200 mb-3">
              <span className="text-[44px] font-extrabold text-[#002f34] tracking-[-0.04em] leading-none">
                <span className="text-[26px] text-orange-500 align-top mr-0.5">#</span>4
              </span>
              <span className="text-[13px] text-slate-500">
                z <b className="text-[#002f34] font-bold">178</b> trenerów<br />
                <span className="text-[11.5px]">w wynikach wyszukiwania</span>
              </span>
              <span className="ml-auto px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-extrabold rounded">
                ↑ 2 pozycje (tydzień)
              </span>
            </div>
            <div className="grid gap-2 mb-3">
              {/* MOCK: ranking rows. Real source: search_ranking_snapshot */}
              <RankRow n={1} avBg="from-emerald-400 to-emerald-700" initials="TK" name="Tomasz Kaczmarek" score="98 pkt" />
              <RankRow n={2} avBg="from-blue-400 to-blue-700" initials="KP" name="Katarzyna Pawlak" score="94 pkt" />
              <RankRow n={3} avBg="from-violet-400 to-violet-700" initials="PB" name="Piotr Bednarczyk" score="89 pkt" />
              <RankRow n={4} avBg="from-orange-400 to-orange-700" initials="MK" name="Ty" score="86 pkt" me />
              <RankRow n={5} avBg="from-slate-400 to-slate-700" initials="RL" name="Rafał Lewandowski" score="82 pkt" />
            </div>
            <div className="mt-3 p-3 bg-orange-50 border border-dashed border-orange-300 rounded-md text-[11.5px] text-orange-900 font-semibold">
              💡 <b className="text-orange-700">Wskaźnik: aby wskoczyć na #3</b> — potrzebujesz 4 nowych opinii (5⭐) lub uzupełnij sekcję "Twoja historia". Średni czas: 2 tygodnie.
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)]">
            <h3 className="m-0 mb-3.5 text-[14px] text-[#002f34] font-extrabold tracking-[-0.005em]">
              Insighty miesiąca
            </h3>
            <div className="grid gap-3.5">
              <MonthInsight icon="📈" tone="emerald" title="Wtorek 16:30 — Twój najlepszy slot" sub="95% rezerwacji + 0 odwołań · trzymaj!" />
              <MonthInsight icon="📅" tone="amber" title="Pon. 14:00 — najsłabszy slot" sub="35% obłożenia · rozważ przesunięcie / rabat" />
              <MonthInsight icon="⏱" tone="blue" title="Odpowiadasz w 18 min" sub="Top 15% trenerów na platformie · super!" />
              <MonthInsight icon="💎" tone="orange" title={`LTV nowego klienta · ${Math.round(thisMonthRevenue / Math.max(1, reviewCount || 12)).toLocaleString("pl-PL")} zł`} sub={`Średnio 9,8 sesji · ★ ${rating.toFixed(1).replace(".", ",")} avg.`} />
            </div>
          </div>
        </div>

        {/* CLIENTS REQUIRING ATTENTION — MOCK table */}
        <div className="bg-white rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,47,52,0.06)]">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="m-0 text-[14px] text-[#002f34] font-extrabold">
              Klienci do działania
              <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-[0.06em] ml-1.5">8 wymaga uwagi</span>
            </h3>
            <Link href="/studio/klienci" className="text-[11.5px] text-slate-500 font-semibold hover:text-orange-600">
              Wszyscy klienci →
            </Link>
          </div>
          <div className="grid gap-0">
            <div className="grid grid-cols-[36px_1.5fr_1fr_1fr_1fr_auto] gap-3 items-center pb-2 text-[10px] uppercase tracking-[0.06em] text-slate-500 font-bold">
              <span />
              <span>Klient</span>
              <span>Status</span>
              <span>Ostatnia sesja</span>
              <span>LTV / pakiet</span>
              <span />
            </div>
            <ClientRow av="KW" avGrad="from-pink-400 to-pink-700" name="Karolina Wójcik" service="Trening siłowy" status="risk" lastSession="42 dni temu" ltv="1 800 zł · 12 sesji" actionLabel="Wyślij ofertę" actionPrimary />
            <ClientRow av="JL" avGrad="from-blue-400 to-blue-700" name="Julia Lewandowska" service="Pakiet 8× · pozostało 5" status="warm" lastSession="dzisiaj, 19:00" ltv="3 600 zł · 24 sesje" actionLabel="Zaproponuj 8×" actionPrimary />
            <ClientRow av="TG" avGrad="from-violet-400 to-violet-700" name="Tomasz Górski" service="Funkcjonalny" status="hot" lastSession="dzisiaj, 16:30" ltv="4 200 zł · 28 sesji" actionLabel="Poproś o opinię" />
            <ClientRow av="AN" avGrad="from-orange-400 to-orange-700" name="Anna Nowak" service="Redukcja + dieta" status="new" lastSession="2 dni temu" ltv="450 zł · 3 sesje" actionLabel="Plan na 30 dni" />
            <ClientRow av="MB" avGrad="from-slate-400 to-slate-700" name="Maciej Bednarczyk" service="Siłownia" status="risk" lastSession="38 dni temu" ltv="1 200 zł · 8 sesji" actionLabel="Wyślij ofertę" actionPrimary />
          </div>
        </div>
      </div>
    </section>
  );
}

function GrowthBlock({ lab, val, unit, sub }: { lab: string; val: string; unit?: string; sub: React.ReactNode }) {
  return (
    <div className="p-3.5 bg-slate-100 rounded-lg">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-slate-500 font-bold mb-1.5">{lab}</div>
      <div className="text-[22px] font-extrabold text-[#002f34] tracking-[-0.025em] leading-none mb-1 tabular-nums">
        {val}{unit && <small className="text-[12px] text-slate-500 font-bold ml-1">{unit}</small>}
      </div>
      <div className="text-[11px] text-slate-700 font-medium">{sub}</div>
    </div>
  );
}

function Insight({
  tone, badge, title, stat, statSmall, body, actLabel,
}: {
  tone: "good" | "warn" | "opp";
  badge: string;
  title: string;
  stat: string;
  statSmall: string;
  body: React.ReactNode;
  actLabel: string;
}) {
  const borderCls =
    tone === "good" ? "border-l-emerald-600" :
    tone === "warn" ? "border-l-amber-500" :
    "border-l-orange-500";
  const badgeCls =
    tone === "good" ? "bg-emerald-50 text-emerald-700" :
    tone === "warn" ? "bg-amber-100 text-amber-800" :
    "bg-orange-50 text-orange-700";
  return (
    <div className={"bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,47,52,0.06)] border-l-[3px] " + borderCls}>
      <span className={"inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-[0.06em] mb-2 " + badgeCls}>
        {badge}
      </span>
      <h4 className="m-0 mb-1.5 text-[14px] text-[#002f34] font-extrabold tracking-[-0.01em] leading-tight">{title}</h4>
      <div className="text-[24px] font-extrabold text-[#002f34] tracking-[-0.02em] mb-1">
        {stat}<small className="text-[12px] text-slate-500 font-semibold ml-1">{statSmall}</small>
      </div>
      <p className="m-0 mb-2.5 text-[12px] text-slate-700 leading-snug">{body}</p>
      <button type="button" className="text-orange-600 hover:text-orange-700 text-[11.5px] font-extrabold inline-flex items-center gap-1">
        {actLabel}
      </button>
    </div>
  );
}

function RankRow({ n, avBg, initials, name, score, me }: { n: number; avBg: string; initials: string; name: string; score: string; me?: boolean }) {
  return (
    <div className="grid grid-cols-[22px_32px_1fr_60px] gap-2.5 items-center text-[12px] py-1.5">
      <span className={"font-bold " + (me ? "text-orange-600" : "text-slate-500")}>{n}</span>
      <span className={"w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center bg-gradient-to-br " + avBg}>
        {initials}
      </span>
      <span className={"text-[#002f34] " + (me ? "font-extrabold" : "font-semibold")}>{name}{me && " (Ty)"}</span>
      <span className="text-slate-600 font-bold text-right tabular-nums">{score}</span>
    </div>
  );
}

function MonthInsight({ icon, tone, title, sub }: { icon: string; tone: "emerald" | "amber" | "blue" | "orange"; title: string; sub: string }) {
  const iconCls =
    tone === "emerald" ? "bg-emerald-50 text-emerald-700" :
    tone === "amber" ? "bg-amber-100 text-amber-800" :
    tone === "blue" ? "bg-blue-50 text-blue-700" :
    "bg-orange-50 text-orange-600";
  return (
    <div className="flex gap-3 items-start">
      <div className={"w-9 h-9 rounded-lg flex items-center justify-center text-[16px] shrink-0 " + iconCls}>{icon}</div>
      <div>
        <div className="text-[13px] text-[#002f34] font-bold mb-0.5">{title}</div>
        <div className="text-[11.5px] text-slate-500">{sub}</div>
      </div>
    </div>
  );
}

function ClientRow({
  av, avGrad, name, service, status, lastSession, ltv, actionLabel, actionPrimary,
}: {
  av: string; avGrad: string; name: string; service: string;
  status: "risk" | "warm" | "hot" | "new";
  lastSession: string; ltv: string; actionLabel: string; actionPrimary?: boolean;
}) {
  const pillCls =
    status === "risk" ? "bg-red-50 text-red-700" :
    status === "warm" ? "bg-amber-100 text-amber-800" :
    status === "hot" ? "bg-emerald-50 text-emerald-700" :
    "bg-orange-50 text-orange-700";
  const pillLabel =
    status === "risk" ? "RYZYKO ⚠" :
    status === "warm" ? "UPSELL 🔥" :
    status === "hot" ? "VIP ⭐" :
    "NOWA 🌱";

  return (
    <div className="grid grid-cols-[36px_1.5fr_1fr_1fr_1fr_auto] gap-3 items-center py-2.5 border-b border-slate-200 text-[12.5px] last:border-b-0">
      <span className={"w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center bg-gradient-to-br " + avGrad}>
        {av}
      </span>
      <span className="text-[#002f34] font-bold">
        {name}
        <small className="block text-[10.5px] text-slate-500 font-medium">{service}</small>
      </span>
      <span>
        <span className={"text-[10.5px] font-extrabold px-1.5 py-0.5 rounded inline-block " + pillCls}>
          {pillLabel}
        </span>
      </span>
      <span className="text-slate-500">{lastSession}</span>
      <span className="text-[#002f34] font-bold">{ltv}</span>
      <button
        type="button"
        className={
          "px-2.5 py-1.5 rounded text-[11.5px] font-bold transition " +
          (actionPrimary
            ? "bg-orange-500 hover:bg-orange-600 text-white"
            : "bg-white border border-slate-300 text-[#002f34] hover:bg-slate-50")
        }
      >
        {actionLabel}
      </button>
    </div>
  );
}
