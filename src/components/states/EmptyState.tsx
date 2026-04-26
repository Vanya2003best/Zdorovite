import Link from "next/link";

type Action = { label: string; href: string; primary?: boolean; onClick?: never } | { label: string; onClick: () => void; primary?: boolean; href?: never };

export default function EmptyState({
  icon,
  title,
  description,
  actions = [],
  variant = "centered",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: Action[];
  variant?: "centered" | "compact";
}) {
  return (
    <div className={`flex flex-col items-center text-center ${variant === "centered" ? "py-12" : "py-6"}`}>
      {icon && (
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 inline-flex items-center justify-center text-emerald-600 mb-4">
          <span className="absolute -inset-2 rounded-[28px] border border-dashed border-emerald-200/60" />
          {icon}
        </div>
      )}
      <h3 className="text-[17px] font-semibold tracking-tight text-slate-900 mb-1.5">{title}</h3>
      {description && (
        <p className="text-[13px] text-slate-600 leading-relaxed max-w-[300px] mb-4">{description}</p>
      )}
      {actions.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center">
          {actions.map((a, i) => {
            const cls = a.primary
              ? "h-10 px-4 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-black transition inline-flex items-center"
              : "h-10 px-4 bg-white text-slate-800 border border-slate-200 rounded-lg text-[13px] font-medium hover:border-slate-400 transition inline-flex items-center";
            if ("href" in a && a.href) return <Link key={i} href={a.href} className={cls}>{a.label}</Link>;
            return <button key={i} type="button" onClick={a.onClick} className={cls}>{a.label}</button>;
          })}
        </div>
      )}
    </div>
  );
}
