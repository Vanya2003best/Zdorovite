import Image from "next/image";
import Link from "next/link";
import { getAvailableSlots } from "@/lib/db/availability";
import { warsawDateOffset } from "@/lib/time";
import type { Trainer, Service, SectionId } from "@/types";
import { getSpecLabel, getSpecIcon } from "@/data/specializations";
import BookingSidebar from "./BookingSidebar";
import EditableTrainerField from "./EditableTrainerField";
import EditableSpecializations from "./EditableSpecializations";
import PremiumReviewsList from "./PremiumReviewsList";
import PremiumSectionNav from "./PremiumSectionNav";
import SectionAITextButton from "./SectionAITextButton";
import SectionAIServicesButton from "./SectionAIServicesButton";
import SectionAIPackagesButton from "./SectionAIPackagesButton";
import { generateAboutVariants, applyAboutVariant } from "./ai-actions";
import { AI_PILL_THEMES } from "./ai-pill-themes";
import EditableCover from "./EditableCover";
import PremiumGalleryEditor from "./PremiumGalleryEditor";
import PremiumGalleryView from "./PremiumGalleryView";
import EditableStudioCopy from "./EditableStudioCopy";
import FavoriteButton from "./FavoriteButton";
import InlineServicesEditor from "./InlineServicesEditor";
import InlinePackagesEditor from "./InlinePackagesEditor";
import { applyServiceOverrides, applyPackageOverrides } from "./apply-overrides";

/* ================================================================
   PREMIUM TEMPLATE — full desktop + mobile design
   ================================================================ */
export default async function PremiumProfile({
  trainer,
  trainerDbId,
  editMode,
  isOwner,
  published,
  initialIsFavorite,
  needsLoginToFavorite,
  isEmbed = false,
}: {
  trainer: Trainer;
  trainerDbId: string | undefined;
  editMode: boolean;
  isOwner: boolean;
  published: boolean;
  initialIsFavorite: boolean;
  needsLoginToFavorite: boolean;
  /** When true (used by /studio/design preview), hides nav chrome that doesn't make sense in-editor. */
  isEmbed?: boolean;
}) {
  const initialDate = warsawDateOffset(0);
  const initialSlots = trainerDbId && !editMode ? await getAvailableSlots(trainerDbId, initialDate) : [];
  const services = applyServiceOverrides(trainer.services, trainer.customization);
  const packages = applyPackageOverrides(trainer.packages, trainer.customization);
  const servicesWithIds = services.filter((s): s is Service & { id: string } => !!s.id);
  const c = trainer.customization;
  const visibleSections = c.sections.filter((sec) => sec.visible);
  // Per-page specializations override — falls back to the trainer's global
  // list when this page hasn't customised it yet.
  const effectiveSpecs = c.specializations ?? trainer.specializations;
  const sectionLabels: Record<SectionId, string> = {
    about: "O mnie",
    // `cases` is Studio-only; Premium doesn't render it but we include the
    // entry so the type-check on Record<SectionId> passes.
    cases: "Prace",
    services: "Usługi",
    packages: "Pakiety",
    gallery: "Galeria",
    certifications: "Certyfikaty",
    reviews: "Opinie",
  };

  // Premium reuses studioCopy for section copy (it has no dedicated copy bag).
  // Cases header (casesLabel/H2/Sub) was already wired this way; the same
  // pattern now covers about / services / packages / gallery / certifications
  // / reviews so every section's eyebrow + headline + optional subtitle can
  // be edited inline. EditableStudioCopy writes through studio-copy-actions
  // which already allowlists each *Label / *H2 / *Sub key.
  const studioCopyShared = trainer.customization.studioCopy ?? {};
  type StudioCopyKey =
    | "aboutLabel" | "aboutH2" | "aboutSub"
    | "servicesLabel" | "servicesH2" | "servicesSub"
    | "packagesLabel" | "packagesH2" | "packagesSub"
    | "galleryLabel" | "galleryH2" | "gallerySub"
    | "certificationsLabel" | "certificationsH2" | "certificationsSub"
    | "reviewsLabel" | "reviewsH2" | "reviewsSub";
  const Hdr = ({
    labelKey,
    labelFb,
    h2Key,
    h2Fb,
    subKey,
    subFb,
    h2ClassName = "text-[32px] font-semibold tracking-tight mt-2 mb-5",
  }: {
    labelKey: StudioCopyKey;
    labelFb: string;
    h2Key: StudioCopyKey;
    h2Fb: string;
    subKey?: StudioCopyKey;
    subFb?: string;
    h2ClassName?: string;
  }) => {
    const labelVal = studioCopyShared[labelKey];
    const h2Val = studioCopyShared[h2Key];
    const subVal = subKey ? studioCopyShared[subKey] : undefined;
    return (
      <>
        <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
          {editMode ? (
            <EditableStudioCopy
              field={labelKey}
              initial={typeof labelVal === "string" ? labelVal : undefined}
              defaultValue={labelFb}
              accentColor="#10b981"
              rich={false}
              maxLength={60}
            />
          ) : (
            (typeof labelVal === "string" ? labelVal : null) ?? labelFb
          )}
        </span>
        <h2 className={h2ClassName}>
          {editMode ? (
            <EditableStudioCopy
              field={h2Key}
              initial={typeof h2Val === "string" ? h2Val : undefined}
              defaultValue={h2Fb}
              accentColor="#10b981"
              rich
              maxLength={120}
            />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: (typeof h2Val === "string" ? h2Val : null) ?? h2Fb }} />
          )}
        </h2>
        {subKey && (editMode || (typeof subVal === "string" && subVal)) && (
          <p className="text-[15px] text-slate-600 mb-6 max-w-[640px]">
            {editMode ? (
              <EditableStudioCopy
                field={subKey}
                initial={typeof subVal === "string" ? subVal : undefined}
                defaultValue={subFb ?? ""}
                placeholder="Opcjonalny podtytuł sekcji…"
                accentColor="#10b981"
                rich={false}
                multiline
                block
                maxLength={250}
              />
            ) : (
              (typeof subVal === "string" ? subVal : null)
            )}
          </p>
        )}
      </>
    );
  };

  return (
    <div
      className="@container min-h-screen bg-[radial-gradient(800px_400px_at_10%_-10%,rgba(16,185,129,0.08),transparent_60%),radial-gradient(600px_400px_at_100%_0%,rgba(20,184,166,0.06),transparent_60%),linear-gradient(180deg,#f8fafc_0%,#ffffff_35%)]"
      // @container + containerType inline-size makes nested @[640px]: classes
      // respond to THIS element's width — so the editor's "Mobile" toggle
      // (390px canvas) gets the mobile layout instead of falling back to
      // desktop's `@[640px]:` rules (which keyed off the real browser viewport).
      // No `zoom` here: a `zoom` ancestor breaks `position: sticky` in Chrome,
      // and the section nav below depends on it. Wide-monitor upscaling is
      // handled globally by `html { zoom: 1.1 }` at ≥1500px in globals.css.
      style={{ containerType: "inline-size" }}
    >
      <div className="mx-auto max-w-[1200px] px-3.5 @[640px]:px-6">

        {/* Breadcrumbs — desktop only, hidden in iframe / editor preview */}
        {!isEmbed && (
          <nav className="hidden @[640px]:flex items-center gap-1.5 text-[13px] text-slate-500 py-5">
            <Link href="/" className="hover:text-slate-900 transition">Strona główna</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            <Link href="/trainers" className="hover:text-slate-900 transition">Trenerzy</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            <span className="text-slate-900">{trainer.name}</span>
          </nav>
        )}

        {/* Cover — mobile full-width, desktop rounded. Backed by
            customization.coverImage (per-page); falls back to a stock
            editorial shot. EditableCover gives owners drag-pan focal +
            upload + remove inline in /studio/design. */}
        <div className="relative h-[220px] @[640px]:h-[280px] @[640px]:rounded-3xl overflow-hidden @[640px]:border @[640px]:border-white/60 @[640px]:shadow-[0_20px_48px_-20px_rgba(2,6,23,0.15)] -mx-3.5 @[640px]:mx-0">
          <EditableCover
            current={trainer.customization.coverImage}
            currentFocal={trainer.customization.coverImageFocal}
            fallback="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=2000&h=600&fit=crop"
            alt={`${trainer.name} — okładka`}
            editable={editMode}
            containerClassName="absolute inset-0"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35 pointer-events-none" />
          {/* Floating buttons — visible on mobile, also pinned top-right on desktop. */}
          {!isEmbed && (
            <div className="absolute top-4 left-3.5 right-3.5 flex justify-between @[640px]:hidden">
              <Link href="/trainers" className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
              <div className="flex gap-2">
                <button className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
                </button>
                {isOwner ? (
                  <Link
                    href="/studio/design"
                    title="Edytuj profil"
                    aria-label="Edytuj profil"
                    className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 hover:text-emerald-700 transition"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                ) : (
                  <FavoriteButton
                    slug={trainer.id}
                    initialIsFavorite={initialIsFavorite}
                    needsLogin={needsLoginToFavorite}
                  />
                )}
              </div>
            </div>
          )}
          {/* Desktop top-right cluster — owner sees Edit, others see heart. */}
          <div className="hidden @[640px]:block absolute top-5 right-5">
            {isOwner ? (
              <Link
                href="/studio/design"
                title="Edytuj profil"
                aria-label="Edytuj profil"
                className="w-11 h-11 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 shadow-[0_4px_14px_rgba(2,6,23,0.06)] hover:bg-white hover:text-emerald-700 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            ) : (
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-11 h-11 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 shadow-[0_4px_14px_rgba(2,6,23,0.06)] hover:bg-white transition disabled:opacity-70"
                size={18}
              />
            )}
          </div>
        </div>

        {/* Hero card — glass, overlapping cover. Full-width: 3-col grid
            (avatar / info / actions). BookingSidebar lives lower, paired
            with the About section. */}
        <div className="-mt-[70px] @[640px]:-mt-20 relative z-10 bg-white/75 backdrop-blur-2xl backdrop-saturate-[1.4] border border-white/70 rounded-[22px] @[640px]:rounded-3xl p-4.5 @[640px]:p-7 shadow-[0_30px_60px_-24px_rgba(2,6,23,0.18)]">
          <div className="@[640px]:grid @[640px]:grid-cols-[180px_1fr_220px] @[640px]:gap-7 @[640px]:items-center">
            {/* Avatar */}
            <div className="flex @[640px]:block gap-3.5">
              <div className="w-[72px] h-[72px] @[640px]:w-[180px] @[640px]:h-[180px] rounded-2xl @[640px]:rounded-3xl overflow-hidden border-[3px] @[640px]:border-4 border-white shadow-lg shrink-0">
                <Image src={trainer.avatar} alt={trainer.name} width={180} height={180} className="w-full h-full object-cover" />
              </div>
              {/* Mobile name — next to avatar */}
              <div className="@[640px]:hidden">
                <h1 className="text-[22px] font-semibold tracking-tight">{trainer.name}</h1>
                <p className="text-[13px] text-slate-600 leading-snug">
                  {editMode ? (
                    <EditableTrainerField field="tagline" initial={trainer.tagline} multiline maxLength={200} placeholder="Twój tagline..." />
                  ) : (
                    trainer.tagline.split("—")[0].trim()
                  )}
                </p>
              </div>
            </div>

            {/* Info */}
            <div>
              {/* Desktop name */}
              <h1 className="hidden @[640px]:block text-4xl font-semibold tracking-tight">{trainer.name}</h1>
              <p className="hidden @[640px]:block text-base text-slate-600 leading-relaxed mt-1.5 max-w-[580px]">
                {editMode ? (
                  <EditableTrainerField field="tagline" initial={trainer.tagline} multiline maxLength={200} placeholder="Twój tagline..." />
                ) : (
                  trainer.tagline
                )}
              </p>
              <div className="flex flex-wrap gap-3 @[640px]:gap-5 mt-3 @[640px]:mt-3.5 text-[13px] text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  <strong className="text-slate-900">{trainer.rating}</strong> · {trainer.reviewCount} opinii
                </span>
                <span className="inline-flex items-center gap-1.5">
                  📍{" "}
                  {editMode ? (
                    <EditableTrainerField field="location" initial={trainer.location} maxLength={100} placeholder="Miasto, dzielnica" />
                  ) : (
                    trainer.location
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">🌐 {trainer.languages.join(" · ")}</span>
                <span className="inline-flex items-center gap-1.5">⚡ &lt;2h</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {editMode ? (
                  <EditableSpecializations
                    current={effectiveSpecs}
                    globalSpecs={trainer.specializations}
                    chipClassName="text-xs px-2.5 py-1 rounded-full bg-white/90 border border-emerald-500/20 text-emerald-700 font-medium"
                    showIcon
                    addBtnClassName="border-emerald-400/60 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50/60"
                  />
                ) : (
                  effectiveSpecs.map((spec) => (
                    <span key={spec} className="text-xs px-2.5 py-1 rounded-full bg-white/90 border border-emerald-500/20 text-emerald-700 font-medium">
                      {getSpecIcon(spec)} {getSpecLabel(spec)}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Actions — desktop only in hero. Same card the client sees;
                in edit mode the price is inline-editable but the buttons
                stay visually identical (just non-navigating). */}
            <div className="hidden @[640px]:flex flex-col gap-2.5 min-w-[220px]">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-slate-500">od</span>
                <span className="text-2xl font-semibold tracking-tight">
                  {editMode ? (
                    <EditableTrainerField field="price_from" initial={String(trainer.priceFrom)} numeric maxLength={6} className="w-24 text-right" />
                  ) : (
                    trainer.priceFrom
                  )}
                  {" zł "}
                  <span className="text-[13px] text-slate-500 font-normal">/ sesja</span>
                </span>
              </div>
              {editMode ? (
                <span
                  aria-disabled="true"
                  title="Aktywne tylko na publicznej stronie"
                  className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-base font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] inline-flex items-center justify-center cursor-default opacity-90"
                >
                  Zarezerwuj sesję
                </span>
              ) : (
                <Link href={`/trainers/${trainer.id}/book`} className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-base font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition inline-flex items-center justify-center">
                  Zarezerwuj sesję
                </Link>
              )}
              {editMode ? (
                <span
                  aria-disabled="true"
                  title="Aktywne tylko na publicznej stronie"
                  className="w-full flex items-center justify-center gap-2.5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-white cursor-default"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                  Napisz wiadomość
                </span>
              ) : trainerDbId ? (
                <Link href={`/account/messages?with=${trainerDbId}`} className="w-full flex items-center justify-center gap-2.5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                  Napisz wiadomość
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Section nav — sticky on real public page (anchors against site top bar);
          in embed mode (editor preview) the canvas has its own scroll container,
          so we render it non-sticky to avoid weird positioning. */}
      <PremiumSectionNav
        items={visibleSections
          .filter((sec) => sec.id !== "cases")
          .map((sec) => ({ id: sec.id, label: sectionLabels[sec.id] ?? sec.id }))}
        isEmbed={isEmbed}
      />

      {/* Content. The BookingSidebar lives inline in the About section's
          render branch (2-col grid: About + sidebar) so other sections —
          packages especially — get the full 1200px to breathe. */}
      <div className="mx-auto max-w-[1200px] px-3.5 @[640px]:px-6 py-8 @[640px]:py-10">
        {/* Sections — order + visibility from customization.sections (data-driven). */}
        {visibleSections.map(({ id }) => {
            if (id === "about") return (
              <div key="about" className={`mb-12 ${isEmbed ? "" : "@[640px]:grid @[640px]:grid-cols-[1fr_340px] @[640px]:gap-10 @[640px]:items-start"}`}>
                <section id="about" data-section-id="about" className="scroll-mt-20">
                {editMode && (
                  <SectionAITextButton
                    label="O mnie"
                    currentText={trainer.about}
                    onGenerate={generateAboutVariants}
                    onApply={applyAboutVariant}
                    template="premium"
                    pillClassName={AI_PILL_THEMES.premium}
                  />
                )}
                <Hdr labelKey="aboutLabel" labelFb="O mnie" h2Key="aboutH2" h2Fb="Filozofia pracy" subKey="aboutSub" />
                <div className="bg-white/75 backdrop-blur-lg border border-white/70 rounded-[20px] p-5 @[640px]:p-7 shadow-sm">
                  <div className="text-[15px] text-slate-700 leading-[1.65]">
                    {editMode ? (
                      <EditableTrainerField
                        field="about"
                        initial={trainer.about}
                        multiline
                        block
                        maxLength={3000}
                        placeholder="Opowiedz o sobie, swoim podejściu i wynikach klientów..."
                      />
                    ) : (
                      trainer.about
                    )}
                  </div>
                  <div className="grid grid-cols-2 @[640px]:grid-cols-4 gap-0 mt-5 pt-5 border-t border-slate-200">
                    {[
                      { val: `${trainer.experience}+`, lab: "Lat doświadczenia" },
                      { val: `${trainer.reviewCount * 7}`, lab: "Klientów" },
                      { val: `${trainer.rating}★`, lab: `${trainer.reviewCount} opinii` },
                      { val: "2h", lab: "Średni response" },
                    ].map((stat) => (
                      <div key={stat.lab} className="px-0 @[640px]:px-4.5 @[640px]:border-r @[640px]:border-slate-200 @[640px]:last:border-r-0 @[640px]:first:pl-0 py-2 @[640px]:py-0">
                        <div className="text-xl @[640px]:text-2xl font-semibold tracking-tight">{stat.val}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{stat.lab}</div>
                      </div>
                    ))}
                  </div>
                </div>
                </section>
                {!editMode && !isEmbed && trainerDbId && (
                  <BookingSidebar
                    trainerSlug={trainer.id}
                    trainerId={trainerDbId}
                    services={servicesWithIds}
                    priceFrom={trainer.priceFrom}
                    initialDate={initialDate}
                    initialSlots={initialSlots}
                  />
                )}
              </div>
            );
            // Cases section removed from Premium — clean/lifestyle voice, not
            // a portfolio. Toggle is hidden in the editor sidebar (see
            // EditorClient.tsx); existing `studioCopy.cases` data is left
            // untouched so it returns when switching to a portfolio template.
            if (id === "cases") return null;
            if (id === "services") return (
              <section key="services" id="services" data-section-id="services" className="mb-12 scroll-mt-20">
                {editMode && (
                  <SectionAIServicesButton
                    currentServicesCount={services.length}
                    template="premium"
                    pillClassName={AI_PILL_THEMES.premium}
                  />
                )}
                <Hdr labelKey="servicesLabel" labelFb="Usługi" h2Key="servicesH2" h2Fb="Pojedyncze sesje" subKey="servicesSub" />
                {editMode ? (
                  <InlineServicesEditor
                    services={servicesWithIds.map((s) => ({
                      id: s.id,
                      name: s.name,
                      description: s.description,
                      duration: s.duration,
                      price: s.price,
                    }))}
                  />
                ) : (
                  <div className="grid @[640px]:grid-cols-2 gap-3.5">
                    {services.map((svc) => (
                      <div key={svc.id ?? svc.name} className="bg-white/80 backdrop-blur-sm border border-white/70 rounded-[18px] p-5 @[640px]:p-5.5 shadow-sm flex flex-col gap-2.5">
                        <div className="flex justify-between items-baseline">
                          <div className="text-[17px] font-semibold tracking-tight">{svc.name}</div>
                          <div className="text-base font-semibold text-emerald-700">{svc.price} zł</div>
                        </div>
                        <div className="text-sm text-slate-600 leading-snug">{svc.description}</div>
                        <div className="flex gap-3.5 text-xs text-slate-500 mt-auto pt-2.5 border-t border-slate-200">
                          {svc.duration > 0 && <span className="inline-flex items-center gap-1">⏱ {svc.duration} min</span>}
                          <span className="inline-flex items-center gap-1">📍 Sala</span>
                        </div>
                        {svc.id ? (
                          <Link
                            href={`/trainers/${trainer.id}/book?service=${svc.id}`}
                            className="w-full text-center py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition mt-1"
                          >
                            Zarezerwuj →
                          </Link>
                        ) : (
                          <button className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition mt-1">
                            Zarezerwuj →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
            if (id === "packages") return (
              // @container makes nested @[640px]: classes respond to the
              // section's actual width, not the browser viewport — so the
              // editor's "Mobile" preview (390px canvas) gets the carousel
              // layout instead of falling back to desktop's `@[640px]:` rules.
              <section key="packages" id="packages" data-section-id="packages" className="@container mb-12 scroll-mt-20" style={{ containerType: "inline-size" }}>
                {editMode && (
                  <SectionAIPackagesButton
                    currentPackagesCount={packages.length}
                    template="premium"
                    pillClassName={AI_PILL_THEMES.premium}
                  />
                )}
                <Hdr
                  labelKey="packagesLabel"
                  labelFb="Pakiety"
                  h2Key="packagesH2"
                  h2Fb="Zaplanuj transformację"
                  subKey="packagesSub"
                  subFb="Pakiety długoterminowe z rabatem do 20% względem sesji pojedynczych."
                  h2ClassName="text-[32px] font-semibold tracking-tight mt-2 mb-1"
                />
                {editMode ? (
                  <InlinePackagesEditor packages={packages} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 @[640px]:grid-cols-2 @[1000px]:grid-cols-3">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className={`flex flex-col gap-4 rounded-[20px] p-5 @[640px]:p-6 relative ${pkg.featured ? "bg-gradient-to-b from-white/95 to-emerald-50/90 border border-emerald-300 shadow-[0_22px_48px_-18px_rgba(16,185,129,0.3)] @[1000px]:-translate-y-1" : "bg-white/80 backdrop-blur-sm border border-white/70 shadow-sm"}`}>
                        {pkg.featured && (
                          <span className="absolute -top-2.5 left-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] px-3 py-1 rounded-full font-semibold uppercase tracking-[0.06em] shadow-sm">
                            ⭐ Popularne
                          </span>
                        )}
                        <div>
                          <div className="text-base font-semibold text-emerald-700">{pkg.name}</div>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-[34px] font-semibold tracking-tight">{pkg.price.toLocaleString("pl-PL")} zł</span>
                            {pkg.period && <span className="text-[13px] text-slate-500">/ {pkg.period}</span>}
                          </div>
                          {pkg.description && <div className="text-[13px] text-slate-600 leading-snug mt-2">{pkg.description}</div>}
                        </div>
                        <ul className="space-y-2.5 flex-1">
                          {pkg.items.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                              <span className="w-[18px] h-[18px] rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0 mt-0.5">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                        {pkg.id ? (
                          <Link
                            href={`/trainers/${trainer.id}/checkout/${pkg.id}`}
                            className={`w-full text-center py-3 rounded-xl text-sm font-medium transition mt-auto ${pkg.featured ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105" : "bg-white border border-slate-200 text-slate-900 hover:border-slate-400"}`}
                          >
                            Wybierz pakiet
                          </Link>
                        ) : (
                          <button className={`w-full py-3 rounded-xl text-sm font-medium transition mt-auto ${pkg.featured ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105" : "bg-white border border-slate-200 text-slate-900 hover:border-slate-400"}`}>
                            Wybierz pakiet
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
            if (id === "gallery") {
              const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
              const galleryItems = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
              const focalMap = trainer.customization.galleryFocal;
              const FALLBACK_PHOTOS = [
                "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=600&h=400&fit=crop",
              ];
              return (
                <section key="gallery" id="gallery" data-section-id="gallery" className="mb-12 scroll-mt-20">
                  <Hdr labelKey="galleryLabel" labelFb="Galeria" h2Key="galleryH2" h2Fb="Praca w obiektywie" subKey="gallerySub" />
                  {editMode ? (
                    <PremiumGalleryEditor items={galleryItems} focalMap={focalMap} />
                  ) : galleryItems.length > 0 ? (
                    <PremiumGalleryView items={galleryItems} focalMap={focalMap} />
                  ) : (
                    <PremiumGalleryView
                      items={FALLBACK_PHOTOS.map((url, i) => ({ id: `fallback-${i}`, url }))}
                    />
                  )}
                </section>
              );
            }
            if (id === "certifications" && trainer.certifications.length > 0) return (
              <section key="certifications" id="certifications" data-section-id="certifications" className="mb-12 scroll-mt-20">
                <Hdr labelKey="certificationsLabel" labelFb="Certyfikaty" h2Key="certificationsH2" h2Fb="Wykształcenie i szkolenia" subKey="certificationsSub" />
                <div className="grid @[640px]:grid-cols-2 gap-3">
                  {trainer.certifications.map((cert) => (
                    <div key={cert} className="bg-white/75 backdrop-blur-sm border border-white/70 rounded-[14px] p-4 flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center shrink-0">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="7" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></svg>
                      </div>
                      <div>
                        <div className="text-[16px] @[640px]:text-[17px] font-semibold text-slate-900 leading-snug">{cert.split("—")[0].trim()}</div>
                        {cert.includes("—") && <div className="text-[13px] text-slate-500 mt-0.5">{cert.split("—")[1]?.trim()}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
            if (id === "reviews") return (
              <section key="reviews" id="reviews" data-section-id="reviews" className="mb-12 scroll-mt-20">
            <Hdr
              labelKey="reviewsLabel"
              labelFb="Opinie"
              h2Key="reviewsH2"
              h2Fb="Co mówią klienci"
              subKey="reviewsSub"
              subFb={`${trainer.reviewCount} opinie w ciągu ostatnich 18 miesięcy`}
              h2ClassName="text-[32px] font-semibold tracking-tight"
            />
            {/* Score block — full-width card on mobile (score + stars + count
                in a single horizontal row, so the empty left side from
                justify-end is gone), score+histogram side-by-side on desktop. */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/70 rounded-2xl p-5 @[640px]:p-6 mb-6 flex items-center gap-5 @[640px]:gap-7 @[640px]:justify-end">
              <div className="flex items-center gap-4 @[640px]:block @[640px]:text-right">
                <div className="text-5xl font-semibold tracking-tight leading-none">{trainer.rating}</div>
                <div className="@[640px]:mt-1.5">
                  <div className="text-amber-400 text-sm leading-none">★★★★★</div>
                  <div className="text-[13px] text-slate-500 mt-1">{trainer.reviewCount} opinie</div>
                </div>
              </div>
              <div className="hidden @[640px]:grid gap-1 flex-1 max-w-[280px]">
                {[
                  { n: 5, w: "88%", c: 64 },
                  { n: 4, w: "10%", c: 7 },
                  { n: 3, w: "3%", c: 2 },
                  { n: 2, w: "0%", c: 0 },
                  { n: 1, w: "0%", c: 0 },
                ].map((bar) => (
                  <div key={bar.n} className="grid grid-cols-[16px_1fr_32px] gap-2 items-center text-xs text-slate-500">
                    <span>{bar.n}</span>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: bar.w }} />
                    </div>
                    <span>{bar.c}</span>
                  </div>
                ))}
              </div>
            </div>
            <PremiumReviewsList reviews={trainer.reviews} />
              </section>
            );
            return null;
          })}
      </div>

      {/* Mobile sticky CTA — hidden in editor preview */}
      {!isEmbed && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3.5 py-3 pb-5 grid grid-cols-[auto_1fr] gap-3 items-center @[640px]:hidden">
            <div className="text-[13px] text-slate-500">
              od<strong className="block text-lg font-semibold text-slate-900">{trainer.priceFrom} zł</strong>
            </div>
            <Link href={`/trainers/${trainer.id}/book`} className="text-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl py-3.5 px-5 text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
              Zarezerwuj sesję
            </Link>
          </div>
          <div className="h-24 @[640px]:hidden" />
        </>
      )}
    </div>
  );
}
