import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization, SectionId, TemplateName } from "@/types";
import { getTrainerBySlug } from "@/lib/db/trainers";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/db/notifications";
import EditorClient from "./EditorClient";
import type { DayRule } from "@/app/studio/availability/types";
import PremiumProfile from "@/app/trainers/[id]/PremiumProfile";
import CinematicProfile from "@/app/trainers/[id]/CinematicProfile";
import SignatureProfile from "@/app/trainers/[id]/SignatureProfile";
import LuxuryProfile from "@/app/trainers/[id]/LuxuryProfile";
import StudioProfile from "@/app/trainers/[id]/StudioProfile";
import TemplateProfile from "@/app/trainers/[id]/TemplateProfile";
import { getTrainerPageById, listTrainerPages } from "@/lib/db/trainer-pages";

const SECTION_IDS: SectionId[] = ["about", "cases", "services", "packages", "gallery", "certifications", "reviews"];

const DEFAULT_CUSTOMIZATION: ProfileCustomization = {
  template: "premium",
  accentColor: "#10b981",
  sections: SECTION_IDS.map((id) => ({ id, visible: true })),
  serviceLayout: "cards",
  galleryLayout: "grid",
};

function computeCompletion(t: {
  tagline: string | null;
  about: string | null;
  avatar_url: string | null;
  specs: number;
  services: number;
  packages: number;
  certifications: number;
  gallery: number;
}) {
  const checks = [
    { ok: !!t.tagline && t.tagline.trim().length >= 10, weight: 15, miss: "Dodaj tagline (min. 10 znaków)" },
    { ok: !!t.about && t.about.trim().length >= 80, weight: 20, miss: "Rozbuduj sekcję „O mnie” (min. 80 znaków)" },
    { ok: !!t.avatar_url, weight: 10, miss: "Dodaj zdjęcie profilowe" },
    { ok: t.specs >= 2, weight: 10, miss: "Wybierz min. 2 specjalizacje" },
    { ok: t.services >= 1, weight: 15, miss: "Dodaj pierwszą usługę" },
    { ok: t.packages >= 1, weight: 10, miss: "Dodaj pakiet długoterminowy" },
    { ok: t.gallery >= 3, weight: 10, miss: "Dodaj min. 3 zdjęcia do galerii" },
    { ok: t.certifications >= 1, weight: 10, miss: "Dodaj certyfikat" },
  ];
  const pct = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const firstMiss = checks.find((c) => !c.ok);
  const tip = pct >= 100 ? "Świetnie — profil jest kompletny!" : (firstMiss?.miss ?? "Uzupełnij brakujące pola.");
  return { pct, tip };
}

export default async function DesignDashboard(props: PageProps<"/studio/design">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/design");

  // ?page={uuid} → scope all edits to that trainer_pages row (a secondary
  // page). Without it, edits go to the legacy primary path (trainers.customization).
  const sp = await props.searchParams;
  const pageId = typeof sp?.page === "string" ? sp.page : undefined;

  // Try with avatar_focal (migration 020) — fall back to without on 42703.
  let profile: { display_name: string | null; avatar_url: string | null; avatar_focal?: string | null } | null = null;
  const profileFull = await supabase
    .from("profiles")
    .select("display_name, avatar_url, avatar_focal")
    .eq("id", user.id)
    .single();
  if (profileFull.error?.code === "42703") {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data ? { ...data, avatar_focal: null } : null;
  } else {
    profile = profileFull.data;
  }

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug, published, customization")
    .eq("id", user.id)
    .maybeSingle();

  if (!trainer?.slug) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
        <p className="text-slate-500">Najpierw dokończ rejestrację jako trener.</p>
        <Link
          href="/account/become-trainer"
          className="inline-flex mt-4 h-10 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
        >
          Stań się trenerem →
        </Link>
      </div>
    );
  }

  const [
    { count: servicesCount },
    { count: packagesCount },
    { count: reviewsCount },
    { count: specsCount },
    { count: galleryCountRaw },
    { count: certificationsCountRaw },
    { data: availabilityRules },
    fullTrainer,
  ] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("trainer_specializations").select("specialization_id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("gallery_photos").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("certifications").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("availability_rules").select("day_of_week, start_time, end_time").eq("trainer_id", user.id),
    getTrainerBySlug(trainer.slug),
  ]);

  const availabilityByDow: Record<number, DayRule | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  };
  (availabilityRules ?? []).forEach((r) => {
    availabilityByDow[r.day_of_week] = {
      start: String(r.start_time).slice(0, 5),
      end: String(r.end_time).slice(0, 5),
    };
  });

  // Notifications for the editor's own top bar (the layout's TopBar is hidden on /studio/design).
  // Page-scoped customization fetch (when ?page={id}) is in this same batch so
  // the secondary-page swap doesn't add an extra round-trip on top of the
  // already-parallelised trainer-level queries above.
  const [recentNotifs, unreadNotifs, trainerPages, pageScopedRow] = await Promise.all([
    getRecentNotifications(user.id, 12),
    getUnreadNotificationCount(user.id),
    listTrainerPages(user.id),
    pageId ? getTrainerPageById(pageId) : Promise.resolve(null),
  ]);

  const galleryCount = galleryCountRaw ?? 0;
  const certificationsCount = certificationsCountRaw ?? 0;

  const completion = computeCompletion({
    tagline: fullTrainer?.tagline ?? null,
    about: fullTrainer?.about ?? null,
    avatar_url: profile?.avatar_url ?? null,
    specs: specsCount ?? 0,
    services: servicesCount ?? 0,
    packages: packagesCount ?? 0,
    certifications: certificationsCount,
    gallery: galleryCount,
  });

  // When ?page={id} is set, the editor scopes to a secondary trainer_pages row.
  // Pull THAT page's customization to seed initial state + preview; ignore the
  // legacy trainers.customization. If pageId points to a row that doesn't
  // belong to the current user (or doesn't exist), fall through to primary.
  // The fetch itself runs in the Promise.all batch above; here we just guard
  // ownership.
  let pageScoped: { customization: Partial<ProfileCustomization> } | null = null;
  if (pageId && pageScopedRow && pageScopedRow.trainerId === user.id) {
    pageScoped = { customization: pageScopedRow.customization };
  }

  // Hydrate customization with defaults + ensure all known sections present in saved order.
  const saved = (pageScoped?.customization ?? trainer.customization ?? {}) as Partial<ProfileCustomization>;
  const seen = new Set<SectionId>();
  const orderedSections = (saved.sections ?? [])
    .filter((s) => SECTION_IDS.includes(s.id) && !seen.has(s.id) && (seen.add(s.id), true))
    .map((s) => ({ id: s.id, visible: !!s.visible }));
  for (const id of SECTION_IDS) {
    if (!seen.has(id)) orderedSections.push({ id, visible: true });
  }
  const initial: ProfileCustomization = {
    template: (saved.template ?? DEFAULT_CUSTOMIZATION.template) as TemplateName,
    accentColor: saved.accentColor ?? DEFAULT_CUSTOMIZATION.accentColor,
    sections: orderedSections,
    serviceLayout: saved.serviceLayout ?? "cards",
    galleryLayout: saved.galleryLayout ?? "grid",
    coverImage: saved.coverImage,
  };

  // Cases live in customization.studioCopy.cases (Studio template only). Count
  // them here so the "Prace" toggle in the sidebar shows the same N indicator
  // as services/packages.
  const casesCount =
    ((saved as { studioCopy?: { cases?: unknown[] } } | null | undefined)?.studioCopy?.cases?.length) ?? 0;
  const counts: Partial<Record<SectionId, number>> = {
    cases: casesCount,
    services: servicesCount ?? 0,
    packages: packagesCount ?? 0,
    gallery: galleryCount,
    certifications: certificationsCount,
    reviews: reviewsCount ?? 0,
  };

  // === Render the actual client-facing profile inside the editor canvas ===
  // We pass the rendered JSX as `previewSlot` to EditorClient. Because EditorClient
  // is a client component, the server-rendered profile JSX is preserved as-is and
  // re-rendered by Next on router.refresh() (which the editor calls after each
  // debounced save). This is the no-iframe path: same DOM as /trainers/[slug],
  // with isEmbed=true to suppress site chrome (header, breadcrumbs, mobile CTA,
  // owner FAB) and editMode=true to swap inline editors in. The public route
  // /trainers/[id] no longer has its own edit mode — this canvas is the only
  // editor.
  let previewSlot: React.ReactNode = null;
  if (fullTrainer) {
    // When scoped to a secondary page, swap fullTrainer.customization for the
    // page's customization so the preview reflects what the trainer is editing.
    const trainerForPreview = pageScoped
      ? { ...fullTrainer, customization: { ...fullTrainer.customization, ...pageScoped.customization } as ProfileCustomization }
      : fullTrainer;
    const sharedProps = {
      trainer: trainerForPreview,
      trainerDbId: user.id,
      editMode: true,
      isOwner: true,
      published: !!trainer.published,
      initialIsFavorite: false,
      needsLoginToFavorite: false,
      isEmbed: true as const,
    };
    if (initial.template === "premium") {
      previewSlot = <PremiumProfile {...sharedProps} />;
    } else if (initial.template === "cinematic") {
      previewSlot = <CinematicProfile {...sharedProps} />;
    } else if (initial.template === "signature") {
      previewSlot = <SignatureProfile {...sharedProps} />;
    } else if (initial.template === "luxury") {
      previewSlot = <LuxuryProfile {...sharedProps} />;
    } else if (initial.template === "studio") {
      previewSlot = <StudioProfile {...sharedProps} />;
    } else {
      previewSlot = <TemplateProfile {...sharedProps} />;
    }
  }

  // History/redo depth drives the Cofnij/Powtórz button enabled state. Both
  // come from the same `saved` source so they reflect the page being edited.
  const historyDepth = ((saved as ProfileCustomization | null | undefined)?._history ?? []).length;
  const redoDepth = ((saved as ProfileCustomization | null | undefined)?._redoStack ?? []).length;
  const hasCinematicCopy = !!(saved as ProfileCustomization | null | undefined)?.cinematicCopy;

  return (
    <EditorClient
      slug={trainer.slug}
      trainerId={user.id}
      trainerName={profile?.display_name ?? "Twój profil"}
      trainerEmail={user.email ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      avatarFocal={profile?.avatar_focal ?? null}
      published={!!trainer.published}
      initial={initial}
      completion={completion}
      counts={counts}
      availabilityByDow={availabilityByDow}
      notifications={{ recent: recentNotifs, unread: unreadNotifs }}
      previewSlot={previewSlot}
      historyDepth={historyDepth}
      redoDepth={redoDepth}
      hasCinematicCopy={hasCinematicCopy}
      pageId={pageId}
      pages={trainerPages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        // Primary page's "live" template lives on trainers.customization, not on
        // trainer_pages.template — design editor writes only to the former. Resolve
        // here so the row preview matches what visitors actually see.
        template: p.isPrimary
          ? ((trainer.customization as { template?: TemplateName })?.template ?? p.template)
          : p.template,
        isPrimary: p.isPrimary,
        status: p.status,
      }))}
    />
  );
}
