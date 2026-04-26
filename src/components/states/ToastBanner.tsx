// Inline (non-floating) success/info banner — variant="banner" matches the design's
// pale-green soft card; variant="dark" matches the dark floating toast.

export default function ToastBanner({
  title,
  description,
  variant = "banner",
  icon,
}: {
  title: string;
  description?: string;
  variant?: "banner" | "dark";
  icon?: React.ReactNode;
}) {
  if (variant === "dark") {
    return (
      <div className="inline-flex items-center gap-3 max-w-sm min-w-[260px] bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-[0_12px_28px_-8px_rgba(2,6,23,.4)]">
        <span className="w-8 h-8 rounded-full bg-emerald-500 inline-flex items-center justify-center shrink-0">
          {icon ?? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          )}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          {description && <div className="text-[11px] text-white/60 mt-0.5 truncate">{description}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 items-start max-w-sm bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-3.5">
      <span className="w-8 h-8 rounded-full bg-white border border-emerald-200 text-emerald-600 inline-flex items-center justify-center shrink-0">
        {icon ?? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-slate-900">{title}</div>
        {description && <div className="text-[12px] text-slate-600 mt-0.5 leading-snug">{description}</div>}
      </div>
    </div>
  );
}
