import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTrainerPages } from "@/lib/db/trainer-pages";
import { templates } from "@/data/templates";
import type { TemplateName } from "@/types";
import PageRowActions from "./PageRowActions";

/**
 * Moje strony — list every page the trainer owns. Each row links to the
 * design editor scoped to that page. Primary page is highlighted with a
 * green badge; promote/delete/publish-toggle controls are next to each row.
 *
 * The "Nowa strona" CTA opens the wizard at /studio/pages/new.
 */
export default async function StudioPages() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/pages");

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug, customization")
    .eq("id", user.id)
    .maybeSingle();
  if (!trainer) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10">
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
          <p className="text-slate-500">Najpierw dokończ rejestrację jako trener.</p>
          <Link
            href="/account/become-trainer"
            className="inline-flex mt-4 h-10 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
          >
            Stań się trenerem →
          </Link>
        </div>
      </div>
    );
  }

  const pages = await listTrainerPages(user.id);
  // Primary page's stored template can be stale — design editor writes to
  // trainers.customization, not to trainer_pages. Resolve at render time.
  const masterTemplate: TemplateName = (trainer.customization as { template?: TemplateName })?.template ?? "premium";

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-5 sm:py-10 grid gap-5">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Moje strony</h1>
          <p className="text-[13px] text-slate-600 mt-1 max-w-[640px]">
            Każda strona to oddzielna prezentacja Ciebie — z własnym szablonem, treścią i adresem URL.
            Strona <strong>Główna</strong> jest pokazywana pod{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">nazdrow.pl/trainers/{trainer.slug}</code>;
            pozostałe strony żyją pod{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">/{trainer.slug}/&#123;url&#125;</code>.
          </p>
        </div>
        <Link
          href="/studio/pages/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-emerald-500 text-white text-[13px] font-medium hover:bg-emerald-600 transition shadow-[0_10px_30px_rgba(16,185,129,0.18)]"
        >
          <span className="text-lg leading-none">+</span> Nowa strona
        </Link>
      </header>

      {pages.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 px-8 text-center">
          <p className="text-slate-700 font-medium">Nie masz jeszcze żadnej strony.</p>
          <p className="text-[13px] text-slate-500 mt-1.5 max-w-[480px] mx-auto">
            Zwykle automatycznie tworzymy &laquo;Główną stronę&raquo; przy rejestracji. Jeśli jej brakuje,
            uruchom migrację <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">015_trainer_pages.sql</code> w Supabase Dashboard.
          </p>
          <Link
            href="/studio/pages/new"
            className="inline-flex mt-5 h-10 items-center px-5 rounded-full bg-slate-900 text-white text-[13px] font-medium hover:bg-black transition"
          >
            Utwórz pierwszą stronę →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {pages.map((p) => {
            const effectiveTemplate = p.isPrimary ? masterTemplate : p.template;
            const tpl = templates[effectiveTemplate];
            const publicUrl = p.isPrimary
              ? `/trainers/${trainer.slug}`
              : `/trainers/${trainer.slug}/${p.slug}`;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border bg-white p-5 sm:p-6 flex flex-wrap items-center gap-4 transition ${
                  p.isPrimary ? "border-emerald-300 shadow-[0_4px_14px_rgba(16,185,129,0.08)]" : "border-slate-200"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl ${tpl?.coverBg ?? "bg-slate-100"} shrink-0 border border-slate-200`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-[15px] tracking-tight">{p.title || p.slug}</strong>
                    {p.isPrimary && (
                      <span className="text-[10px] font-semibold tracking-[0.1em] uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Główna
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full ${
                        p.status === "published"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.status === "published" ? "Opublikowana" : "Szkic"}
                    </span>
                  </div>
                  <div className="text-[12px] text-slate-500 mt-1 truncate">
                    Szablon: <strong className="text-slate-700">{tpl?.label ?? p.template}</strong>
                    {" · "}URL:{" "}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10.5px]">{publicUrl}</code>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Link
                    href={`/studio/design?page=${p.id}`}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12px] font-medium text-slate-700 border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    Edytuj →
                  </Link>
                  <PageRowActions
                    pageId={p.id}
                    isPrimary={p.isPrimary}
                    isPublished={p.status === "published"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
