import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeOnboarding, type ChecklistItem } from "./onboarding-checklist";

/**
 * /studio/start — onboarding wizard / checklist.
 *
 * Read-only page: derives state from existing data (services count, tagline
 * length, etc.) — no separate `onboarding_state` column. Each ☐ item is a
 * deep-link to the editor that fills it. Done state recomputes on every
 * visit, so as the trainer fills in data the wizard collapses naturally.
 *
 * Three tiers:
 *  - "Wymagane" — blocks publishing (tagline / about / 1 service / 1 cert)
 *  - "Polecane" — visible polish (avatar, AI context, specs, hours, gallery, package)
 *  - "Opcjonalne" — nice-to-have (template choice, club affiliation)
 *
 * No nav-item in the sidebar — temporary flow, accessed via /register/trainer
 * post-signup redirect or via the Pulpit banner. Once 100% the page still
 * works (shows green "ukończone" state) but isn't essential.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/start");

  const state = await computeOnboarding(user.id);

  const required = state.items.filter((i) => i.tier === "required");
  const recommended = state.items.filter((i) => i.tier === "recommended");
  const optional = state.items.filter((i) => i.tier === "optional");

  return (
    <div className="mx-auto max-w-[860px] px-4 sm:px-8 py-5 sm:py-10 grid gap-6">
      {/* Hero */}
      <div className="grid gap-2">
        <div className="text-[12.5px] font-semibold tracking-[0.08em] uppercase text-emerald-700">
          Konfiguracja konta
        </div>
        <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] text-slate-900 m-0 leading-[1.1]">
          {state.percent === 100
            ? "Gotowe — profil w pełni skonfigurowany"
            : "Skonfiguruj swój profil"}
        </h1>
        <p className="text-[14px] sm:text-[15px] text-slate-600 m-0 max-w-[640px]">
          {state.readyToPublish
            ? "Wszystkie wymagane pola wypełnione — możesz opublikować profil. Reszta poniżej to polerka."
            : "Wypełnij minimum wymagane do publikacji, potem dodaj resztę dla pełnego efektu."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-slate-700">
            {state.doneCount} z {state.totalCount} ukończonych
          </span>
          <span className="text-[18px] font-semibold tabular-nums text-emerald-700">
            {state.percent}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
            style={{ width: `${state.percent}%` }}
          />
        </div>
        {state.readyToPublish && state.trainerSlug && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={`/trainers/${state.trainerSlug}`}
              target="_blank"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition"
            >
              Zobacz publiczny profil →
            </Link>
            <Link
              href="/studio/design"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 text-[13px] font-medium hover:border-slate-400 transition"
            >
              Edytuj w designie
            </Link>
          </div>
        )}
      </div>

      {/* Required */}
      <ChecklistGroup
        title="Wymagane do publikacji"
        subtitle="Bez tego profil nie pojawi się publicznie."
        items={required}
        accent="rose"
      />

      {/* Recommended */}
      <ChecklistGroup
        title="Polecane"
        subtitle="Dramatycznie zwiększają konwersję — klient widzi profesjonalizm."
        items={recommended}
        accent="amber"
      />

      {/* Optional */}
      <ChecklistGroup
        title="Opcjonalne"
        subtitle="Dla zaawansowanych — możesz to zrobić później."
        items={optional}
        accent="slate"
      />

      {/* Footer link to skip */}
      <div className="pt-4 text-center">
        <Link
          href="/studio"
          className="text-[13px] text-slate-500 hover:text-slate-800 underline-offset-4 hover:underline"
        >
          Wrócę do tego później →
        </Link>
      </div>
    </div>
  );
}

function ChecklistGroup({
  title,
  subtitle,
  items,
  accent,
}: {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
  accent: "rose" | "amber" | "slate";
}) {
  if (items.length === 0) return null;
  const doneCount = items.filter((i) => i.done).length;

  // Tier accent colours match the tier seriousness — rose for blocking,
  // amber for nudge, slate for "whatever". Subtle so the page doesn't
  // feel like a checklist of warnings, just a clear path forward.
  const accentClass = {
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  }[accent];

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-slate-900 m-0">
            {title}
          </h2>
          <p className="text-[12.5px] text-slate-500 m-0 mt-0.5">{subtitle}</p>
        </div>
        <span
          className={`text-[10.5px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full border ${accentClass}`}
        >
          {doneCount}/{items.length}
        </span>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <Link
      href={item.href}
      className={`group flex items-start gap-3 p-4 rounded-xl border transition ${
        item.done
          ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-400"
          : "bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm"
      }`}
    >
      <div
        className={`shrink-0 w-6 h-6 rounded-full border-2 inline-flex items-center justify-center mt-0.5 transition ${
          item.done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "bg-white border-slate-300 group-hover:border-slate-500"
        }`}
      >
        {item.done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-medium ${item.done ? "text-slate-700 line-through decoration-emerald-500/40" : "text-slate-900"}`}>
          {item.label}
        </div>
        <p className="text-[12.5px] text-slate-500 m-0 mt-0.5 leading-[1.5]">
          {item.description}
        </p>
      </div>
      <div className="shrink-0 text-slate-400 group-hover:text-slate-700 transition mt-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
