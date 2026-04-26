type Step = { label: string; status: "done" | "active" | "pending" };

export default function ProgressSteps({
  title,
  sub,
  steps,
  pct,
}: {
  title?: string;
  sub?: string;
  steps: Step[];
  pct?: number; // 0–100
}) {
  return (
    <div className="grid gap-3 max-w-[300px] mx-auto py-6 text-center">
      {title && <h3 className="text-[15px] font-semibold tracking-tight m-0">{title}</h3>}
      {sub && <p className="text-[12px] text-slate-500 m-0">{sub}</p>}
      {typeof pct === "number" && (
        <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
          <div
            className="h-full bg-[linear-gradient(135deg,#10b981,#14b8a6)] bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      )}
      <ul className="grid gap-1.5 text-left">
        {steps.map((s, i) => (
          <li key={i} className={`flex gap-2.5 items-center text-[12px] ${s.status === "pending" ? "text-slate-400" : "text-slate-700"}`}>
            <span
              className={`w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 ${
                s.status === "done"
                  ? "bg-emerald-500 text-white"
                  : s.status === "active"
                    ? "bg-white border-2 border-emerald-500"
                    : "bg-slate-100"
              }`}
            >
              {s.status === "done" && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
              {s.status === "active" && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
            </span>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
