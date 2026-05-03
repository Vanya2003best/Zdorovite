import Image from "next/image";
import Link from "next/link";
import type { Trainer, Service, SectionId } from "@/types";
import { templates } from "@/data/templates";
import AboutSection from "@/components/sections/AboutSection";
import ServicesSection from "@/components/sections/ServicesSection";
import PackagesSection from "@/components/sections/PackagesSection";
import CertificationsSection from "@/components/sections/CertificationsSection";
import GallerySection from "@/components/sections/GallerySection";
import ReviewsSection from "@/components/sections/ReviewsSection";
import AutoHideHeader from "@/components/AutoHideHeader";
import FavoriteButton from "./FavoriteButton";
import InlineServicesEditor from "./InlineServicesEditor";
import InlinePackagesEditor from "./InlinePackagesEditor";
import EditableAboutInline from "./EditableAboutInline";
import EditableTaglineInline from "./EditableTaglineInline";
import EditableStudioCopy from "./EditableStudioCopy";
import EditableCover from "./EditableCover";
import PremiumGalleryEditor from "./PremiumGalleryEditor";
import CozyPackagesEditor from "./CozyPackagesEditor";
import CozyServicesEditor from "./CozyServicesEditor";
import SectionAITextButton from "./SectionAITextButton";
import SectionAIServicesButton from "./SectionAIServicesButton";
import SectionAIPackagesButton from "./SectionAIPackagesButton";
import { generateAboutVariants, applyAboutVariant } from "./ai-actions";
import { AI_PILL_THEMES } from "./ai-pill-themes";
import { applyServiceOverrides, applyPackageOverrides } from "./apply-overrides";

/* ================================================================
   OTHER TEMPLATES — Cozy / Studio (templates not big enough to warrant
   their own dedicated component file; styled via templates.ts tokens).
   ================================================================ */
export default async function TemplateProfile({
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
  const c = trainer.customization;
  const s = templates[c.template];
  const visibleSections = c.sections.filter((sec) => sec.visible);
  const isCozy = s.name === "cozy";

  // Cozy/Template reuses studioCopy for section copy (it has no dedicated
  // copy bag). Same Hdr pattern as PremiumProfile — label + h2 + optional sub
  // pulled through EditableStudioCopy so the trainer can rewrite each section
  // header inline. Allowlist for these keys lives in studio-copy-actions.
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
  }: {
    labelKey: StudioCopyKey;
    labelFb: string;
    h2Key?: StudioCopyKey;
    h2Fb?: string;
    subKey?: StudioCopyKey;
    subFb?: string;
  }) => {
    const labelVal = studioCopyShared[labelKey];
    const h2Val = h2Key ? studioCopyShared[h2Key] : undefined;
    const subVal = subKey ? studioCopyShared[subKey] : undefined;
    return (
      <>
        <span className={`block ${isCozy ? "text-[12px] text-[#a37c52]" : "text-[11px] text-slate-500"} uppercase tracking-[0.08em] font-medium`}>
          {editMode ? (
            <EditableStudioCopy
              field={labelKey}
              initial={typeof labelVal === "string" ? labelVal : undefined}
              defaultValue={labelFb}
              accentColor={isCozy ? "#a37c52" : "#10b981"}
              rich={false}
              maxLength={60}
            />
          ) : (
            (typeof labelVal === "string" ? labelVal : null) ?? labelFb
          )}
        </span>
        {h2Key && h2Fb && (
          <h2 className={`mt-1 mb-2 ${isCozy ? "text-[20px] text-[#2d2418]" : "text-[18px] text-slate-900"} font-semibold tracking-tight`}>
            {editMode ? (
              <EditableStudioCopy
                field={h2Key}
                initial={typeof h2Val === "string" ? h2Val : undefined}
                defaultValue={h2Fb}
                accentColor={isCozy ? "#a37c52" : "#10b981"}
                rich
                maxLength={120}
              />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: (typeof h2Val === "string" ? h2Val : null) ?? h2Fb }} />
            )}
          </h2>
        )}
        {subKey && (editMode || (typeof subVal === "string" && subVal)) && (
          <p className={`text-[13px] mb-3 max-w-[640px] ${isCozy ? "text-[#5e4f3a]" : "text-slate-500"}`}>
            {editMode ? (
              <EditableStudioCopy
                field={subKey}
                initial={typeof subVal === "string" ? subVal : undefined}
                defaultValue={subFb ?? ""}
                placeholder="Opcjonalny podtytuł sekcji…"
                accentColor={isCozy ? "#a37c52" : "#10b981"}
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

  const services = applyServiceOverrides(trainer.services, trainer.customization);
  const packages = applyPackageOverrides(trainer.packages, trainer.customization);
  const servicesWithIds = services.filter((svc): svc is Service & { id: string } => !!svc.id);
  // BookingSidebar removed (didn't fit Cozy aesthetic) so we no longer need
  // to prefetch availability slots here. The /book route fetches its own.

  function renderSection(sectionId: SectionId) {
    // In edit mode, swap template-styled sections with inline editors for tagline/services/packages/about.
    // Gallery + certifications remain template-styled until inline editors are built.
    if (editMode) {
      switch (sectionId) {
        case "about":
          return (
            <section key="about" data-section-id="about" className="px-6 py-5">
              <SectionAITextButton
                label="O mnie"
                currentText={trainer.about}
                onGenerate={generateAboutVariants}
                onApply={applyAboutVariant}
                template={isCozy ? "cozy" : "studio"}
                pillClassName={isCozy ? AI_PILL_THEMES.cozy : AI_PILL_THEMES.studio}
              />
              <Hdr labelKey="aboutLabel" labelFb="O mnie" h2Key="aboutH2" h2Fb="Trochę o mnie" subKey="aboutSub" />
              <div className="text-[14px] text-slate-700 leading-[1.65] mt-2 whitespace-pre-line">
                <EditableAboutInline
                  initial={trainer.about}
                  placeholder="Opowiedz o sobie, swoim podejściu i wynikach klientów..."
                />
              </div>
            </section>
          );
        case "services":
          return (
            <section key="services" data-section-id="services" className="px-6 py-5">
              <SectionAIServicesButton
                currentServicesCount={services.length}
                template={isCozy ? "cozy" : "studio"}
                pillClassName={isCozy ? AI_PILL_THEMES.cozy : AI_PILL_THEMES.studio}
              />
              <Hdr labelKey="servicesLabel" labelFb={isCozy ? "Co oferuję" : "Usługi"} h2Key="servicesH2" h2Fb="Pojedyncze sesje" subKey="servicesSub" />
              <div className="mt-3">
                {isCozy ? (
                  <CozyServicesEditor
                    services={servicesWithIds.map((sv) => ({
                      id: sv.id,
                      name: sv.name,
                      description: sv.description,
                      duration: sv.duration,
                      price: sv.price,
                    }))}
                    overrides={trainer.customization.serviceOverrides ?? {}}
                  />
                ) : (
                  <InlineServicesEditor
                    services={servicesWithIds.map((sv) => ({
                      id: sv.id,
                      name: sv.name,
                      description: sv.description,
                      duration: sv.duration,
                      price: sv.price,
                    }))}
                  />
                )}
              </div>
            </section>
          );
        case "packages":
          return (
            <section key="packages" data-section-id="packages" className="px-6 py-5">
              <SectionAIPackagesButton
                currentPackagesCount={packages.length}
                template={isCozy ? "cozy" : "studio"}
                pillClassName={isCozy ? AI_PILL_THEMES.cozy : AI_PILL_THEMES.studio}
              />
              <Hdr labelKey="packagesLabel" labelFb={isCozy ? "Pakiety z sercem" : "Pakiety"} h2Key="packagesH2" h2Fb="Zaplanuj transformację" subKey="packagesSub" />
              <div className="mt-3">
                {isCozy ? (
                  <CozyPackagesEditor
                    packages={packages}
                    overrides={trainer.customization.packageOverrides ?? {}}
                  />
                ) : (
                  <InlinePackagesEditor packages={packages} />
                )}
              </div>
            </section>
          );
        case "gallery": {
          const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
          const galleryItems = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
          return (
            <section key="gallery" data-section-id="gallery" className="px-6 py-5">
              <Hdr labelKey="galleryLabel" labelFb="Galeria" h2Key="galleryH2" h2Fb="Praca w obiektywie" subKey="gallerySub" />
              <div className="mt-3">
                <PremiumGalleryEditor items={galleryItems} focalMap={trainer.customization.galleryFocal} />
              </div>
            </section>
          );
        }
        case "certifications":
          return (
            <section key="certifications" data-section-id="certifications" className="px-6 py-5">
              <Hdr labelKey="certificationsLabel" labelFb="Certyfikaty" h2Key="certificationsH2" h2Fb="Wykształcenie i szkolenia" subKey="certificationsSub" />
              <div className="mt-3">
                <CertificationsSection certifications={trainer.certifications} styles={s} />
                <Link
                  href="/studio/profile"
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#8a7559] hover:text-[#2d2418] transition"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Edytuj certyfikaty w ustawieniach konta →
                </Link>
              </div>
            </section>
          );
        case "reviews":
          return (
            <section key="reviews" data-section-id="reviews" className="px-6 py-5">
              <Hdr labelKey="reviewsLabel" labelFb="Opinie" h2Key="reviewsH2" h2Fb="Co mówią klienci" subKey="reviewsSub" />
              <div className="mt-3">
                <ReviewsSection reviews={trainer.reviews} styles={s} />
              </div>
            </section>
          );
      }
    }

    switch (sectionId) {
      case "about": return <AboutSection key="about" about={trainer.about} styles={s} />;
      case "services": return <ServicesSection key="services" services={services} styles={s} trainerSlug={trainer.id} />;
      case "packages": return <PackagesSection key="packages" packages={packages} styles={s} trainerSlug={trainer.id} />;
      case "gallery": return <GallerySection key="gallery" gallery={trainer.gallery} styles={s} />;
      case "certifications": return <CertificationsSection key="certifications" certifications={trainer.certifications} styles={s} />;
      case "reviews": return <ReviewsSection key="reviews" reviews={trainer.reviews} styles={s} />;
      default: return null;
    }
  }

  return (
    <div className={`min-h-screen ${s.pageBg}`}>

      {/* Cozy chrome — soft cream sticky header with monogram, anchor nav,
          booking CTA. Hidden in editor preview (isEmbed) and not rendered
          for non-Cozy variants of TemplateProfile (currently Cozy is the
          only one but the dispatch keeps the door open). */}
      {isCozy && !isEmbed && (
        <AutoHideHeader>
          <header className="bg-[#fdf6ec]/85 backdrop-blur-md border-b border-[#fef3e0]">
            <div className="mx-auto max-w-[1200px] px-3.5 sm:px-6 h-[60px] flex items-center justify-between gap-4">
              <Link href="/" className="inline-flex items-center gap-2.5 group">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fbbf77] to-[#f5d0a9] inline-flex items-center justify-center text-[#2d2418] font-semibold text-[14px] shadow-[0_4px_12px_rgba(164,95,30,0.18)]">
                  N
                </span>
                <span className="text-[15px] font-semibold tracking-tight text-[#2d2418] hidden sm:inline">
                  NaZdrow!
                </span>
              </Link>
              <nav className="hidden @[640px]:flex md:flex items-center gap-6 text-[13px] text-[#6b5a41]">
                <a href="#services" className="hover:text-[#2d2418] transition">Usługi</a>
                <a href="#packages" className="hover:text-[#2d2418] transition">Pakiety z sercem</a>
                <a href="#gallery" className="hover:text-[#2d2418] transition">Galeria</a>
                <a href="#reviews" className="hover:text-[#2d2418] transition">Opinie</a>
              </nav>
              <div className="flex items-center gap-2.5">
                {!isOwner && (
                  <FavoriteButton
                    slug={trainer.id}
                    initialIsFavorite={initialIsFavorite}
                    needsLogin={needsLoginToFavorite}
                    className="w-9 h-9 rounded-full bg-white/70 border border-[#fef3e0] inline-flex items-center justify-center text-[#a08668] hover:text-[#2d2418] hover:bg-white transition disabled:opacity-70"
                    size={15}
                  />
                )}
                {isOwner && (
                  <Link
                    href="/studio/design"
                    title="Edytuj profil"
                    aria-label="Edytuj profil"
                    className="w-9 h-9 rounded-full bg-white/70 border border-[#fef3e0] inline-flex items-center justify-center text-[#a08668] hover:text-orange-600 hover:bg-white transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                )}
                <Link
                  href={`/trainers/${trainer.id}/book`}
                  className="hidden sm:inline-flex items-center justify-center h-9 px-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[13px] font-medium shadow-[0_6px_16px_rgba(234,88,12,0.25)] hover:brightness-105 transition"
                >
                  Zarezerwuj 🌿
                </Link>
              </div>
            </div>
          </header>
        </AutoHideHeader>
      )}

      {/* Cover — full-bleed across 1200px container. Backed by
          customization.coverImage (per-page); falls back to the template's
          gradient `s.coverBg` when no photo uploaded. EditableCover gives
          owners drag-pan focal + upload + remove inline in /studio/design. */}
      <div className="mx-auto max-w-[1200px] px-3.5 sm:px-6">
        <div className={`${s.coverBg} ${s.coverHeight} -mx-3.5 sm:mx-0 sm:rounded-3xl overflow-hidden relative`}>
          <EditableCover
            current={trainer.customization.coverImage}
            currentFocal={trainer.customization.coverImageFocal}
            fallback="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=2000&h=600&fit=crop"
            alt={`${trainer.name} — okładka`}
            editable={editMode}
            accentColor={isCozy ? "#a37c52" : "#10b981"}
            containerClassName={`absolute inset-0${trainer.customization.coverImage ? "" : " opacity-90"}`}
            className="w-full h-full object-cover"
          />
          {isCozy && <div className="absolute bottom-[-1px] left-0 right-0 h-8 bg-[#fdf6ec] rounded-t-[32px] z-[5]" />}
          {!isOwner && (
            <div className="absolute top-4 right-4">
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 shadow-[0_4px_14px_rgba(2,6,23,0.06)] hover:bg-white transition disabled:opacity-70"
                size={16}
              />
            </div>
          )}
        </div>

        {/* Single-column layout, content centred at ~960px so the small Cozy
            type tokens don't get stretched edge-to-edge on a 1200px canvas.
            Wider hero sizes (Cozy override) keep the top of the page from
            feeling sparse next to the bumped-up package + service content. */}
        <div className="@container pb-8 sm:pb-12 max-w-[960px] mx-auto">
          {/* MAIN COLUMN */}
          <div>
            <div className="px-6 -mt-12 sm:-mt-16 relative z-10">
              <div className={`${isCozy ? "w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] rounded-full border-4 border-[#fdf6ec] bg-[#fbbf77] shadow-[0_8px_24px_rgba(164,95,30,0.22)]" : s.avatarStyle} overflow-hidden`}>
                <Image src={trainer.avatar} alt={trainer.name} width={140} height={140} className="w-full h-full object-cover" />
              </div>
              <h1 className={`mt-5 ${isCozy ? "text-[36px] sm:text-[44px] font-semibold tracking-tight text-[#2d2418] leading-[1.05]" : s.nameStyle}`}>
                {trainer.name}
              </h1>
              <p className={`mt-2 ${isCozy ? "text-[15px] sm:text-[17px] text-[#8a7559] leading-relaxed max-w-[640px]" : s.tagStyle}`}>
                {editMode ? (
                  <EditableTaglineInline initial={trainer.tagline} placeholder="Twój tagline..." maxLength={200} />
                ) : (
                  trainer.tagline
                )}
              </p>
              <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 ${isCozy ? "text-[14px] text-[#6b5a41]" : s.metaStyle}`}>
                {isCozy ? (
                  <>
                    <span className="inline-flex items-center gap-1.5"><span className="text-amber-500 text-base leading-none">⭐</span> <strong className="text-[#2d2418] font-semibold text-[15px]">{trainer.rating}</strong> ({trainer.reviewCount})</span>
                    <span className="inline-flex items-center gap-1.5">📍 {trainer.location}</span>
                    <span className="inline-flex items-center gap-1.5">🌱 {trainer.experience} lat</span>
                    <span className="inline-flex items-center gap-1.5">🌐 {trainer.languages.join(" · ") || "Polski"}</span>
                  </>
                ) : (
                  <>
                    <span>★ {trainer.rating} · {trainer.reviewCount}</span>
                    <span>{trainer.location}</span>
                    <span>{trainer.experience} lat</span>
                    <span>{trainer.languages.join(" · ") || "Polski"}</span>
                  </>
                )}
              </div>
            </div>
            {visibleSections.map((sec) => renderSection(sec.id))}
            {/* CTA bar — visible on every breakpoint now that the booking
                sidebar is gone. Anchors to the bottom of the content column. */}
            {!editMode && !isEmbed && (
              <div className={`${s.ctaBarStyle} mt-6 sm:rounded-2xl`}>
                <div className={s.ctaPriceStyle}>od <strong className={s.ctaPriceBoldStyle}>{trainer.priceFrom} zł</strong></div>
                <Link href={`/trainers/${trainer.id}/book`} className={`${s.ctaButtonStyle} inline-flex items-center justify-center`}>{s.ctaButtonText}</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA — same pattern as PremiumProfile, hidden in editor preview */}
      {!editMode && !isEmbed && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3.5 py-3 pb-5 grid grid-cols-[auto_1fr] gap-3 items-center sm:hidden">
            <div className="text-[13px] text-slate-500">
              od<strong className="block text-lg font-semibold text-slate-900">{trainer.priceFrom} zł</strong>
            </div>
            <Link href={`/trainers/${trainer.id}/book`} className="text-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl py-3.5 px-5 text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
              Zarezerwuj sesję
            </Link>
          </div>
          <div className="h-24 sm:hidden" />
        </>
      )}
    </div>
  );
}
