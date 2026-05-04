import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * Chain landing — /sieci/[chain]. Lists all branches of a gym chain
 * grouped by city, plus a single "join us" CTA for trainer recruiting.
 *
 * Lower-traffic page than the per-branch one (which is the actual QR
 * target). Mostly used by:
 *  - Trainers browsing for clubs to apply to
 *  - Anyone arriving via the /sieci index
 *  - Search engines crawling the full site map
 */
export default async function ChainLanding({
  params,
}: {
  params: Promise<{ chain: string }>;
}) {
  const { chain: chainSlug } = await params;
  const supabase = await createClient();

  const { data: chain } = await supabase
    .from("gym_chains")
    .select("id, name, slug, brand_color, logo_url, website")
    .eq("slug", chainSlug)
    .single();

  if (!chain) notFound();

  const { data: branches } = await supabase
    .from("gym_branches")
    .select("id, name, slug, city, address, recruiting_open")
    .eq("chain_id", chain.id)
    .order("city")
    .order("name");

  // Group branches by city for the layout below.
  const byCity = new Map<string, typeof branches>();
  for (const b of branches ?? []) {
    const list = byCity.get(b.city) ?? [];
    list.push(b);
    byCity.set(b.city, list);
  }
  const cities = Array.from(byCity.entries()).sort(([a], [b]) => a.localeCompare(b, "pl"));
  const recruitingCount = (branches ?? []).filter((b) => b.recruiting_open).length;
  const accent = chain.brand_color ?? "#10b981";

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <section
          className="relative px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-14"
          style={{ background: `linear-gradient(180deg, ${accent}10 0%, transparent 100%)` }}
        >
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-center gap-3 mb-4 text-[12.5px] text-slate-500">
              <Link href="/sieci" className="hover:text-slate-800">Sieci</Link>
              <span>/</span>
              <span className="text-slate-700">{chain.name}</span>
            </div>
            <h1 className="text-[28px] sm:text-[40px] font-semibold tracking-tight text-slate-900 m-0">
              {chain.name}
            </h1>
            <p className="text-[14px] sm:text-[15px] text-slate-600 mt-2 max-w-[640px]">
              {(branches?.length ?? 0)} {(branches?.length ?? 0) === 1 ? "klub" : "klubów"}
              {recruiting_open_label(recruitingCount)}
            </p>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-10">
          <div className="max-w-[1200px] mx-auto">
            {cities.length === 0 ? (
              <p className="text-slate-500">Brak klubów na liście. Wkrótce dodamy.</p>
            ) : (
              cities.map(([city, list]) => (
                <div key={city} className="mb-10">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold text-slate-900 mb-4">
                    {city}
                  </h2>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {(list ?? []).map((b) => (
                      <Link
                        key={b.id}
                        href={`/sieci/${chain.slug}/${b.slug}`}
                        className="bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-sm transition p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 m-0">
                            {b.name}
                          </h3>
                          {b.recruiting_open && (
                            <span
                              className="text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full text-white shrink-0"
                              style={{ background: accent }}
                            >
                              Rekrutuje
                            </span>
                          )}
                        </div>
                        {b.address && (
                          <p className="text-[12.5px] text-slate-600 line-clamp-2">
                            📍 {b.address}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function recruiting_open_label(n: number): string {
  if (n === 0) return "";
  return ` · ${n} ${n === 1 ? "klub szuka trenerów" : n < 5 ? "kluby szukają trenerów" : "klubów szuka trenerów"}`;
}
