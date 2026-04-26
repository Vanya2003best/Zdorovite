export default function Spinner({
  size = 36,
  label,
  sub,
}: {
  size?: number;
  label?: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <span
        className="rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin"
        style={{ width: size, height: size }}
        aria-label="Ładowanie"
      />
      {label && (
        <div className="text-center">
          <div className="text-[13px] text-slate-700">{label}</div>
          {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
        </div>
      )}
    </div>
  );
}
