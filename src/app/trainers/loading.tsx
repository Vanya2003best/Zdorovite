import { SkeletonCard } from "@/components/states/Skeleton";

export default function TrainersLoading() {
  return (
    <div>
      <section className="bg-gradient-to-b from-green-50 to-white border-b border-slate-200">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-6 pb-7">
          <div className="h-3 w-40 bg-slate-200/70 rounded mb-4" />
          <div className="h-8 sm:h-10 w-2/3 bg-slate-200/70 rounded mb-3" />
          <div className="h-4 w-2/5 bg-slate-200/70 rounded mb-6" />
          <div className="hidden sm:block h-[68px] bg-white border border-slate-200 rounded-2xl max-w-[960px]" />
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
