import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createService, updateService, deleteService } from "./actions";

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  position: number;
};

export default async function ServicesDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/services");

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration, price, position")
    .eq("trainer_id", user.id)
    .order("position", { ascending: true });

  const list = (services ?? []) as Service[];

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Usługi</h2>
        <p className="text-sm text-slate-600 mt-1">
          Pojedyncze sesje, które klienci mogą rezerwować. {list.length} {list.length === 1 ? "usługa" : "usług"}.
        </p>
      </header>

      {/* Add new service */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-emerald-700 mb-4">
          Dodaj nową usługę
        </h3>
        <form action={createService} className="grid gap-3">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Nazwa usługi (np. Trening personalny)"
            className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
          />
          <textarea
            name="description"
            rows={2}
            maxLength={250}
            placeholder="Opis (opcjonalnie)"
            className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm leading-relaxed"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-[12px] text-slate-500">Czas (min)</span>
              <input
                name="duration"
                type="number"
                min={0}
                max={480}
                step={5}
                defaultValue={60}
                className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[12px] text-slate-500">Cena (zł)</span>
              <input
                name="price"
                type="number"
                min={0}
                max={10000}
                step={1}
                required
                placeholder="150"
                className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            className="h-11 mt-1 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-black transition"
          >
            Dodaj usługę
          </button>
        </form>
      </section>

      {/* Existing services list */}
      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-12 text-center">
          <p className="text-slate-500">Nie dodałeś jeszcze żadnej usługi.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((svc) => (
            <details key={svc.id} className="rounded-2xl border border-slate-200 bg-white group">
              <summary className="list-none cursor-pointer flex items-center justify-between gap-3 px-5 py-4 group-open:border-b group-open:border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <strong className="text-slate-900">{svc.name}</strong>
                    {svc.duration > 0 && (
                      <span className="text-xs text-slate-500">⏱ {svc.duration} min</span>
                    )}
                  </div>
                  {svc.description && (
                    <p className="text-[13px] text-slate-600 mt-1 leading-snug line-clamp-1">
                      {svc.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-900">{svc.price} zł</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 group-open:rotate-180 transition"><path d="M6 9l6 6 6-6" /></svg>
                </div>
              </summary>

              <form action={updateService} className="p-5 grid gap-3">
                <input type="hidden" name="id" value={svc.id} />
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={svc.name}
                  className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                />
                <textarea
                  name="description"
                  rows={2}
                  maxLength={250}
                  defaultValue={svc.description}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm leading-relaxed"
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[12px] text-slate-500">Czas (min)</span>
                    <input
                      name="duration"
                      type="number"
                      min={0}
                      max={480}
                      step={5}
                      defaultValue={svc.duration}
                      className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[12px] text-slate-500">Cena (zł)</span>
                    <input
                      name="price"
                      type="number"
                      min={0}
                      max={10000}
                      step={1}
                      required
                      defaultValue={svc.price}
                      className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm"
                    />
                  </label>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    className="flex-1 h-10 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-black transition"
                  >
                    Zapisz zmiany
                  </button>
                </div>
              </form>
              <form action={deleteService} className="px-5 pb-5">
                <input type="hidden" name="id" value={svc.id} />
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
                >
                  🗑 Usuń usługę
                </button>
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
