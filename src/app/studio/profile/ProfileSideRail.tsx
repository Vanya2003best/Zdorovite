import Link from "next/link";

/**
 * Right rail — completion checklist + tip. The public-preview photo
 * card was intentionally removed (the trainer's avatar is already
 * visible in the Profil podstawowy hero on the left).
 */
export default function ProfileSideRail({
  completionPct,
  completionItems,
}: {
  completionPct: number;
  completionItems: { label: string; done: boolean }[];
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-[120px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-end justify-between">
          <h3 className="text-[13.5px] font-semibold m-0">Profil ukończony</h3>
          <div className="text-[24px] font-semibold tracking-[-0.02em] text-emerald-700">
            {completionPct}%
          </div>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden my-3">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <ul className="space-y-1.5 m-0 p-0 list-none">
          {completionItems.map((it) => (
            <li
              key={it.label}
              className={
                "text-[12px] flex items-center gap-2 " + (it.done ? "text-slate-500" : "text-slate-700")
              }
            >
              <span
                className={
                  "w-3.5 h-3.5 rounded-full shrink-0 " + (it.done ? "bg-emerald-500" : "bg-slate-200")
                }
              />
              {it.label}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{
          background: "linear-gradient(135deg,#f0fdfa,#ecfdf5)",
          borderColor: "#a7f3d0",
        }}
      >
        <h3 className="m-0 mb-1.5 text-[13.5px] font-semibold">💡 Wskazówka</h3>
        <p className="text-[12px] text-slate-700 m-0 leading-[1.55]">
          Profile z galerią mają średnio <b>2.3× więcej rezerwacji</b>. Dodaj 6–8 zdjęć ze studia
          lub z treningów w{" "}
          <Link href="/studio/design#gallery" className="text-emerald-700 font-semibold hover:underline">
            edytorze
          </Link>
          .
        </p>
      </div>
    </aside>
  );
}
