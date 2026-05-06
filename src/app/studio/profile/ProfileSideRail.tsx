import Link from "next/link";

export default function ProfileSideRail({
  slug,
  displayName,
  tagline,
  avatarUrl,
  avatarFocal,
  completionPct,
  completionItems,
}: {
  slug: string;
  displayName: string;
  tagline: string;
  avatarUrl: string | null;
  avatarFocal: string | null;
  completionPct: number;
  completionItems: { label: string; done: boolean }[];
}) {
  // Use the focal point as background-position when present so the
  // preview matches what /trainers/[slug] renders.
  const focal = (avatarFocal ?? "50% 30%").trim() || "50% 30%";

  return (
    <aside className="space-y-4 xl:sticky xl:top-[120px]">
      {/* Public preview tile */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200">
          <h3 className="text-[13.5px] font-semibold m-0">Podgląd publiczny</h3>
          <Link
            href={`/trainers/${slug}`}
            target="_blank"
            className="text-[11.5px] text-emerald-600 font-semibold hover:underline"
          >
            Otwórz ↗
          </Link>
        </div>
        <div
          className="relative aspect-[4/3] bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden border-b border-slate-200"
          style={
            avatarUrl
              ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: focal }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
          <div className="absolute inset-x-3.5 bottom-3.5 text-white">
            <div className="text-[16px] font-semibold leading-tight truncate">
              {displayName || "Twój trener"}
            </div>
            {tagline && (
              <div className="text-[11.5px] opacity-90 line-clamp-2 mt-0.5">{tagline}</div>
            )}
          </div>
        </div>
        <div className="px-5 py-3 text-[11.5px] text-slate-500 flex justify-between gap-3">
          <span className="truncate">
            Szablon · <b className="text-slate-800 font-semibold">Premium</b>
          </span>
          <span className="truncate">
            nazdrow.pl/trainers/<b className="text-slate-800 font-semibold">{slug}</b>
          </span>
        </div>
      </div>

      {/* Completion */}
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
                  "w-3.5 h-3.5 rounded-full shrink-0 " +
                  (it.done ? "bg-emerald-500" : "bg-slate-200")
                }
              />
              {it.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Tip */}
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
