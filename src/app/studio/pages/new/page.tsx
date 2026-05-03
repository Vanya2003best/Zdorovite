import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTrainerPages } from "@/lib/db/trainer-pages";
import { templates } from "@/data/templates";
import { createTrainerPageAndOpenEditor } from "../actions";

const TEMPLATE_OPTIONS = [
  "premium", "cozy",
  "luxury", "studio", "cinematic", "signature",
] as const;

/**
 * Wizard: create a new trainer page. The form is a single server-action
 * submission — no client-side state needed for the happy path. On error,
 * the action redirects back here with ?error=... and we surface the message.
 *
 * Three required choices:
 *   1. Title (free text, what shows in "Moje strony" list)
 *   2. URL slug (kebab-case)
 *   3. Template
 *   4. Seed: scratch / copy from existing page
 */
export default async function NewTrainerPage(props: PageProps<"/studio/pages/new">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/pages/new");

  const sp = await props.searchParams;
  const error = typeof sp?.error === "string" ? sp.error : null;

  const existing = await listTrainerPages(user.id);

  return (
    <div className="mx-auto max-w-[720px] px-4 sm:px-8 py-5 sm:py-10">
      <Link href="/studio/pages" className="text-[13px] text-slate-500 hover:text-slate-900 transition inline-flex items-center gap-1.5 mb-4">
        ← Wróć do listy stron
      </Link>

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Nowa strona</h1>
      <p className="text-[13px] text-slate-600 mt-1.5 mb-7">
        Każda strona ma swój szablon, treść i adres URL. Możesz zacząć od zera lub skopiować zawartość
        z istniejącej strony i dostosować ją do innej grupy odbiorców.
      </p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-5 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <form action={createTrainerPageAndOpenEditor} className="grid gap-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-[13px] font-semibold text-slate-900 mb-1.5">
            Nazwa strony
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="np. Strona B2B · Corporate retreaty"
            maxLength={80}
            className="w-full text-[14px] border border-slate-200 rounded-lg px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <p className="text-[11.5px] text-slate-500 mt-1">Widoczna tylko dla Ciebie w &laquo;Moje strony&raquo;.</p>
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-[13px] font-semibold text-slate-900 mb-1.5">
            Adres URL
          </label>
          <div className="flex items-center gap-2">
            <code className="bg-slate-100 px-2 py-2.5 rounded-lg text-[12px] text-slate-500 shrink-0">
              /trainers/twój-slug/
            </code>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
              placeholder="b2b"
              maxLength={40}
              className="flex-1 text-[14px] font-mono border border-slate-200 rounded-lg px-3.5 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <p className="text-[11.5px] text-slate-500 mt-1">
            Małe litery, cyfry i myślniki. Zarezerwowane: <code>main</code>, <code>p</code>, <code>book</code>, <code>gallery</code>, <code>messages</code>.
          </p>
        </div>

        {/* Template */}
        <div>
          <label className="block text-[13px] font-semibold text-slate-900 mb-2">Szablon</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {TEMPLATE_OPTIONS.map((t, i) => {
              const tpl = templates[t];
              return (
                <label
                  key={t}
                  className="relative cursor-pointer rounded-xl border border-slate-200 p-2.5 hover:border-slate-400 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/30 has-[:checked]:ring-2 has-[:checked]:ring-emerald-100"
                >
                  <input
                    type="radio"
                    name="template"
                    value={t}
                    required
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  <div className={`aspect-video rounded-lg ${tpl?.coverBg ?? "bg-slate-100"} mb-2 border border-slate-200/50`} />
                  <div className="text-[12px] font-semibold capitalize">{tpl?.label ?? t}</div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Seed */}
        <div>
          <label htmlFor="seed" className="block text-[13px] font-semibold text-slate-900 mb-1.5">
            Skąd zacząć
          </label>
          <select
            id="seed"
            name="seed"
            defaultValue="scratch"
            className="w-full text-[14px] border border-slate-200 rounded-lg px-3.5 py-2.5 bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="scratch">Od zera — pusta strona</option>
            {existing.map((p) => (
              <option key={p.id} value={`copy:${p.id}`}>
                Skopiuj z &laquo;{p.title || p.slug}&raquo;
              </option>
            ))}
          </select>
          <p className="text-[11.5px] text-slate-500 mt-1">
            Skopiowanie przenosi tekst, kolory, sekcje. Szablon zostaje wybrany powyżej.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-emerald-500 text-white text-[14px] font-medium hover:bg-emerald-600 transition shadow-[0_10px_30px_rgba(16,185,129,0.18)]"
          >
            Utwórz i otwórz edytor →
          </button>
          <Link
            href="/studio/pages"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full text-[13px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
          >
            Anuluj
          </Link>
        </div>
      </form>
    </div>
  );
}
