import Link from "next/link";
import type { Trainer, Service } from "@/types";
import { getSpecLabel } from "@/data/specializations";
import FavoriteButton from "./FavoriteButton";
import { applyServiceOverrides, applyPackageOverrides } from "./apply-overrides";
import EditableLuxCopy from "./EditableLuxCopy";
import EditableAboutInline from "./EditableAboutInline";
import EditableTemplateHeroImage from "./EditableTemplateHeroImage";
import LuxuryServicesEditor from "./LuxuryServicesEditor";
import LuxuryPackagesEditor from "./LuxuryPackagesEditor";
import LuxuryGalleryEditor from "./LuxuryGalleryEditor";
import LuxuryGalleryView from "./LuxuryGalleryView";
import VideoIntroButton from "./VideoIntroButton";
import LuxuryCases from "./LuxuryCases";
import EditableSpecializations from "./EditableSpecializations";
import SectionAITextButton from "./SectionAITextButton";
import SectionAIServicesButton from "./SectionAIServicesButton";
import SectionAIPackagesButton from "./SectionAIPackagesButton";
import SectionAICasesButton from "./SectionAICasesButton";
import { generateAboutVariants, applyAboutVariant } from "./ai-actions";
import { AI_PILL_THEMES } from "./ai-pill-themes";
import AutoHideHeader from "@/components/AutoHideHeader";

// Luxury = "tihaja roskosh" / editorial-magazine vibe. Designed pixel-close to
// designs/10-profile-luxury-desktop.html and 11-profile-luxury-mobile.html.
//
// Phase 1 implementation: render-only with fallback hardcoded copy. The
// luxuryCopy bag is wired through `t()` so future Phase 2 inline editors can
// commit to those keys without restructuring the render. Per-page service +
// package overrides + cert verification badges already work via the shared
// helpers from Phase 3 of the multi-page rollout.
//
// Palette: ivory bg #f6f1e8, sand #efe7d7, paper #fbf8f1, ink #1c1a15, muted
// #7a7365, hairlines #d9cfb8, accent gold #8a7346 (warm) + #b39668 (light).

const FALLBACK_PORTRAIT = "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=900&h=1200&fit=crop&crop=faces";
const FALLBACK_GALLERY = [
  "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=900&h=1200&fit=crop",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&h=600&fit=crop",
  "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=800&fit=crop",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=450&fit=crop",
  "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=1600&h=480&fit=crop",
];

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Roman lowercase (i, ii, iii, iv) for the services list — design uses this
 *  alongside uppercase Roman section numbers (I., II., III.). */
function romanLow(n: number): string {
  return (ROMAN[n] ?? String(n)).toLowerCase();
}

/** Year extractor for cert timeline. Looks for a 4-digit year token at the
 *  end of cert text (e.g., "Functional Movement Screen Level 1 (2018)") and
 *  returns it; falls back to "—" if none. */
function extractYear(text: string): string {
  const m = text.match(/(20\d{2}|19\d{2})\b/g);
  return m ? m[m.length - 1]! : "—";
}

export default function LuxuryProfile({
  trainer,
  editMode,
  isOwner,
  published,
  initialIsFavorite,
  needsLoginToFavorite,
  isEmbed = false,
}: {
  trainer: Trainer;
  editMode: boolean;
  isOwner: boolean;
  published: boolean;
  initialIsFavorite: boolean;
  needsLoginToFavorite: boolean;
  isEmbed?: boolean;
}) {
  const lux = trainer.customization.luxuryCopy ?? {};
  const t = (k: keyof typeof lux, fb: string): string => {
    const v = lux[k]?.trim();
    return v && v.length > 0 ? v : fb;
  };

  /** In editMode → render EditableLuxCopy (commits to luxury-copy-actions).
   *  In view → render the resolved string as HTML (sanitised on save).
   *  Pass `rich={false}` for plain-text fields (eyebrows, stamp labels, etc.). */
  const Lux = ({
    k,
    fb,
    multiline = false,
    block = false,
    maxLength = 200,
    rich = true,
    theme = "light",
  }: {
    k: keyof typeof lux;
    fb: string;
    multiline?: boolean;
    block?: boolean;
    maxLength?: number;
    rich?: boolean;
    theme?: "light" | "dark";
  }) => {
    if (editMode) {
      return (
        <EditableLuxCopy
          field={String(k)}
          initial={lux[k]}
          defaultValue={fb}
          maxLength={maxLength}
          multiline={multiline}
          block={block}
          rich={rich}
          theme={theme}
        />
      );
    }
    return <span dangerouslySetInnerHTML={{ __html: t(k, fb) }} />;
  };

  const services = applyServiceOverrides(trainer.services, trainer.customization);
  const packages = applyPackageOverrides(trainer.packages, trainer.customization);

  // Hero portrait fallback chain (highest priority first) when no per-page
  // luxuryCopy.heroPhoto is set:
  //   1. customization.coverImage (older /studio/profile cover upload)
  //   2. trainer.gallery[0]
  //   3. trainer.avatar
  //   4. editorial Unsplash placeholder
  const portraitFallback =
    trainer.customization.coverImage ||
    trainer.gallery[0] ||
    trainer.avatar ||
    FALLBACK_PORTRAIT;

  // Body paragraphs for the About section. If trainer has authored a luxury-
  // specific aboutBody, use that (split by blank lines). Otherwise fall back
  // to trainer.about. Otherwise three placeholder paragraphs.
  const aboutText = lux.aboutBody?.trim() || trainer.about || "";
  const aboutParas = aboutText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Stats — 4 boxes. Numbers come from real trainer fields; labels are
  // editable/translated.
  const stats: { v: string | number; em?: boolean; l: string }[] = [
    { v: trainer.experience, em: true, l: "Lat praktyki" },
    { v: trainer.reviewCount > 0 ? `${trainer.reviewCount}+` : "—", l: "Klientów" },
    { v: trainer.rating > 0 ? trainer.rating.toString().replace(".", ",") : "—", em: true, l: "Średnia ocen" },
    { v: trainer.reviews.length || "—", l: "Referencji" },
  ];

  // Gallery — first 6 photos, fall back to stock if trainer hasn't uploaded.
  // galleryHidden is per-page soft-delete; filter early so both editor + view
  // honour it and undo can restore via customization snapshots.
  const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
  const galleryItems = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
  const galleryFocal = trainer.customization.galleryFocal;
  const galleryPhotos: { url: string; id?: string; focal?: string }[] = galleryItems.length >= 6
    ? galleryItems.slice(0, 6).map((g) => ({ url: g.url, id: g.id, focal: galleryFocal?.[g.id] }))
    : galleryItems.length > 0
      ? [
          ...galleryItems.map((g) => ({ url: g.url, id: g.id, focal: galleryFocal?.[g.id] })),
          ...FALLBACK_GALLERY.map((url) => ({ url })),
        ].slice(0, 6)
      : FALLBACK_GALLERY.map((url) => ({ url }));
  // Full list (no 6-cap) for the LuxuryGalleryView lightbox so swipe covers
  // every photo even when only the first 6 are shown in the bento.
  const galleryPhotosFull: { url: string; id?: string; focal?: string }[] = galleryItems.length >= 6
    ? galleryItems.map((g) => ({ url: g.url, id: g.id, focal: galleryFocal?.[g.id] }))
    : galleryPhotos;
  // Reviews — limit to 4 in the grid; "Czytaj wszystkie" CTA shows count.
  const reviews = trainer.reviews.slice(0, 4);
  const ratingDisplay = trainer.rating > 0 ? trainer.rating.toString().replace(".", ",") : "—";
  // Big rating number splits at decimal: "4,9" → "4" + ",9" so the comma+digit
  // can be styled italic gold like the design.
  const ratingParts = ratingDisplay.split(",");
  const ratingMain = ratingParts[0] ?? "—";
  const ratingFrac = ratingParts.length > 1 ? `,${ratingParts[1]}` : "";

  // Monogram = first letter of the brand name shown next to it (default
  // "NaZdrow!" → "N"). Trainer can override brandName via inline edit; the
  // monogram automatically tracks whatever they type.
  const brandText = lux.brandName?.trim() || "NaZdrow!";
  const monoChar = brandText.charAt(0).toUpperCase();
  // Hero name split: first word + rest (rest gets italic-gold em styling per design).
  const nameParts = trainer.name.trim().split(/\s+/);
  const nameFirst = nameParts[0] ?? trainer.name;
  const nameRest = nameParts.slice(1).join(" ");

  // Per-page specializations override — falls back to the trainer's global
  // list. Luxury only surfaces the FIRST spec (as a hero meta eyebrow), but
  // we still wire the override so the per-page edit on other templates is
  // reflected here too.
  const effectiveSpecs = trainer.customization.specializations ?? trainer.specializations;
  const primarySpec = effectiveSpecs[0]
    ? getSpecLabel(effectiveSpecs[0])
    : "Trener osobisty";

  return (
    <div
      className="@container min-h-screen bg-[#f6f1e8] text-[#1c1a15] antialiased"
      style={{ containerType: "inline-size", zoom: isEmbed ? undefined : 0.9 }}
    >
      {/* CHROME — sticky luxury nav, auto-hides on scroll-down (re-shows on scroll-up). */}
      {!isEmbed && (
        <AutoHideHeader>
        <header className="bg-[#f6f1e8]/85 backdrop-blur-md backdrop-saturate-[1.4] border-b border-[#d9cfb8]">
          <div className="mx-auto max-w-[1340px] px-6 sm:px-10 h-[64px] sm:h-[72px] flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2.5">
              <Link href="/" aria-label="Strona główna">
                <span className="w-7 h-7 sm:w-[30px] sm:h-[30px] rounded-full border border-[#8a7346] text-[#8a7346] inline-flex items-center justify-center font-serif italic text-[13px] sm:text-[15px]">
                  {monoChar}
                </span>
              </Link>
              <span className="font-serif text-[18px] sm:text-[22px] tracking-[-0.015em] font-normal">
                <Lux k="brandName" fb="NaZdrow!" rich={false} maxLength={40} />
              </span>
            </div>
            <nav className="hidden @[1024px]:flex gap-8 text-[13px] text-[#3a3730] tracking-[0.02em]">
              <a href="#about" className="hover:text-[#8a7346] transition">{t("navAbout", "Filozofia")}</a>
              <a href="#cases" className="hover:text-[#8a7346] transition">{t("navCases", "Kejsy")}</a>
              <a href="#services" className="hover:text-[#8a7346] transition">{t("navServices", "Usługi")}</a>
              <a href="#packages" className="hover:text-[#8a7346] transition">{t("navPackages", "Programy")}</a>
              <a href="#certifications" className="hover:text-[#8a7346] transition">{t("navCertifications", "Akredytacje")}</a>
              <a href="#gallery" className="hover:text-[#8a7346] transition">{t("navGallery", "Atelier")}</a>
              <a href="#reviews" className="hover:text-[#8a7346] transition">{t("navReviews", "Referencje")}</a>
            </nav>
            <div className="flex gap-3 items-center">
              {!isOwner && (
                <FavoriteButton
                  slug={trainer.id}
                  initialIsFavorite={initialIsFavorite}
                  needsLogin={needsLoginToFavorite}
                  className="w-10 h-10 rounded-full border border-[#d9cfb8] text-[#1c1a15] inline-flex items-center justify-center hover:border-[#8a7346] hover:text-[#8a7346] transition disabled:opacity-70"
                  size={16}
                />
              )}
              {isOwner && (
                <Link
                  href="/studio/design"
                  title="Edytuj profil"
                  className="w-10 h-10 rounded-full border border-[#d9cfb8] text-[#1c1a15] inline-flex items-center justify-center hover:border-[#8a7346] hover:text-[#8a7346] transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Link>
              )}
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="hidden @[640px]:inline-flex items-center justify-center h-10 px-5 text-[12px] tracking-[0.18em] uppercase font-medium border border-[#1c1a15] text-[#1c1a15] hover:bg-[#1c1a15] hover:text-[#fbf8f1] transition"
              >
                Umów konsultację
              </Link>
            </div>
          </div>
        </header>
        </AutoHideHeader>
      )}

      {/* HERO — editorial split: photo left, text right */}
      <section className="mx-auto max-w-[1340px] px-6 sm:px-10 pt-4 sm:pt-5 pb-16">
        <div className="grid @[1024px]:grid-cols-[1.1fr_1fr] gap-10 @[1024px]:gap-16 items-center">
          {/* Photo */}
          <div className="relative bg-[#efe7d7]" style={{ aspectRatio: "1/1" }}>
            <EditableTemplateHeroImage
              template="luxury"
              current={lux.heroPhoto}
              currentFocal={lux.heroPhotoFocal}
              fallback={portraitFallback}
              alt={trainer.name}
              editable={editMode}
              className="w-full h-full object-cover [filter:saturate(0.88)_contrast(1.02)]"
              containerClassName="w-full h-full"
            />
            <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_#c8bc9f]" />
            <div className="absolute bottom-5 left-5 sm:bottom-6 sm:left-6 text-[#fbf8f1] flex flex-col gap-1 [text-shadow:0_1px_20px_rgba(0,0,0,0.4)]">
              <div className="font-serif italic font-light text-[36px] sm:text-[48px] leading-none tracking-[-0.02em]">
                <Lux k="heroStampNum" fb="nº 073" rich={false} maxLength={20} theme="dark" />
              </div>
              <div className="text-[10px] sm:text-[11px] tracking-[0.22em] uppercase">
                <Lux k="heroStampLabel" fb="Trener zaufany" rich={false} maxLength={30} theme="dark" />
              </div>
            </div>
          </div>

          {/* Text */}
          <div>
            <div className="text-[10px] sm:text-[11px] tracking-[0.24em] uppercase text-[#8a7346] font-medium">
              <Lux k="heroEyebrow" fb={`${primarySpec} · ${trainer.location.split(",")[0]}`} rich={false} maxLength={80} />
            </div>
            <h1
              className="font-serif font-light my-4 sm:my-5 text-[#1c1a15]"
              style={{ fontSize: "clamp(48px, 9cqw, 88px)", lineHeight: 0.95, letterSpacing: "-0.035em" }}
            >
              {nameFirst}
              {nameRest && (
                <>
                  <br />
                  <em className="italic font-normal text-[#8a7346]">{nameRest}</em>
                </>
              )}
            </h1>
            <p className="font-serif italic font-light text-[17px] sm:text-[22px] leading-[1.4] text-[#3a3730] max-w-[500px] m-0 mb-6">
              „<Lux k="heroTag" fb={trainer.tagline} multiline block maxLength={300} />"
            </p>

            {(editMode || trainer.customization.cinematicVideoIntroUrl) && (
              <div className="mb-9">
                <VideoIntroButton
                  videoUrl={trainer.customization.cinematicVideoIntroUrl ?? null}
                  editMode={editMode}
                  theme="light"
                  accentColor="#8a7346"
                  label={
                    <Lux k="videoIntroLabel" fb="Obejrzyj film o trenerze" maxLength={60} rich={false} />
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-9 gap-y-5 py-7 border-y border-[#d9cfb8] mb-8">
              <Meta k="Specjalizacja" v={primarySpec} serif />
              <Meta k="Doświadczenie" v={`${trainer.experience} lat`} serif />
              <Meta k="Lokalizacja" v={trainer.location} />
              <Meta k="Języki" v={trainer.languages.join(" · ") || "Polski"} />
            </div>

            {/* Specs editor — Luxury only surfaces the primary spec in the
                meta grid above, but trainers still need to manage the full
                list per page. Hidden in view mode. */}
            {editMode && (
              <div className="flex flex-wrap items-center gap-2 mb-7">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#7a7365] mr-1">Specjalizacje</span>
                <EditableSpecializations
                  current={effectiveSpecs}
                  globalSpecs={trainer.specializations}
                  chipClassName="text-[12px] px-3 py-1 rounded-full bg-white border border-[#d9cfb8] text-[#3a3730] tracking-[0.04em]"
                  addBtnClassName="border-[#8a7346]/40 text-[#8a7346] hover:border-[#8a7346] hover:bg-[#fbf8f1]"
                />
              </div>
            )}

            <div className="flex gap-3.5 items-center flex-wrap">
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="inline-flex items-center justify-center h-12 px-6 sm:px-7 text-[12px] tracking-[0.18em] uppercase font-medium bg-[#1c1a15] text-[#fbf8f1] hover:bg-[#8a7346] transition"
              >
                Umów konsultację
              </Link>
              <Link
                href={`/trainers/${trainer.id}/messages`}
                className="inline-flex items-center justify-center h-12 px-6 sm:px-7 text-[12px] tracking-[0.18em] uppercase font-medium border border-[#1c1a15] text-[#1c1a15] hover:bg-[#1c1a15] hover:text-[#fbf8f1] transition"
              >
                Napisz wiadomość
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* I. ABOUT — quote left, body right with drop-cap, then 4-stat row */}
      <section id="about" data-section-id="about" className="py-20 sm:py-24">
        <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
          {editMode && (
            <SectionAITextButton
              label="Filozofia"
              currentText={trainer.about}
              onGenerate={generateAboutVariants}
              onApply={applyAboutVariant}
              template="luxury"
              pillClassName={AI_PILL_THEMES.luxury}
            />
          )}
          <SectionHead
            num="I."
            h2={<Lux k="aboutH2" fb="Filozofia <em>pracy</em>" maxLength={80} />}
            sub={<Lux k="aboutSub" fb="Każdy klient jest indywidualną historią. Metoda, którą stosuję, rodzi się ze spotkania — nigdy z szablonu." multiline block maxLength={300} rich={false} />}
          />

          <div className="grid @[1024px]:grid-cols-[1fr_1.6fr] gap-10 @[1024px]:gap-20 max-w-[1100px] mx-auto">
            <div className="font-serif font-light italic text-[22px] sm:text-[32px] leading-[1.25] tracking-[-0.015em] text-[#1c1a15] border-l border-[#8a7346] pl-7 relative">
              <div className="font-serif text-[80px] leading-none text-[#8a7346] mt-5 mb-2">&ldquo;</div>
              <Lux
                k="aboutQuote"
                fb="Nie leczę urazów.<br>Przywracam ciału pamięć o tym, jak być wolnym."
                multiline
                block
                maxLength={300}
              />
            </div>
            <div>
              {editMode ? (
                <div className="text-[15px] sm:text-[16px] leading-[1.75] text-[#3a3730] whitespace-pre-line">
                  <EditableAboutInline
                    initial={trainer.about}
                    placeholder="Opowiedz swoją historię — podziel akapity pustą linią. Pierwsza litera pierwszego akapitu otrzyma editorial drop-cap."
                  />
                </div>
              ) : aboutParas.length === 0 ? (
                <p className="text-[16px] leading-[1.75] text-[#3a3730] m-0 italic">
                  Tu pojawi się Twoja historia — uzupełnij sekcję &laquo;O mnie&raquo; w edytorze.
                </p>
              ) : (
                aboutParas.map((p, i) => (
                  <p
                    key={i}
                    className={`text-[15px] sm:text-[16px] leading-[1.75] text-[#3a3730] m-0 mb-5 ${i === 0 ? "first-letter:font-serif first-letter:text-[56px] sm:first-letter:text-[64px] first-letter:leading-none first-letter:float-left first-letter:pr-2.5 first-letter:pt-1 first-letter:text-[#8a7346] first-letter:font-light" : ""}`}
                  >
                    {p}
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 @[1024px]:grid-cols-4 gap-y-6 mt-12 sm:mt-16 pt-8 border-t border-[#d9cfb8] max-w-[1000px] mx-auto">
            {stats.map((s, i) => (
              <div
                key={i}
                className={`text-center px-5 ${i < stats.length - 1 ? "@[1024px]:border-r border-[#d9cfb8]" : ""}`}
              >
                <div className="font-serif font-light text-[40px] sm:text-[52px] leading-none tracking-[-0.02em]">
                  {s.em ? <em className="italic text-[#8a7346]">{s.v}</em> : s.v}
                </div>
                <div className="text-[10px] tracking-[0.22em] uppercase text-[#7a7365] mt-3">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASES — narrative case studies between Filozofia and Services. Same
          shared studioCopy.cases data + actions; LuxuryCases applies serif
          italic chrome with Roman numerals so each case reads as an editorial
          studium spread. In editMode renders even when empty (auto-seeds 3). */}
      {(() => {
        const studioCopyForCases = trainer.customization.studioCopy ?? {};
        const casesArr = studioCopyForCases.cases ?? [];
        const casesNeverSet = !("cases" in studioCopyForCases);
        if (!editMode && casesArr.length === 0) return null;
        const galleryFallbacks = trainer.gallery.length > 0 ? trainer.gallery.slice(0, 6) : [];
        return (
          <section id="cases" data-section-id="cases" className="py-20 sm:py-24 border-t border-[#d9cfb8] scroll-mt-20">
            <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
              {editMode && (
                <SectionAICasesButton
                  currentCasesCount={casesArr.length}
                  template="luxury"
                  pillClassName={AI_PILL_THEMES.luxury}
                />
              )}
              <div className="mb-14">
                <div className="text-[11px] sm:text-[12px] tracking-[0.22em] uppercase text-[#7a7365] mb-4 flex items-center gap-3 flex-wrap">
                  <span className="font-serif italic text-[16px] tracking-normal text-[#8a7346] normal-case">II.</span>
                  <Lux k="casesLabel" fb="Studia przypadków" maxLength={60} rich={false} />
                </div>
                <h2
                  className="font-serif font-light m-0"
                  style={{ fontSize: "clamp(36px, 5cqw, 60px)", lineHeight: 1, letterSpacing: "-0.025em" }}
                >
                  <Lux k="casesH2" fb="Wybrane <em>drogi.</em>" maxLength={120} />
                </h2>
                {(editMode || lux.casesSub) && (
                  <p className="text-[14px] sm:text-[16px] leading-[1.6] text-[#3a3730] m-0 mt-4 max-w-[640px]">
                    <Lux
                      k="casesSub"
                      fb="Krótki opis kontekstu — opcjonalny."
                      maxLength={250}
                      multiline
                      block
                      rich={false}
                    />
                  </p>
                )}
              </div>
              <LuxuryCases
                cases={casesArr}
                galleryPhotos={galleryFallbacks}
                casesNeverSet={casesNeverSet}
                editMode={editMode}
              />
            </div>
          </section>
        );
      })()}

      {/* II. SERVICES — numbered list, hover indent */}
      {(editMode || services.length > 0) && (
        <section id="services" data-section-id="services" className="py-20 sm:py-24 border-t border-[#d9cfb8]">
          <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
            {editMode && (
              <SectionAIServicesButton
                currentServicesCount={services.length}
                template="luxury"
                pillClassName={AI_PILL_THEMES.luxury}
              />
            )}
            <SectionHead
              num="II."
              h2={<Lux k="servicesH2" fb="Usługi <em>indywidualne</em>" maxLength={80} />}
              sub={<Lux k="servicesSub" fb="Każda sesja jest konsultacją — nie rutyną." multiline block maxLength={250} rich={false} />}
            />
            {editMode ? (
              <LuxuryServicesEditor
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
            <div className="max-w-[960px] mx-auto">
              {services.map((svc, i) => (
                <div
                  key={svc.id ?? i}
                  className="grid grid-cols-[36px_1fr] @[1024px]:grid-cols-[48px_1fr_auto_auto] gap-5 @[1024px]:gap-7 items-center py-6 sm:py-7 border-t border-[#d9cfb8] last:border-b last:border-[#d9cfb8] hover:bg-[#fbf8f1] hover:px-5 transition-all"
                >
                  <div className="font-serif italic text-[16px] sm:text-[18px] text-[#8a7346]">
                    {romanLow(i + 1)}.
                  </div>
                  <div>
                    <h4 className="font-serif font-normal text-[19px] sm:text-[24px] tracking-[-0.015em] m-0 mb-1.5">
                      {svc.name}
                    </h4>
                    <p className="text-[13px] sm:text-[14px] text-[#7a7365] m-0 leading-[1.55] max-w-[520px]">
                      {svc.description}
                    </p>
                    <div className="@[1024px]:hidden mt-3 flex items-center gap-3 text-[10px] tracking-[0.2em] uppercase text-[#7a7365]">
                      <span>{svc.duration} min</span>
                      <span className="font-serif text-[16px] tracking-normal text-[#1c1a15]">{svc.price} zł</span>
                    </div>
                  </div>
                  <div className="hidden @[1024px]:block text-[11px] tracking-[0.2em] uppercase text-[#7a7365] whitespace-nowrap">
                    {svc.duration} min · sala
                  </div>
                  <div className="hidden @[1024px]:block font-serif text-[22px] font-normal text-[#1c1a15] whitespace-nowrap">
                    <em className="not-italic text-[14px] text-[#8a7346] mr-1.5 italic">od</em>
                    {svc.price} zł
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </section>
      )}

      {/* III. PACKAGES — 3 cards (middle featured: dark bg, gold accents) */}
      {(editMode || packages.length > 0) && (
        <section id="packages" data-section-id="packages" className="bg-[#fbf8f1] py-20 sm:py-24 border-y border-[#d9cfb8]">
          {editMode && (
            <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
              <SectionAIPackagesButton
                currentPackagesCount={packages.length}
                template="luxury"
                pillClassName={AI_PILL_THEMES.luxury}
              />
            </div>
          )}
          <SectionHead
            num="III."
            h2={<Lux k="packagesH2" fb="Programy <em>autorskie</em>" maxLength={80} />}
            sub={<Lux k="packagesSub" fb="Trzy poziomy zaangażowania. Każdy program zaczyna się od rozmowy." multiline block maxLength={300} rich={false} />}
          />
          <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
            {editMode ? (
              <LuxuryPackagesEditor
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
            <div className="grid @[1024px]:grid-cols-3 max-w-[1100px] mx-auto gap-y-5 @[1024px]:gap-y-0">
              {packages.slice(0, 3).map((pkg, i) => {
                const featured = !!pkg.featured;
                return (
                  <div
                    key={pkg.id}
                    className={`relative flex flex-col gap-6 ${
                      featured
                        ? "bg-[#1c1a15] text-[#fbf8f1] p-12 @[1024px]:p-12 @[1024px]:py-[68px] @[1024px]:my-[-20px] shadow-[0_24px_60px_-20px_rgba(28,26,21,0.4)]"
                        : "bg-[#f6f1e8] p-10 sm:p-12"
                    } ${!featured && i < packages.length - 1 ? "@[1024px]:border-r border-[#d9cfb8]" : ""}`}
                  >
                    {featured && (
                      <span className="absolute top-6 right-6 font-serif italic font-light text-[13px] text-[#b39668]">
                        Najczęściej wybierany
                      </span>
                    )}
                    <div className={`text-[11px] tracking-[0.24em] uppercase font-medium ${featured ? "text-[#b39668]" : "text-[#8a7346]"}`}>
                      Program {romanLow(i + 1)}.
                    </div>
                    <div className="font-serif font-light text-[30px] sm:text-[38px] leading-[1.1] tracking-[-0.02em] -mt-2">
                      {pkg.name}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-serif font-light text-[36px] sm:text-[44px] tracking-[-0.02em] leading-none ${featured ? "text-[#fbf8f1]" : "text-[#1c1a15]"}`}>
                        {pkg.price.toLocaleString("pl-PL")} zł
                      </span>
                      {pkg.period && (
                        <span className={`text-[12px] tracking-[0.15em] uppercase ${featured ? "text-[#fbf8f1]/55" : "text-[#7a7365]"}`}>
                          / {pkg.period}
                        </span>
                      )}
                    </div>
                    {pkg.description && (
                      <div className={`font-serif font-light italic text-[14px] leading-[1.65] ${featured ? "text-[#fbf8f1]/75" : "text-[#7a7365]"}`}>
                        {pkg.description}
                      </div>
                    )}
                    <div className={`h-px ${featured ? "bg-[#fbf8f1]/15" : "bg-[#d9cfb8]"}`} />
                    <ul className="list-none p-0 m-0 grid gap-3.5">
                      {pkg.items.map((it, ii) => (
                        <li
                          key={ii}
                          className={`flex gap-3 items-start text-[13px] sm:text-[14px] leading-[1.5] ${featured ? "text-[#fbf8f1]/75" : "text-[#3a3730]"}`}
                        >
                          <span
                            className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center shrink-0 mt-0.5 border ${featured ? "border-[#b39668] text-[#b39668]" : "border-[#8a7346] text-[#8a7346]"}`}
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                          {it}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/trainers/${trainer.id}/book`}
                      className={`mt-auto inline-flex items-center justify-center h-12 px-6 text-[12px] tracking-[0.18em] uppercase font-medium transition ${
                        featured
                          ? "bg-[#fbf8f1] text-[#1c1a15] hover:bg-[#b39668] hover:text-[#fbf8f1]"
                          : "border border-[#1c1a15] text-[#1c1a15] hover:bg-[#1c1a15] hover:text-[#fbf8f1]"
                      }`}
                    >
                      Wybierz program
                    </Link>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </section>
      )}

      {/* IV. GALLERY — asymmetric editorial masonry */}
      <section id="gallery" data-section-id="gallery" className="py-20 sm:py-24 border-t border-[#d9cfb8]">
        <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
          <SectionHead
            num="IV."
            h2={<Lux k="galleryH2" fb="Atelier <em>w kadrze</em>" maxLength={80} />}
            sub={<Lux k="gallerySub" fb="Przestrzeń, w której pracuję. Sesje, wyposażenie, metoda — bez filtrów marketingowych." multiline block maxLength={250} rich={false} />}
          />
          {editMode ? (
            <LuxuryGalleryEditor items={galleryItems} focalMap={galleryFocal} />
          ) : (
            <LuxuryGalleryView items={galleryPhotosFull} />
          )}
        </div>
      </section>

      {/* V. CERTIFICATIONS — timeline */}
      {trainer.certifications.length > 0 && (
        <section id="certifications" data-section-id="certifications" className="py-20 sm:py-24 border-t border-[#d9cfb8]">
          <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
            <SectionHead
              num="V."
              h2={<Lux k="certificationsH2" fb="Akredytacje" maxLength={60} />}
              sub={<Lux k="certificationsSub" fb="Wykształcenie i certyfikaty zawodowe." multiline block maxLength={200} rich={false} />}
            />
            <div className="max-w-[780px] mx-auto">
              {trainer.certifications.map((cert, i) => {
                const detail = trainer.certificationDetails?.[i];
                const year = extractYear(cert);
                // Strip year + parens from display name for cleaner timeline.
                const cleanName = cert.replace(/\s*\(?20\d{2}\)?$/, "").replace(/\s+\d{4}$/, "").trim();
                // If cert text has " — ", split off the org part.
                const [name, ...orgParts] = cleanName.split(" — ");
                const org = orgParts.join(" — ").trim();
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[60px_1fr] @[1024px]:grid-cols-[100px_1fr_auto] gap-5 @[1024px]:gap-8 py-6 sm:py-7 border-t border-[#d9cfb8] last:border-b last:border-[#d9cfb8] items-baseline"
                  >
                    <div className="font-serif italic font-light text-[20px] sm:text-[26px] text-[#8a7346]">
                      {year}
                    </div>
                    <div>
                      <div className="font-serif font-normal text-[16px] sm:text-[20px] tracking-[-0.01em] leading-[1.3]">
                        {name || cert}
                      </div>
                      {org && (
                        <div className="text-[12px] sm:text-[13px] text-[#7a7365] mt-1">{org}</div>
                      )}
                      {(detail?.verificationUrl || detail?.attachmentUrl) && (
                        <div className="flex gap-2 flex-wrap mt-2.5">
                          {detail.verificationUrl && (
                            <a
                              href={detail.verificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase text-[#8a7346] border border-[#8a7346] hover:bg-[#8a7346] hover:text-[#fbf8f1] px-2 py-1 transition"
                            >
                              ↗ Sprawdź
                            </a>
                          )}
                          {detail.attachmentUrl && (
                            <a
                              href={detail.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase text-[#7a7365] border border-[#d9cfb8] hover:bg-[#1c1a15] hover:text-[#fbf8f1] hover:border-[#1c1a15] px-2 py-1 transition"
                            >
                              📎 PDF
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="hidden @[1024px]:inline-flex text-[10px] tracking-[0.2em] uppercase text-[#8a7346] border border-[#8a7346] px-2.5 py-1">
                      Certyfikat
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* VI. REVIEWS — score + 2-col quote grid */}
      {(reviews.length > 0 || trainer.rating > 0) && (
        <section id="reviews" data-section-id="reviews" className="py-20 sm:py-24 border-t border-[#d9cfb8]">
          <div className="mx-auto max-w-[1340px] px-6 sm:px-10">
            <SectionHead
              num="VI."
              h2={<Lux k="reviewsH2" fb="Referencje" maxLength={60} />}
              sub={<Lux k="reviewsSub" fb="Zapisane słowa klientów, z którymi miałam przyjemność pracować." multiline block maxLength={250} rich={false} />}
            />
            <div className="max-w-[1100px] mx-auto">
              {/* Score */}
              <div className="text-center pb-12 border-b border-[#d9cfb8] mb-12">
                <div
                  className="font-serif font-light leading-none tracking-[-0.04em]"
                  style={{ fontSize: "clamp(72px, 12cqw, 120px)" }}
                >
                  {ratingMain}
                  {ratingFrac && <em className="italic text-[#8a7346]">{ratingFrac}</em>}
                </div>
                <div className="font-serif text-[16px] sm:text-[18px] tracking-[0.4em] text-[#8a7346] mt-2.5">
                  ★★★★★
                </div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-[#7a7365] mt-3">
                  {trainer.reviewCount} opinii
                </div>
              </div>

              {/* Quote grid */}
              {reviews.length > 0 && (
                <>
                  <div className="grid @[1024px]:grid-cols-2 gap-10 sm:gap-14">
                    {reviews.map((r) => (
                      <div key={r.id} className="border-t border-[#d9cfb8] pt-8 relative">
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-serif text-[40px] leading-none text-[#8a7346] bg-[#f6f1e8] px-3">
                          ❝
                        </span>
                        <p className="font-serif font-light text-[18px] sm:text-[22px] leading-[1.45] tracking-[-0.01em] text-[#1c1a15] m-0 mb-5">
                          {r.text}
                        </p>
                        {r.replyText && (
                          <div className="mb-6 pl-4 border-l border-[#8a7346]">
                            <div className="text-[10px] tracking-[0.22em] uppercase text-[#8a7346] mb-1.5">
                              Odpowiedź od trenera
                            </div>
                            <p className="font-serif italic text-[14px] sm:text-[16px] leading-[1.55] text-[#3a3730] m-0 whitespace-pre-line">
                              {r.replyText}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-[#efe7d7] inline-flex items-center justify-center font-serif text-[16px] text-[#8a7346] shrink-0">
                            {r.authorAvatar ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={r.authorAvatar}
                                alt={r.authorName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{r.authorName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[12px] sm:text-[13px] tracking-[0.1em] uppercase">{r.authorName}</div>
                            <div className="font-serif italic text-[12px] sm:text-[13px] text-[#7a7365] mt-0.5">
                              {r.date}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {trainer.reviewCount > reviews.length && (
                    <div className="text-center mt-16">
                      <Link
                        href={`/trainers/${trainer.id}/reviews`}
                        className="inline-flex items-center justify-center h-12 px-6 text-[12px] tracking-[0.18em] uppercase font-medium border border-[#1c1a15] text-[#1c1a15] hover:bg-[#1c1a15] hover:text-[#fbf8f1] transition"
                      >
                        Czytaj wszystkie referencje ({trainer.reviewCount})
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA — dark, big serif */}
      <section className="bg-[#1c1a15] text-[#fbf8f1] py-24 sm:py-32 text-center px-6">
        <div className="text-[10px] tracking-[0.24em] uppercase text-[#b39668] font-medium">
          <Lux k="finalEyebrow" fb="Zapraszam" rich={false} maxLength={40} theme="dark" />
        </div>
        <h2
          className="font-serif font-light mt-3 mb-6 text-[#fbf8f1] [&_em]:italic [&_em]:text-[#b39668]"
          style={{ fontSize: "clamp(40px, 7cqw, 72px)", lineHeight: 1, letterSpacing: "-0.03em" }}
        >
          <Lux k="finalH2" fb="Porozmawiajmy o <em>twojej drodze</em>" maxLength={120} theme="dark" />
        </h2>
        <p className="font-serif font-light italic text-[17px] sm:text-[20px] text-[#fbf8f1]/65 max-w-[520px] mx-auto m-0 mb-12">
          <Lux k="finalSub" fb="Pierwsza rozmowa jest bezpłatna i niezobowiązująca. Piętnaście minut, w których opowiesz mi swoją historię, a ja podpowiem, co może zadziałać." multiline block maxLength={400} rich={false} theme="dark" />
        </p>
        <Link
          href={`/trainers/${trainer.id}/book`}
          className="inline-flex items-center justify-center h-12 px-7 text-[12px] tracking-[0.18em] uppercase font-medium bg-[#fbf8f1] text-[#1c1a15] hover:bg-[#b39668] hover:text-[#fbf8f1] transition"
        >
          {t("finalCta", "Umów konsultację")}
        </Link>
      </section>

      {/* FOOTER */}
      {!isEmbed && (
        <footer className="bg-[#f6f1e8] border-t border-[#d9cfb8] px-6 sm:px-10 py-10 text-[10px] tracking-[0.2em] uppercase text-[#7a7365] flex justify-between items-center gap-4 flex-wrap">
          <span>Zdorovite · Polska · {new Date().getFullYear()}</span>
          <div className="flex gap-6 sm:gap-8">
            <Link href="#" className="hover:text-[#8a7346] transition">Regulamin</Link>
            <Link href="#" className="hover:text-[#8a7346] transition">Prywatność</Link>
            <Link href="#" className="hover:text-[#8a7346] transition">Kontakt</Link>
          </div>
        </footer>
      )}
    </div>
  );
}

function SectionHead({
  num,
  h2,
  sub,
}: {
  num: string;
  /** Either pre-resolved HTML string OR a ReactNode (e.g. <Lux> wrapper). */
  h2: string | React.ReactNode;
  sub?: string | React.ReactNode;
}) {
  return (
    <div className="text-center mb-12 sm:mb-14">
      <div className="font-serif italic font-light text-[14px] text-[#8a7346] mb-2.5">{num}</div>
      <h2
        className="font-serif font-light m-0 mb-3.5 [&_em]:italic [&_em]:text-[#8a7346]"
        style={{ fontSize: "clamp(36px, 6cqw, 56px)", lineHeight: 1, letterSpacing: "-0.025em" }}
      >
        {typeof h2 === "string" ? (
          <span dangerouslySetInnerHTML={{ __html: h2 }} />
        ) : (
          h2
        )}
      </h2>
      {sub && (
        <p className="text-[14px] sm:text-[15px] text-[#7a7365] max-w-[520px] mx-auto m-0 leading-[1.6]">
          {typeof sub === "string" ? sub : sub}
        </p>
      )}
    </div>
  );
}

function Meta({ k, v, serif = false }: { k: string; v: string; serif?: boolean }) {
  return (
    <div>
      <div className="text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-[#7a7365] mb-1.5">{k}</div>
      <div className={`text-[13px] sm:text-[14px] tracking-[0.02em] text-[#1c1a15] ${serif ? "font-serif text-[18px] sm:text-[20px] font-normal tracking-normal" : ""}`}>
        {v}
      </div>
    </div>
  );
}
