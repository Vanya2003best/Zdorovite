import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPackage, updatePackage, deletePackage } from "./actions";

type Pkg = {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period: string | null;
  featured: boolean;
  position: number;
  sessions_total: number | null;
};

export default async function PackagesDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/packages");

  const { data: packages } = await supabase
    .from("packages")
    .select("id, name, description, items, price, period, featured, position, sessions_total")
    .eq("trainer_id", user.id)
    .order("position", { ascending: true });

  const list = (packages ?? []) as Pkg[];

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Pakiety</h2>
        <p className="text-sm text-slate-600 mt-1">
          Pakiety długoterminowe z serii sesji i dodatków. {list.length} {list.length === 1 ? "pakiet" : "pakietów"}. Tylko jeden pakiet może być wyróżniony jako &ldquo;Popularne&rdquo;.
        </p>
      </header>

      {/* Add new package */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-emerald-700 mb-4">
          Dodaj nowy pakiet
        </h3>
        <form action={createPackage} className="grid gap-3">
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Nazwa pakietu (np. Transformacja)"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
          <input
            name="description"
            maxLength={200}
            placeholder="Krótki opis (opcjonalnie)"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
          <label className="grid gap-1">
            <span className="text-[12px] text-slate-500">Co wchodzi w pakiet (po jednym w linii, max 15)</span>
            <textarea
              name="items"
              required
              rows={5}
              maxLength={1500}
              placeholder="12 treningów personalnych&#10;Plan żywieniowy na 12 tygodni&#10;Cotygodniowe konsultacje"
              className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm leading-relaxed font-mono"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="grid gap-1">
              <span className="text-[12px] text-slate-500">Cena (zł)</span>
              <input
                name="price"
                type="number"
                min={0}
                max={100000}
                step={50}
                required
                placeholder="1500"
                className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[12px] text-slate-500">Liczba sesji</span>
              <input
                name="sessions_total"
                type="number"
                min={1}
                max={200}
                step={1}
                placeholder="8"
                className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
              />
              <span className="text-[11px] text-slate-400">Pokaże klientowi pasek &ldquo;X / Y sesji&rdquo;.</span>
            </label>
            <label className="grid gap-1">
              <span className="text-[12px] text-slate-500">Okres (opcjonalnie)</span>
              <input
                name="period"
                type="text"
                maxLength={30}
                placeholder="3 miesiące"
                className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
              />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" name="featured" className="w-4 h-4 accent-emerald-500" />
            <span className="text-[13px] text-slate-700">⭐ Wyróżnij jako &ldquo;Popularne&rdquo; (max 1)</span>
          </label>
          <button
            type="submit"
            className="h-11 mt-1 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-black transition"
          >
            Dodaj pakiet
          </button>
        </form>
      </section>

      {/* Existing packages */}
      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-12 text-center">
          <p className="text-slate-500">Nie dodałeś jeszcze żadnego pakietu.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((pkg) => (
            <details key={pkg.id} className={`rounded-2xl border bg-white group ${pkg.featured ? "border-emerald-400 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.25)]" : "border-slate-200"}`}>
              <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-5 py-4 group-open:border-b group-open:border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <strong className="text-slate-900">{pkg.name}</strong>
                    {pkg.featured && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">⭐ Popularne</span>
                    )}
                    {pkg.period && (
                      <span className="text-xs text-slate-500">{pkg.period}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-500 mt-1">
                    {pkg.items.length} {pkg.items.length === 1 ? "pozycja" : "pozycji"} w pakiecie
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-900">{pkg.price} zł</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 group-open:rotate-180 transition"><path d="M6 9l6 6 6-6" /></svg>
                </div>
              </summary>

              <form action={updatePackage} className="p-5 grid gap-3">
                <input type="hidden" name="id" value={pkg.id} />
                <input
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={pkg.name}
                  className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                />
                <input
                  name="description"
                  maxLength={200}
                  defaultValue={pkg.description}
                  placeholder="Krótki opis (opcjonalnie)"
                  className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                />
                <label className="grid gap-1">
                  <span className="text-[12px] text-slate-500">Pozycje pakietu (po jednej w linii)</span>
                  <textarea
                    name="items"
                    required
                    rows={Math.max(3, pkg.items.length)}
                    maxLength={1500}
                    defaultValue={pkg.items.join("\n")}
                    className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm leading-relaxed font-mono"
                  />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[12px] text-slate-500">Cena (zł)</span>
                    <input
                      name="price"
                      type="number"
                      min={0}
                      max={100000}
                      step={50}
                      required
                      defaultValue={pkg.price}
                      className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[12px] text-slate-500">Liczba sesji</span>
                    <input
                      name="sessions_total"
                      type="number"
                      min={1}
                      max={200}
                      step={1}
                      defaultValue={pkg.sessions_total ?? ""}
                      placeholder="—"
                      className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[12px] text-slate-500">Okres</span>
                    <input
                      name="period"
                      type="text"
                      maxLength={30}
                      defaultValue={pkg.period ?? ""}
                      className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                    />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer mt-1">
                  <input type="checkbox" name="featured" defaultChecked={pkg.featured} className="w-4 h-4 accent-emerald-500" />
                  <span className="text-[13px] text-slate-700">⭐ Wyróżnij jako &ldquo;Popularne&rdquo;</span>
                </label>
                <button
                  type="submit"
                  className="h-10 mt-1 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-black transition"
                >
                  Zapisz zmiany
                </button>
              </form>
              <form action={deletePackage} className="px-5 pb-5">
                <input type="hidden" name="id" value={pkg.id} />
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
                >
                  🗑 Usuń pakiet
                </button>
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
