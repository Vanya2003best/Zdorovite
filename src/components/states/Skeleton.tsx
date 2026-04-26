// Shimmer skeleton primitives. Use Skeleton for free-form blocks; SkeletonCard for the
// trainer-card-shaped placeholder used in catalog/loading states.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:200%_100%] animate-[shimmer_1.4s_linear_infinite] rounded ${className}`}
      style={style}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-3.5 flex gap-3">
      <Skeleton className="!rounded-full w-14 h-14 shrink-0" />
      <div className="flex-1 grid gap-1.5 pt-1">
        <Skeleton className="h-2.5 w-3/5" />
        <Skeleton className="h-2.5 w-4/5" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
    </div>
  );
}
