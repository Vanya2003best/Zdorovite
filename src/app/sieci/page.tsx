import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * /sieci — index of all gym chains on NaZdrow!. Low-traffic page mainly
 * used by trainers browsing for clubs to apply to + as the SEO landing
 * for "kluby fitness" type queries.
 *
 * Lists active chains as cards (logo placeholder, branch count,
 * recruiting count). Click → /sieci/[chain] for branch list.
 */
export default async function SieciIndex() {
  const supabase = await createClient();

  // Pull chains + branch aggregates in two queries — could be one with a
  // grouped subquery but Supabase's PostgREST is awkward for that and
  // chains are <20 rows for years to come, so cost is negligible.
  const { data: chains } = await supabase
    .from("gym_chains")
    .select("id, name, slug, brand_color, logo_url, website")
    .eq("status", "active")
    .order("name");

  const { data: branches } = await supabase
    .from("gym_branches")
    .select("chain_id, recruiting_open")
    .eq("status", "active");

  // Aggregate branch counts per chain client-side.
  const stats = new Map<string, { total: number; recruiting: number }>();
  for (const b of branches ?? []) {
    const s = stats.get(b.chain_id) ?? { total: 0, recruiting: 0 };
    s.total += 1;
    if (b.recruiting_open) s.recruiting += 1;
    stats.set(b.chain_id, s);
  }

  return (
    <div className="min-h-screen bg-slate-50">
        <section className="px-4 sm:px-6 pt-12 pb-8 sm:pt-16">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-center gap-2 mb-4 text-[12.5px] text-slate-500">
              <Link href="/" className="hover:text-slate-800">Główna</Link>
              <span>/</span>
              <span className="text-slate-700">Sieci klubów</span>
            </div>
            <h1 className="text-[28px] sm:text-[40px] font-semibold tracking-tight text-slate-900 m-0">
              Sieci klubów
            </h1>
            <p className="text-[14px] sm:text-[15px] text-slate-600 mt-2 max-w-[640px]">
              Trenerzy NaZdrow! pracują w {chains?.length ?? 0} sieciach fitness.
              Wybierz sieć żeby zobaczyć kluby + dostępne wakaty trenerskie.
            </p>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-16">
          <div className="max-w-[1200px] mx-auto grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {(chains ?? []).map((c) => {
              const s = stats.get(c.id) ?? { total: 0, recruiting: 0 };
              const accent = c.brand_color ?? "#10b981";
              return (
                <Link
                  key={c.id}
                  href={`/sieci/${c.slug}`}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-sm transition p-5 flex flex-col gap-3 relative overflow-hidden"
                >
                  <span
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: accent }}
                  />
                  <div className="flex items-start justify-between gap-3 mt-1">
                    <h2 className="text-[18px] font-semibold tracking-tight text-slate-900 m-0">
                      {c.name}
                    </h2>
                    {s.recruiting > 0 && (
                      <span
                        className="text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full text-white shrink-0"
                        style={{ background: accent }}
                      >
                        {s.recruiting} {s.recruiting === 1 ? "wakat" : "wakatów"}
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-slate-600 m-0">
                    {s.total === 0
                      ? "Brak klubów"
                      : `${s.total} ${s.total === 1 ? "klub" : s.total < 5 ? "kluby" : "klubów"}`}
                  </p>
                </Link>
              );
            })}
          </div>
          {(chains?.length ?? 0) === 0 && (
            <div className="max-w-[760px] mx-auto rounded-2xl border-2 border-dashed border-slate-300 py-12 text-center mt-8">
              <p className="text-slate-500 mb-4">
                Jeszcze żadna sieć nie dołączyła. Twoja może być pierwsza.
              </p>
              <Link
                href="/dodaj-klub"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition"
              >
                Dodaj swój klub →
              </Link>
            </div>
          )}
        </section>
    </div>
  );
}
