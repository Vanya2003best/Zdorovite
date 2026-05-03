import Link from "next/link";
import type { Trainer, Service } from "@/types";
import { getSpecLabel } from "@/data/specializations";
import FavoriteButton from "./FavoriteButton";
import EditableStudioCopy from "./EditableStudioCopy";
import EditableStudioImage from "./EditableStudioImage";
import StudioCasesEditor from "./StudioCasesEditor";
import StudioServicesEditor from "./StudioServicesEditor";
import AutoHideHeader from "@/components/AutoHideHeader";
import type { StudioCaseStudy } from "@/types";
import StudioPackagesEditor from "./StudioPackagesEditor";
import StudioGalleryEditor from "./StudioGalleryEditor";
import StudioGalleryView from "./StudioGalleryView";
import StudioTicker from "./StudioTicker";
import VideoIntroButton from "./VideoIntroButton";
import EditableSpecializations from "./EditableSpecializations";
import SectionAITextButton from "./SectionAITextButton";
import SectionAIServicesButton from "./SectionAIServicesButton";
import SectionAIPackagesButton from "./SectionAIPackagesButton";
import SectionAICasesButton from "./SectionAICasesButton";
import { generateAboutVariants, applyAboutVariant } from "./ai-actions";
import { AI_PILL_THEMES } from "./ai-pill-themes";
import { applyServiceOverrides, applyPackageOverrides } from "./apply-overrides";

/**
 * Studio template — burnt-orange / lime / off-white "design studio portfolio"
 * voice. Pixel-modeled on designs/12-profile-studio-desktop.html and
 * 13-profile-studio-mobile.html. Mirrors the LuxuryProfile / SignatureProfile /
 * CinematicProfile pattern: every label, heading, and section sub is editable
 * inline via EditableStudioCopy → updateStudioCopyField → studioCopy JSONB.
 *
 * Sections (data-section-id attrs drive the EditorClient imperative reorder):
 *   - about        → asymmetric collage grid (big philosophy + stat tiles)
 *   - services     → 2-col chip grid; in editMode swaps to StudioServicesEditor
 *   - packages     → 3-col grid (middle dark when featured); StudioPackagesEditor
 *   - gallery      → 4-col masonry
 *   - certifications → numbered list with year-as-accent
 *   - reviews      → dark hero card (rating + AI insight) + 3 review cards
 *
 * The hero (asymmetric name + photo card), marquee strip, and final CTA
 * are fixed sections — they sit OUTSIDE the section-toggle list so the
 * trainer can't hide them.
 */

const FALLBACK_PORTRAIT = "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&h=1000&fit=crop&crop=faces";
const FALLBACK_GALLERY = [
  "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=700&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=600&h=700&fit=crop",
];

export default function StudioProfile({
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
  isEmbed?: boolean;
}) {
  const stCopy = trainer.customization.studioCopy ?? {};
  const effectiveSpecs = trainer.customization.specializations ?? trainer.specializations;
  const services = applyServiceOverrides(trainer.services, trainer.customization);
  const packages = applyPackageOverrides(trainer.packages, trainer.customization);

  // String-typed studioCopy keys only (excludes the `cases` array). Stu/t
  // helpers below operate on these — the cases array has its own renderer.
  type StringStudioCopyKey = Exclude<keyof typeof stCopy, "cases">;

  /** Resolve a studioCopy string field with fallback. Empty/missing → fallback. */
  const t = (k: StringStudioCopyKey, fb: string): string => {
    const v = (stCopy[k] as string | undefined)?.trim();
    return v && v.length > 0 ? v : fb;
  };

  /** In editMode → render EditableStudioCopy hooked to updateStudioCopyField.
   *  In view mode → render the resolved string as HTML (sanitised on save). */
  const Stu = ({
    k,
    fb,
    multiline = false,
    maxLength = 200,
    rich = true,
    block = false,
  }: {
    k: StringStudioCopyKey;
    fb: string;
    multiline?: boolean;
    maxLength?: number;
    rich?: boolean;
    block?: boolean;
  }) => {
    if (editMode) {
      return (
        <EditableStudioCopy
          field={String(k)}
          initial={stCopy[k] as string | undefined}
          defaultValue={fb}
          maxLength={maxLength}
          multiline={multiline}
          block={block}
          rich={rich}
        />
      );
    }
    return <span dangerouslySetInnerHTML={{ __html: t(k, fb) }} />;
  };

  // Hero photo: trainer avatar > first gallery photo > Unsplash fallback.
  const heroPhoto = trainer.avatar || trainer.gallery[0] || FALLBACK_PORTRAIT;

  // Gallery masonry — first 8 photos; pad with fallback if trainer has < 8.
  const galleryPhotos = trainer.gallery.length >= 8
    ? trainer.gallery.slice(0, 8)
    : [...trainer.gallery, ...FALLBACK_GALLERY].slice(0, 8);
  // Same list but enriched with photo ids + per-page focal for view mode.
  // Hidden photos (galleryHidden) are dropped here so they vanish from both
  // editor and view; the gallery_photos row + storage file are untouched so
  // undo (customization snapshot restore) can bring them back.
  const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
  const galleryItems = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
  const galleryFocal = trainer.customization.galleryFocal;
  // Pass the full list (no 8-cap) so the lightbox can swipe through every
  // photo. Pad with FALLBACK_GALLERY only when the trainer has fewer than 6
  // real photos so the grid never feels empty for new accounts.
  const galleryPhotosForView: { url: string; id?: string; focal?: string }[] = galleryItems.length >= 6
    ? galleryItems.map((g) => ({ url: g.url, id: g.id, focal: galleryFocal?.[g.id] }))
    : [
        ...galleryItems.map((g) => ({ url: g.url, id: g.id, focal: galleryFocal?.[g.id] })),
        ...FALLBACK_GALLERY.map((url) => ({ url })),
      ].slice(0, 6);

  // Reviews — limit to 3 in the visible grid; "Zobacz wszystkie" CTA shows count.
  const reviews = trainer.reviews.slice(0, 3);
  const ratingDisplay = trainer.rating > 0 ? trainer.rating.toString().replace(".", ",") : "—";

  // Layout: city = first chunk before the comma in trainer.location.
  const city = trainer.location.split(",")[0]?.trim() || "—";

  return (
    <div
      className="@container min-h-screen antialiased"
      style={{ containerType: "inline-size", background: "#fafaf7", color: "#141413" }}
    >
      {/* Brand-nav. On the public page (`!isEmbed`) it's wrapped in
          AutoHideHeader so it sticks to the top and slides up off-screen on
          scroll-down (re-appearing on scroll-up — same UX as Luxury template's
          chrome). In editor preview (isEmbed) it renders statically so the
          trainer can edit availability text without it disappearing on scroll
          or stacking with the editor's own top bar. */}
      {(() => {
        const navInner = (
          <nav
            className="border-b border-[#e8e6df]"
            style={{ background: "rgba(250,250,247,.9)", backdropFilter: "blur(14px)" }}
          >
            <div className="mx-auto max-w-[1340px] px-6 sm:px-10 h-[68px] flex justify-between items-center gap-4">
          <Link href="/" className="inline-flex items-center gap-2 shrink-0">
            <span className="w-[26px] h-[26px] rounded-lg bg-[#141413] text-[#dbff3c] inline-flex items-center justify-center font-bold text-[13px]">N</span>
            <span className="font-semibold text-[17px] tracking-[-0.02em]">
              <Stu k="brandName" fb="NaZdrow!" maxLength={40} rich={false} />
            </span>
          </Link>
          <div className="hidden @[1024px]:flex gap-7 text-[14px] font-medium text-[#3d3d3a]">
            <a href="#about" className="hover:text-[#ff5722] transition">O mnie</a>
            <a href="#cases" className="hover:text-[#ff5722] transition">Kejsy</a>
            <a href="#services" className="hover:text-[#ff5722] transition">Usługi</a>
            <a href="#packages" className="hover:text-[#ff5722] transition">Pakiety</a>
            <a href="#certifications" className="hover:text-[#ff5722] transition">Akredytacje</a>
            <a href="#gallery" className="hover:text-[#ff5722] transition">Galeria</a>
            <a href="#reviews" className="hover:text-[#ff5722] transition">Opinie</a>
          </div>
          <div className="flex gap-2.5 items-center shrink-0">
            {/* Availability badge sits right before "Umów sesję" so the
                green-dot CTA-pair reads as one unit. Hidden on narrow viewports
                where there's no room. */}
            <div
              className="hidden @[640px]:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#d4d1c7] text-[12.5px] font-medium text-[#3d3d3a]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" style={{ boxShadow: "0 0 0 3px rgba(34,197,94,.2)" }} />
              <Stu k="heroAvailability" fb="Dostępna · Najbliższy termin w tym tygodniu" maxLength={80} rich={false} />
            </div>
            {!editMode && (
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
              />
            )}
            {editMode ? (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#141413] text-white text-[14px] font-medium opacity-60 cursor-not-allowed"
              >
                Umów sesję
              </span>
            ) : (
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#141413] text-white text-[14px] font-medium hover:bg-[#ff5722] transition"
              >
                Umów sesję
              </Link>
            )}
          </div>
        </div>
          </nav>
        );
        return isEmbed ? navInner : <AutoHideHeader>{navInner}</AutoHideHeader>;
      })()}

      <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
        {/* HERO — asymmetric grid: text + photo card. Availability badge moved
            to the sticky nav above so it lives in the brand chrome instead of
            the hero text column. */}
        <section className="grid @[1024px]:grid-cols-[1.4fr_1fr] gap-8 @[1024px]:gap-12 items-start pt-4 @[1024px]:pt-6 pb-12">
          <div className="@[1024px]:sticky @[1024px]:top-6 @[1024px]:self-start min-w-0">
            <h1
              className="font-medium m-0 mb-7"
              style={{ fontSize: "clamp(48px, 9cqw, 108px)", lineHeight: 0.92, letterSpacing: "-0.055em" }}
            >
              {trainer.name.split(" ").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 ? <br /> : null}
                </span>
              ))}
              <span style={{ color: "#ff5722", fontWeight: 400, fontStyle: "italic" }}> /</span>{" "}
              <span style={{ color: "#ff5722", fontWeight: 400, fontStyle: "italic" }}>
                <Stu k="heroSlash" fb="trening" maxLength={40} rich={false} />
              </span>
              <span style={{ color: "#ff5722", fontWeight: 400, fontStyle: "italic" }}>.</span>
            </h1>
            <p
              className="m-0 mb-9 text-[#3d3d3a]"
              style={{ fontSize: "clamp(16px, 1.7cqw, 22px)", lineHeight: 1.45, letterSpacing: "-0.012em", maxWidth: 540 }}
            >
              <Stu k="heroTag" fb={trainer.tagline || "Buduję plan jak dobry produkt — krok po kroku, z mierzalnym efektem."} maxLength={300} multiline block />
            </p>
            <div className="flex gap-2 flex-wrap mb-9 items-center">
              {editMode ? (
                <EditableSpecializations
                  current={effectiveSpecs}
                  globalSpecs={trainer.specializations}
                  chipClassName="px-3.5 py-2 rounded-full border text-[13px] font-medium bg-white text-[#3d3d3a] border-[#d4d1c7]"
                  accentChipClassName="px-3.5 py-2 rounded-full border text-[13px] font-medium bg-[#ff5722] text-white border-[#ff5722]"
                  addBtnClassName="border-[#ff5722]/40 text-[#ff5722] hover:border-[#ff5722] hover:bg-[#ffeadb]/40"
                />
              ) : (
                effectiveSpecs.slice(0, 4).map((s, i) => {
                  const label = getSpecLabel(s) ?? s;
                  const isAccent = i === 0;
                  return (
                    <span
                      key={s}
                      className={`px-3.5 py-2 rounded-full border text-[13px] font-medium ${
                        isAccent
                          ? "bg-[#ff5722] text-white border-[#ff5722]"
                          : "bg-white text-[#3d3d3a] border-[#d4d1c7]"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              {editMode ? (
                <>
                  <span aria-disabled="true" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#141413] text-white text-[14px] font-medium opacity-60 cursor-not-allowed">
                    Umów konsultację →
                  </span>
                  <span aria-disabled="true" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium opacity-60 cursor-not-allowed">
                    Napisz wiadomość
                  </span>
                </>
              ) : (
                <>
                  <Link
                    href={`/trainers/${trainer.id}/book`}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#141413] text-white text-[14px] font-medium hover:bg-[#ff5722] transition"
                  >
                    Umów konsultację →
                  </Link>
                  <Link
                    href={`/trainers/${trainer.id}#contact`}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium hover:bg-[#141413] hover:text-white hover:border-[#141413] transition"
                  >
                    Napisz wiadomość
                  </Link>
                </>
              )}
            </div>
          </div>

          <div
            className="rounded-3xl overflow-hidden bg-white border border-[#e8e6df] w-full max-w-[440px] @[1024px]:max-w-none"
            style={{ boxShadow: "0 30px 60px -30px rgba(20,20,19,.15)" }}
          >
            <EditableStudioImage
              field="heroPhoto"
              current={stCopy.heroPhoto}
              currentFocal={stCopy.heroPhotoFocal}
              hidden={stCopy.heroPhotoHidden}
              fallback={heroPhoto}
              alt={trainer.name}
              containerClassName="h-[360px] @[640px]:h-[440px] @[1024px]:h-[520px]"
              editable={editMode}
            />
            <div className="px-6 py-7 @[1024px]:px-7 @[1024px]:py-8 grid gap-5">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#77756f]">Baza</span>
                <span className="font-medium">{city}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#77756f]">Staż</span>
                <span className="font-medium">{trainer.experience} {trainer.experience === 1 ? "rok" : "lat"} praktyki</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#77756f]">Ocena</span>
                <span className="px-2.5 py-[3px] rounded-full bg-[#ffeadb] text-[#ff5722] font-medium">
                  {ratingDisplay}{trainer.reviewCount > 0 ? ` ★ · ${trainer.reviewCount} opinii` : ""}
                </span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#77756f]">Stawka</span>
                <span className="font-medium">od {Math.min(...trainer.services.map((s) => s.price), 999) === 999 ? "—" : `${Math.min(...trainer.services.map((s) => s.price))} zł`} / sesja</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#77756f]">Języki</span>
                <span className="font-medium">{trainer.languages.join(" · ") || "Polski"}</span>
              </div>
              {/* Video intro pill — opens fullscreen video lightbox. Hidden in
                  view mode when no clip uploaded; in edit mode shows the
                  upload chip so the trainer can attach a clip without leaving
                  the canvas. */}
              {(editMode || trainer.customization.cinematicVideoIntroUrl) && (
                <div className="pt-2">
                  <VideoIntroButton
                    videoUrl={trainer.customization.cinematicVideoIntroUrl ?? null}
                    editMode={editMode}
                    theme="light"
                    accentColor="#ff5722"
                    label={
                      <Stu k="videoIntroLabel" fb="Obejrzyj film o mnie" maxLength={60} rich={false} />
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* SPECIALIZATIONS strip — animated marquee for visitors, editable list
          (with ✕ on each + "+ Dodaj" picker) for the trainer in /studio/design.
          See StudioTicker for the marquee-jump fix (pads each copy to ≥8 specs
          so a single-spec trainer's track is wide enough for a seamless loop). */}
      <StudioTicker
        specializations={effectiveSpecs}
        globalSpecs={trainer.specializations}
        editMode={editMode}
      />

      <div className="mx-auto max-w-[1340px] px-6 sm:px-10">

        {/* ABOUT — collage grid */}
        <section id="about" data-section-id="about" className="py-20 sm:py-24 border-t border-transparent scroll-mt-20">
          {editMode && (
            <SectionAITextButton
              label="O mnie"
              currentText={trainer.about}
              onGenerate={generateAboutVariants}
              onApply={applyAboutVariant}
              template="studio"
              pillClassName={AI_PILL_THEMES.studio}
            />
          )}
          <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
            <div>
              <div className="text-[14px] text-[#77756f] font-medium mb-3">
                <span style={{ color: "#ff5722" }}>→</span>{" "}
                <Stu k="aboutLabel" fb="01 / Kim jestem" maxLength={40} rich={false} />
              </div>
              <h2
                className="font-medium m-0"
                style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
              >
                <Stu k="aboutH2" fb="Metoda<br><em>w skrócie</em>" maxLength={120} />
              </h2>
            </div>
            <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
              <Stu
                k="aboutSub"
                fb="Każdy plan zaczynam od pytania: co dokładnie chcesz odzyskać. Reszta to metodyczna praca — bez skrótów, bez ozdobników."
                multiline
                block
                maxLength={400}
              />
            </p>
          </div>

          <div className="grid @[1024px]:grid-cols-3 gap-5">
            {/* Big philosophy — dark cell, spans 2 cols/2 rows on desktop */}
            <div
              className="@[1024px]:col-span-2 @[1024px]:row-span-2 bg-[#141413] text-white rounded-[20px] p-7 @[1024px]:p-9 flex flex-col gap-3.5"
            >
              <div className="text-[12px] uppercase tracking-[0.08em] font-medium text-white/50">
                <Stu k="aboutPhilosophyLabel" fb="Filozofia" maxLength={40} rich={false} />
              </div>
              <h3
                className="font-medium m-0 leading-[1.1]"
                style={{ fontSize: "clamp(26px, 3cqw, 42px)", letterSpacing: "-0.02em" }}
              >
                <Stu
                  k="aboutPhilosophyHead"
                  fb="Ciało ma pamięć. Moją rolą jest przypomnieć mu, jak było, i nauczyć je czegoś lepszego."
                  maxLength={300}
                  multiline
                  block
                />
              </h3>
              <p className="text-[15px] leading-[1.6] text-white/75 m-0">
                <Stu
                  k="aboutPhilosophyBody"
                  fb={trainer.about || "Pracuję metodycznie: diagnoza, plan, pomiar, korekta. Każdy klient dostaje własną drogę — nie kopię gotowego programu."}
                  multiline
                  block
                  rich={false}
                  maxLength={800}
                />
              </p>
              {/* Credential pills — first 3 trainer certifications stripped to
                  short labels. Mirrors the dark cell's bottom-row in the
                  source design (Fizjoterapeutka / Certified FMS / Dry
                  Needling). Anchored with mt-auto so it always sticks to the
                  bottom even when the body text is short. Falls back to the
                  trainer's specializations if there are no certifications. */}
              {(() => {
                const credentials = (trainer.certifications.length > 0
                  ? trainer.certifications
                  : effectiveSpecs.map(getSpecLabel).filter((s): s is string => !!s)
                )
                  .slice(0, 3)
                  .map((c) => {
                    // Strip year + filler punctuation so each pill stays compact.
                    return c
                      .replace(/(?:^|\s|·|-|\()\d{4}(?:\s|·|-|\)|$)/g, " ")
                      .replace(/\s*[·–—-]\s*$/, "")
                      .replace(/\s+/g, " ")
                      .trim();
                  })
                  .filter(Boolean);
                if (credentials.length === 0) return null;
                return (
                  <div className="mt-auto flex gap-2 flex-wrap pt-2">
                    {credentials.map((c, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 border border-white/20 rounded-full text-[12px] text-white/85 truncate max-w-[200px]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Stat card — accent (orange) */}
            <div className="bg-[#ff5722] text-white rounded-[20px] p-7 flex flex-col gap-3.5">
              <div className="text-[12px] uppercase tracking-[0.08em] font-medium text-white/70">Staż</div>
              <div className="text-[64px] font-medium leading-none" style={{ letterSpacing: "-0.04em" }}>
                {trainer.experience}
              </div>
              <div className="text-[13px] text-white/80 mt-auto">{trainer.experience === 1 ? "Rok" : "Lat"} praktyki</div>
            </div>

            {/* Photo cell */}
            <EditableStudioImage
              field="aboutCollagePhoto"
              current={stCopy.aboutCollagePhoto}
              currentFocal={stCopy.aboutCollagePhotoFocal}
              hidden={stCopy.aboutCollagePhotoHidden}
              fallback={galleryPhotos[0] ?? FALLBACK_PORTRAIT}
              alt=""
              containerClassName="bg-[#e8e6df] rounded-[20px] aspect-square"
              editable={editMode}
            />

            {/* Stat card — lime */}
            <div className="bg-[#dbff3c] rounded-[20px] p-7 flex flex-col gap-3.5">
              <div className="text-[12px] uppercase tracking-[0.08em] font-medium text-[#3d3d3a]">Klienci</div>
              <div className="text-[64px] font-medium leading-none text-[#141413]" style={{ letterSpacing: "-0.04em" }}>
                {trainer.reviewCount > 0 ? `${trainer.reviewCount}+` : "—"}
              </div>
              <div className="text-[13px] text-[#3d3d3a] mt-auto">Osób przeprowadzonych</div>
            </div>

            {/* Stat card — paper */}
            <div className="bg-white border border-[#e8e6df] rounded-[20px] p-7 flex flex-col gap-3.5">
              <div className="text-[12px] uppercase tracking-[0.08em] font-medium text-[#77756f]">Ocena</div>
              <div className="text-[64px] font-medium leading-none" style={{ letterSpacing: "-0.04em" }}>
                {ratingDisplay}
                <span style={{ color: "#ff5722" }}>★</span>
              </div>
              <div className="text-[13px] text-[#77756f] mt-auto">{trainer.reviewCount} pisemne opinie</div>
            </div>
          </div>
        </section>

        {/* CASE STUDIES — narrative cards (alternating photo side). The
            cases live in customization.studioCopy.cases as a free-form array;
            in editMode the trainer can add/remove/edit. In view mode, if the
            array is empty we render 3 hardcoded placeholder cases so a fresh
            trainer's public page isn't an empty section. Photos cycle from
            trainer.gallery (fallback: stock). */}
        {(() => {
          const savedCases: StudioCaseStudy[] = stCopy.cases ?? [];
          const casesNeverSet = stCopy.cases === undefined;
          // Default placeholders shown only when no real cases exist AND the
          // viewer isn't editing (so a fresh public page reads as designed).
          const PLACEHOLDERS: Array<{
            tag: string; title: string; body: string;
            stats: Array<{ v: string; l: string }>;
          }> = [
            {
              tag: "Rehabilitacja ACL",
              title: "Od zerwania więzadła do gry w ekstraklasie — w 6 miesięcy.",
              body: "Klient M., 24 lata, piłkarz półzawodowy. Zerwanie ACL prawego kolana w trakcie meczu. Plan: diagnostyka, rekonstrukcja, 24-tygodniowy protokół powrotu do sportu z pomiarami co 4 tygodnie.",
              stats: [
                { v: "24 tyg", l: "Od operacji do meczu" },
                { v: "100%", l: "Symetria siły Q/H" },
                { v: "0", l: "Nawroty w 18 mies." },
              ],
            },
            {
              tag: "Prewencja · Maraton",
              title: "Zbudowanie odporności kolana na obciążenia maratońskie.",
              body: "Klientka J., 38 lat, ultramaratonka amatorka. Cel: przebiec 100 km bez bólu kolana. 12-tygodniowy program wzmacniania w oparciu o ocenę FMS i analizę wideo biegu.",
              stats: [
                { v: "12 tyg", l: "Czas programu" },
                { v: "+34%", l: "Siły czworogłowych" },
                { v: "100km", l: "Ukończonych bez bólu" },
              ],
            },
            {
              tag: "Terapia · Kręgosłup",
              title: "Przewlekły ból lędźwi → powrót do codziennego treningu.",
              body: "Klient P., 42 lata, manager IT. 3 lata przewlekłego bólu lędźwiowego. Łączenie terapii manualnej, dry needlingu i progresywnego planu mobilności. Sesje 2 × w tygodniu.",
              stats: [
                { v: "8 tyg", l: "Do zniknięcia bólu" },
                { v: "-70%", l: "VAS po 4 tyg." },
                { v: "3×/tydz", l: "Trening siłowy dziś" },
              ],
            },
          ];

          // In view mode with no saved cases, render placeholders. In edit
          // mode we always show the saved array (empty → no cards, just the
          // "+ Dodaj" tile) so the trainer's reality matches the editor.
          const usePlaceholders = !editMode && savedCases.length === 0;

          // Hide section entirely on public when there's nothing AND we're
          // not falling back to placeholders (we always do, so this is dead
          // code — kept for safety in case we change defaults later).
          if (!editMode && savedCases.length === 0 && PLACEHOLDERS.length === 0) {
            return null;
          }

          return (
            <section id="cases" data-section-id="cases" className="py-20 sm:py-24 border-t border-[#e8e6df] scroll-mt-20">
              {editMode && (
                <SectionAICasesButton
                  currentCasesCount={savedCases.length}
                  template="studio"
                  pillClassName={AI_PILL_THEMES.studio}
                />
              )}
              <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
                <div>
                  <div className="text-[14px] text-[#77756f] font-medium mb-3">
                    <span style={{ color: "#ff5722" }}>→</span>{" "}
                    <Stu k="casesLabel" fb="02 / Prace" maxLength={40} rich={false} />
                  </div>
                  <h2
                    className="font-medium m-0"
                    style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
                  >
                    <Stu k="casesH2" fb="Wybrane<br><em>case studies</em>" maxLength={120} />
                  </h2>
                </div>
                <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
                  <Stu
                    k="casesSub"
                    fb="Trzy przypadki, które opowiadają o metodzie. Zgoda klientów na publikację anonimowych danych — uzyskana."
                    multiline
                    block
                    maxLength={300}
                  />
                </p>
              </div>

              {editMode ? (
                <StudioCasesEditor
                  initialCases={savedCases}
                  galleryPhotos={galleryPhotos}
                  casesNeverSet={casesNeverSet}
                />
              ) : (
                <div className="grid gap-5">
                  {(usePlaceholders ? PLACEHOLDERS : savedCases).map((item, n) => {
                    const reverse = n % 2 === 1;
                    // PLACEHOLDERS use a different shape than StudioCaseStudy;
                    // unify into a flat read-only set of strings here.
                    const isPh = "stats" in item;
                    // Real cases prefer their own uploaded photo; fall back to
                    // the trainer's gallery (or stock) so the layout is never
                    // empty even on a fresh trainer profile.
                    const photo =
                      (!isPh && item.photo) ||
                      galleryPhotos[n + 1] ||
                      galleryPhotos[n] ||
                      FALLBACK_GALLERY[n % FALLBACK_GALLERY.length] ||
                      FALLBACK_PORTRAIT;
                    const tag = isPh ? item.tag : item.tag ?? "Kategoria";
                    const title = isPh ? item.title : item.title ?? "Tytuł case study.";
                    const body = isPh ? item.body : item.body ?? "Krótki opis — kontekst, plan, wynik.";
                    const stats = isPh
                      ? item.stats
                      : [
                          { v: item.stat1 ?? "—", l: item.stat1Label ?? "Wskaźnik" },
                          { v: item.stat2 ?? "—", l: item.stat2Label ?? "Wskaźnik" },
                          { v: item.stat3 ?? "—", l: item.stat3Label ?? "Wskaźnik" },
                        ];
                    const bodyEl = (
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.05em] uppercase mb-3" style={{ color: "#ff5722" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722]" />
                          <span dangerouslySetInnerHTML={{ __html: tag }} />
                        </div>
                        <h3
                          className="font-medium m-0 mb-3"
                          style={{ fontSize: "clamp(22px, 2.6cqw, 36px)", letterSpacing: "-0.025em", lineHeight: 1.1 }}
                        >
                          <span dangerouslySetInnerHTML={{ __html: title }} />
                        </h3>
                        <p
                          className="text-[15px] leading-[1.6] text-[#3d3d3a] m-0 mb-5"
                          dangerouslySetInnerHTML={{ __html: body }}
                        />
                        <div className="flex gap-6 pt-5 border-t border-[#e8e6df] flex-wrap">
                          {stats.map((s, i) => (
                            <div key={i} className="min-w-[80px]">
                              <div
                                className="text-[24px] @[640px]:text-[28px] font-medium"
                                style={{ letterSpacing: "-0.02em", color: "#141413" }}
                                dangerouslySetInnerHTML={{ __html: s.v }}
                              />
                              <div
                                className="text-[12px] text-[#77756f] mt-0.5"
                                dangerouslySetInnerHTML={{ __html: s.l }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                    const photoFocal = (!isPh && item.photoFocal) || "center";
                    const photoEl = (
                      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#e8e6df]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt=""
                          className="w-full h-full object-cover"
                          style={{ objectPosition: photoFocal }}
                        />
                      </div>
                    );
                    return (
                      <div
                        key={isPh ? n : item.id}
                        className={`bg-white border border-[#e8e6df] rounded-[28px] p-6 @[640px]:p-8 grid gap-6 @[1024px]:gap-10 items-center ${
                          reverse ? "@[1024px]:grid-cols-[1.2fr_1fr]" : "@[1024px]:grid-cols-[1fr_1.2fr]"
                        } hover:border-[#141413] transition`}
                      >
                        {reverse ? (<>{photoEl}{bodyEl}</>) : (<>{bodyEl}{photoEl}</>)}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {/* SERVICES */}
        {(editMode || services.length > 0) && (
          <section id="services" data-section-id="services" className="py-20 sm:py-24 border-t border-[#e8e6df] scroll-mt-20">
            {editMode && (
              <SectionAIServicesButton
                currentServicesCount={services.length}
                template="studio"
                pillClassName={AI_PILL_THEMES.studio}
              />
            )}
            <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
              <div>
                <div className="text-[14px] text-[#77756f] font-medium mb-3">
                  <span style={{ color: "#ff5722" }}>→</span>{" "}
                  <Stu k="servicesLabel" fb="03 / Usługi" maxLength={40} rich={false} />
                </div>
                <h2
                  className="font-medium m-0"
                  style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
                >
                  <Stu k="servicesH2" fb="Jak<br><em>współpracujemy</em>" maxLength={120} />
                </h2>
              </div>
              <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
                <Stu
                  k="servicesSub"
                  fb="Cztery formaty — od jednorazowej oceny, po długoterminowe prowadzenie sportowców."
                  multiline
                  block
                  maxLength={300}
                />
              </p>
            </div>

            {editMode ? (
              <StudioServicesEditor
                services={trainer.services
                  .filter((s): s is Service & { id: string } => !!s.id)
                  .map((s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    duration: s.duration,
                    price: s.price,
                  }))}
                overrides={trainer.customization.serviceOverrides ?? {}}
              />
            ) : (
              <div className="grid @[640px]:grid-cols-2 gap-4">
                {services.map((svc, i) => {
                  const glyph = String(i + 1).padStart(2, "0");
                  return (
                    <Link
                      key={svc.id ?? i}
                      href={svc.id ? `/trainers/${trainer.id}/book?service=${svc.id}` : `/trainers/${trainer.id}/book`}
                      className="group relative bg-white border border-[#e8e6df] rounded-[20px] p-7 flex flex-col gap-3.5 hover:border-[#141413] transition overflow-hidden"
                    >
                      <span className="absolute top-6 right-6 text-[22px] text-[#77756f] group-hover:text-[#ff5722] transition">↗</span>
                      <div className="flex gap-3 items-center">
                        <div
                          className="w-11 h-11 rounded-xl bg-[#ffeadb] text-[#ff5722] inline-flex items-center justify-center font-semibold italic tabular-nums"
                          style={{ fontSize: 18, letterSpacing: "-0.02em", lineHeight: 1 }}
                        >
                          {glyph}
                        </div>
                        <div className="text-[20px] tracking-[-0.015em] font-medium">{svc.name}</div>
                      </div>
                      <div className="text-[14px] text-[#3d3d3a] leading-[1.55]">{svc.description}</div>
                      <div className="flex justify-between items-center pt-4 border-t border-[#e8e6df] mt-auto">
                        <span className="text-[12px] text-[#77756f]">
                          {svc.duration} min ·{" "}
                          <span
                            dangerouslySetInnerHTML={{
                              __html:
                                (svc.id && trainer.customization.serviceOverrides?.[svc.id]?.meta) ||
                                "sala",
                            }}
                          />
                        </span>
                        <span className="text-[18px] font-semibold tracking-[-0.01em]">{svc.price} zł</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* PACKAGES */}
        {(editMode || packages.length > 0) && (
          <section id="packages" data-section-id="packages" className="py-20 sm:py-24 border-t border-[#e8e6df] scroll-mt-20">
            {editMode && (
              <SectionAIPackagesButton
                currentPackagesCount={packages.length}
                template="studio"
                pillClassName={AI_PILL_THEMES.studio}
              />
            )}
            <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
              <div>
                <div className="text-[14px] text-[#77756f] font-medium mb-3">
                  <span style={{ color: "#ff5722" }}>→</span>{" "}
                  <Stu k="packagesLabel" fb="04 / Pakiety" maxLength={40} rich={false} />
                </div>
                <h2
                  className="font-medium m-0"
                  style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
                >
                  <Stu k="packagesH2" fb="Długoterminowe<br><em>programy</em>" maxLength={120} />
                </h2>
              </div>
              <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
                <Stu
                  k="packagesSub"
                  fb="Rabaty do 20% względem sesji pojedynczych. Każdy pakiet zaczyna się od bezpłatnej rozmowy."
                  multiline
                  block
                  maxLength={300}
                />
              </p>
            </div>

            {editMode ? (
              <StudioPackagesEditor
                packages={trainer.packages.map((p) => ({
                  id: p.id,
                  name: p.name,
                  description: p.description ?? "",
                  items: p.items ?? [],
                  price: p.price,
                  period: p.period ?? undefined,
                  featured: !!p.featured,
                }))}
                overrides={trainer.customization.packageOverrides ?? {}}
              />
            ) : (
              <div className="grid @[1024px]:grid-cols-3 gap-4">
                {packages.slice(0, 3).map((pkg, i) => {
                  const featured = !!pkg.featured;
                  const tierLabels = ["Start", "Powrót do gry", "Performance"];
                  return (
                    <div
                      key={pkg.id}
                      className={`relative rounded-[24px] p-8 flex flex-col gap-4.5 ${
                        featured
                          ? "bg-[#141413] text-white border border-[#141413]"
                          : "bg-white border border-[#e8e6df]"
                      }`}
                    >
                      {featured && (
                        <span className="absolute top-5 right-5 px-2.5 py-[5px] rounded-full bg-[#dbff3c] text-[#141413] text-[11px] font-semibold">
                          ★ Polecany
                        </span>
                      )}
                      <div className={`text-[13px] tracking-[0.04em] uppercase font-semibold ${featured ? "text-[#dbff3c]" : "text-[#ff5722]"}`}>
                        {tierLabels[i] ?? `Tier ${i + 1}`}
                      </div>
                      <div className="text-[30px] tracking-[-0.025em] font-medium leading-none -mt-1">{pkg.name}</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[42px] tracking-[-0.03em] font-medium leading-none">{pkg.price} zł</span>
                        <span className={`text-[13px] ${featured ? "text-white/50" : "text-[#77756f]"}`}>/ {pkg.period ?? "miesiąc"}</span>
                      </div>
                      {pkg.description && (
                        <div className={`text-[14px] leading-[1.55] ${featured ? "text-white/70" : "text-[#3d3d3a]"}`}>
                          {pkg.description}
                        </div>
                      )}
                      <div className={`h-px ${featured ? "bg-white/15" : "bg-[#e8e6df]"}`} />
                      <ul className="list-none p-0 m-0 grid gap-2.5">
                        {(pkg.items ?? []).map((item, idx) => (
                          <li
                            key={idx}
                            className={`flex gap-2.5 items-start text-[14px] leading-[1.45] ${featured ? "text-white/85" : "text-[#3d3d3a]"}`}
                          >
                            <span
                              className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0 mt-[1px] ${
                                featured ? "bg-[#dbff3c] text-[#141413]" : "bg-[#ffeadb] text-[#ff5722]"
                              }`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/trainers/${trainer.id}/book?package=${pkg.id}`}
                        className={`mt-auto inline-flex justify-center items-center h-11 px-5 rounded-full text-[14px] font-medium transition ${
                          featured
                            ? "bg-[#ff5722] text-white border border-[#ff5722] hover:bg-white hover:text-[#141413] hover:border-white"
                            : "bg-transparent text-[#141413] border border-[#d4d1c7] hover:bg-[#141413] hover:text-white hover:border-[#141413]"
                        }`}
                      >
                        Wybierz →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* GALLERY */}
        {(editMode || trainer.gallery.length > 0) && (
          <section id="gallery" data-section-id="gallery" className="py-20 sm:py-24 border-t border-[#e8e6df] scroll-mt-20">
            <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
              <div>
                <div className="text-[14px] text-[#77756f] font-medium mb-3">
                  <span style={{ color: "#ff5722" }}>→</span>{" "}
                  <Stu k="galleryLabel" fb="05 / Galeria" maxLength={40} rich={false} />
                </div>
                <h2
                  className="font-medium m-0"
                  style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
                >
                  <Stu k="galleryH2" fb="Atelier<br><em>w kadrze</em>" maxLength={120} />
                </h2>
              </div>
              <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
                <Stu
                  k="gallerySub"
                  fb="Przestrzeń pracy, sprzęt, sesje. Bez filtrów marketingowych — tak to wygląda naprawdę."
                  multiline
                  block
                  maxLength={300}
                />
              </p>
            </div>
            {editMode ? (
              <StudioGalleryEditor items={galleryItems} focalMap={galleryFocal} />
            ) : (
              <StudioGalleryView items={galleryPhotosForView} />
            )}
          </section>
        )}

        {/* CERTIFICATIONS */}
        {trainer.certifications.length > 0 && (
          <section id="certifications" data-section-id="certifications" className="py-20 sm:py-24 border-t border-[#e8e6df] scroll-mt-20">
            <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
              <div>
                <div className="text-[14px] text-[#77756f] font-medium mb-3">
                  <span style={{ color: "#ff5722" }}>→</span>{" "}
                  <Stu k="certificationsLabel" fb="06 / Akredytacje" maxLength={40} rich={false} />
                </div>
                <h2
                  className="font-medium m-0"
                  style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
                >
                  <Stu k="certificationsH2" fb="Certyfikaty<br><em>i szkolenia</em>" maxLength={120} />
                </h2>
              </div>
              <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
                <Stu
                  k="certificationsSub"
                  fb="Pełne wykształcenie zawodowe i certyfikaty potwierdzające kompetencje w specjalizacji."
                  multiline
                  block
                  maxLength={300}
                />
              </p>
            </div>
            <div className="bg-white border border-[#e8e6df] rounded-[20px] overflow-hidden">
              {trainer.certifications.map((cert, i) => {
                const detail = trainer.certificationDetails?.[i];
                // Cert strings often follow "Year · Name · Org" or "Name (Year)"
                // patterns. We extract a year if one is plainly there, otherwise
                // show a numeric counter ("01", "02") in the year-accent slot.
                const yearMatch = cert.match(/(?:^|\s|·|-|\()(\d{4})(?:\s|·|-|\)|$)/);
                const year = yearMatch?.[1] ?? String(i + 1).padStart(2, "0");
                const restText = cert.replace(yearMatch?.[0] ?? "", " ").replace(/\s+/g, " ").trim() || cert;
                return (
                  <div
                    key={detail?.id ?? i}
                    className={`grid @[640px]:grid-cols-[120px_1fr_auto] gap-3 @[640px]:gap-6 p-6 @[640px]:px-7 items-center hover:bg-[#fafaf7] transition ${
                      i < trainer.certifications.length - 1 ? "border-b border-[#e8e6df]" : ""
                    }`}
                  >
                    <div className="text-[28px] font-medium" style={{ color: "#ff5722", letterSpacing: "-0.02em" }}>
                      {year}
                    </div>
                    <div>
                      <div className="text-[17px] font-medium" style={{ letterSpacing: "-0.01em" }}>{restText}</div>
                    </div>
                    {detail?.verificationUrl ? (
                      <a
                        href={detail.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-[#77756f] hover:text-[#ff5722] transition"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Zweryfikowano ↗
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-[#77756f]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d4d1c7]" />
                        Certyfikat
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* REVIEWS */}
        {(trainer.reviews.length > 0 || trainer.reviewCount > 0) && (
          <section id="reviews" data-section-id="reviews" className="py-20 sm:py-24 border-t border-[#e8e6df] scroll-mt-20">
            <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-14 items-end mb-12">
              <div>
                <div className="text-[14px] text-[#77756f] font-medium mb-3">
                  <span style={{ color: "#ff5722" }}>→</span>{" "}
                  <Stu k="reviewsLabel" fb="07 / Opinie" maxLength={40} rich={false} />
                </div>
                <h2
                  className="font-medium m-0"
                  style={{ fontSize: "clamp(36px, 5.5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.035em" }}
                >
                  <Stu k="reviewsH2" fb="Co mówią<br><em>klienci</em>" maxLength={120} />
                </h2>
              </div>
              <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d3d3a] m-0 max-w-[560px]">
                <Stu
                  k="reviewsSub"
                  fb={`${trainer.reviewCount} pisemnych opinii po zakończeniu współpracy.`}
                  multiline
                  block
                  maxLength={300}
                />
              </p>
            </div>

            {/* Dark hero card — score + AI insight */}
            <div className="grid @[1024px]:grid-cols-[1fr_1.3fr] gap-6 @[1024px]:gap-10 p-9 @[1024px]:px-10 @[1024px]:py-9 bg-[#141413] text-white rounded-3xl mb-6 items-center">
              <div>
                <div
                  className="font-medium leading-none"
                  style={{ fontSize: "clamp(72px, 10cqw, 120px)", letterSpacing: "-0.04em" }}
                >
                  {ratingDisplay}
                  <em style={{ color: "#ff5722", fontStyle: "normal" }}>★</em>
                </div>
                <div className="text-[18px] tracking-[0.3em] mt-1" style={{ color: "#ff5722" }}>★★★★★</div>
                <div className="text-[13px] text-white/60 mt-2 uppercase tracking-[0.05em]">
                  {trainer.reviewCount} opinii · średnia z 18 miesięcy
                </div>
              </div>
              <div className="text-[16px] @[640px]:text-[20px] leading-[1.5] text-white/85" style={{ letterSpacing: "-0.01em" }}>
                <Stu
                  k="reviewsAiInsight"
                  fb="Klienci wracają, bo widzą efekty — pomiar po pomiarze. Reszta — w zaktualizowanym harmonogramie, za zgodą obu stron."
                  multiline
                  block
                  maxLength={400}
                />
              </div>
            </div>

            {reviews.length > 0 && (
              <div className="grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="bg-white border border-[#e8e6df] rounded-[20px] p-6">
                    <div className="text-[13px] tracking-[0.15em] mb-3.5" style={{ color: "#ff5722" }}>
                      {"★".repeat(Math.max(1, Math.round(rev.rating || 5)))}
                    </div>
                    <p className="text-[16px] sm:text-[17px] leading-[1.55] text-[#141413] m-0 mb-4" style={{ letterSpacing: "-0.005em" }}>
                      „{rev.text}"
                    </p>
                    {rev.replyText && (
                      <div className="mt-3 mb-4 pl-3 border-l-2 border-[#ff5722]/40">
                        <div className="text-[10.5px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color: "#ff5722" }}>
                          Odpowiedź od trenera
                        </div>
                        <p className="text-[13.5px] text-[#3d3d3a] leading-[1.55] m-0 whitespace-pre-line">
                          {rev.replyText}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-3 items-center pt-4 border-t border-[#e8e6df]">
                      <div className="w-[38px] h-[38px] rounded-full bg-[#e8e6df] inline-flex items-center justify-center text-[14px] font-semibold text-[#77756f] overflow-hidden">
                        {rev.authorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={rev.authorAvatar} alt={rev.authorName} className="w-full h-full object-cover" />
                        ) : (
                          rev.authorName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="text-[15px] font-medium">{rev.authorName}</div>
                        {rev.date && <div className="text-[13px] text-[#77756f] mt-0.5">{rev.date}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {trainer.reviewCount > reviews.length && (
              <div className="text-center mt-8">
                <Link
                  href={`/trainers/${trainer.id}#reviews`}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium hover:bg-[#141413] hover:text-white hover:border-[#141413] transition"
                >
                  Zobacz wszystkie {trainer.reviewCount} opinie →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* FINAL CTA — lime panel */}
        <section className="my-20 sm:my-24 px-8 @[640px]:px-14 py-16 @[640px]:py-20 rounded-[32px] bg-[#dbff3c] relative overflow-hidden">
          <div className="text-[14px] text-[#3d3d3a] font-medium mb-4">
            <span style={{ color: "#ff5722" }}>→</span>{" "}
            <Stu k="finalLabel" fb="08 / Zaczynamy?" maxLength={40} rich={false} />
          </div>
          <h2
            className="font-medium m-0 mb-6"
            style={{ fontSize: "clamp(44px, 8cqw, 84px)", lineHeight: 0.95, letterSpacing: "-0.04em", maxWidth: 720 }}
          >
            <Stu k="finalH2" fb="Opowiedz mi<br>swoją<em> historię.</em>" maxLength={200} />
          </h2>
          <p
            className="text-[16px] @[640px]:text-[19px] leading-[1.5] text-[#3d3d3a] m-0 mb-9"
            style={{ maxWidth: 520 }}
          >
            <Stu
              k="finalSub"
              fb="Pierwsza 15-minutowa rozmowa jest bezpłatna. Powiem ci uczciwie, czy jestem właściwą osobą do tej pracy."
              multiline
              block
              maxLength={400}
            />
          </p>
          <div className="flex gap-3 flex-wrap">
            {editMode ? (
              <>
                <span aria-disabled="true" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[#ff5722] text-white text-[14px] font-medium opacity-60 cursor-not-allowed">
                  <Stu k="finalCtaPrimary" fb="Umów bezpłatną rozmowę →" maxLength={60} rich={false} />
                </span>
                <span aria-disabled="true" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium opacity-60 cursor-not-allowed">
                  <Stu k="finalCtaSecondary" fb="Napisz wiadomość" maxLength={60} rich={false} />
                </span>
              </>
            ) : (
              <>
                <Link
                  href={`/trainers/${trainer.id}/book`}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[#ff5722] text-white text-[14px] font-medium hover:bg-[#141413] transition"
                >
                  <Stu k="finalCtaPrimary" fb="Umów bezpłatną rozmowę →" maxLength={60} rich={false} />
                </Link>
                <Link
                  href={`/trainers/${trainer.id}#contact`}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-transparent text-[#141413] border border-[#d4d1c7] text-[14px] font-medium hover:bg-[#141413] hover:text-white hover:border-[#141413] transition"
                >
                  <Stu k="finalCtaSecondary" fb="Napisz wiadomość" maxLength={60} rich={false} />
                </Link>
              </>
            )}
          </div>
        </section>
      </div>

      {!isEmbed && (
        <footer className="border-t border-[#e8e6df]">
          <div className="mx-auto max-w-[1340px] px-6 sm:px-10 py-10 flex justify-between items-center text-[13px] text-[#77756f] flex-wrap gap-4">
            <div>© NaZdrow! 2026 · {trainer.name}</div>
            <div className="flex gap-6">
              <Link href="/regulamin" className="hover:text-[#141413] transition">Regulamin</Link>
              <Link href="/prywatnosc" className="hover:text-[#141413] transition">Prywatność</Link>
              {!isOwner && (
                <Link href={`/trainers/${trainer.id}#contact`} className="hover:text-[#141413] transition">
                  Kontakt
                </Link>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
