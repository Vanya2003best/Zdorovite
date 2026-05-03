import Link from "next/link";
import type { Trainer } from "@/types";
import { getSpecLabel } from "@/data/specializations";
import EditProfileHeaderButton from "./EditProfileHeaderButton";
import FavoriteButton from "./FavoriteButton";
import CinematicServicesEditor from "./CinematicServicesEditor";
import CinematicPackagesEditor from "./CinematicPackagesEditor";
import CinematicTicker from "./CinematicTicker";
import CinematicGalleryEditor from "./CinematicGalleryEditor";
import CinematicGalleryView from "./CinematicGalleryView";
import SectionAITextButton from "./SectionAITextButton";
import SectionAIServicesButton from "./SectionAIServicesButton";
import SectionAIPackagesButton from "./SectionAIPackagesButton";
import SectionAICasesButton from "./SectionAICasesButton";
import { generateAboutVariants, applyAboutVariant } from "./ai-actions";
import { AI_PILL_THEMES } from "./ai-pill-themes";
import CinematicTestimonialsEditor from "./CinematicTestimonialsEditor";
import CinematicReviewsList from "./CinematicReviewsList";
import EditableCopy from "./EditableCopy";
import EditableRichCopy from "./EditableRichCopy";
import EditableAboutChapters from "./EditableAboutChapters";
import { EditableCinematicHero, EditableCinematicFullbleed } from "./EditableCinematicCover";
import CinematicCases from "./CinematicCases";
import VideoIntroCard from "./VideoIntroCard";
import { applyServiceOverrides, applyPackageOverrides } from "./apply-overrides";

// Cinematic = full-bleed dark hero · 148px display type · numbered chapter sections · bento reel.
// Designed pixel-close to designs/14-profile-cinematic-desktop.html.
//
// Skipped from the original mock (no data backing yet): coordinates strip,
// hand-tuned per-trainer quote in the fullbleed shot, scroll progress bar, animated ticker.

const FALLBACK_HERO = "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=2000&h=1200&fit=crop";
const FALLBACK_FULLBLEED = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=2000&h=1200&fit=crop";

export default function CinematicProfile({
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
  /** When true (used by /studio/design preview), hides nav chrome that doesn't make sense in-editor. */
  isEmbed?: boolean;
}) {
  const hasCustomCover = !!trainer.customization.coverImage;
  const hasCustomFullbleed = !!trainer.customization.cinematicFullbleedImage;
  // Hero and fullbleed each have their OWN dedicated upload slots so the
  // trainer can curate each independently. We don't fall back to gallery
  // photos — that would surprise-leak gallery shots into editorial sections
  // when the trainer hadn't intended that. If neither upload is set, the
  // hardcoded FALLBACK stock shot stands in.
  const heroBg = trainer.customization.coverImage || FALLBACK_HERO;
  const fullbleed = trainer.customization.cinematicFullbleedImage || FALLBACK_FULLBLEED;

  // Split name: last word becomes the italic line-2.
  const nameWords = trainer.name.split(" ");
  const lastWord = nameWords.length > 1 ? nameWords[nameWords.length - 1] : "";
  const firstWords = nameWords.length > 1 ? nameWords.slice(0, -1).join(" ") : trainer.name;

  // Trainer-overridable copy. Anything missing here falls back to the hardcoded
  // Polish defaults inline. In editMode we render <EditableCopy> wrappers; in read
  // mode we just resolve the string.
  const copy = trainer.customization.cinematicCopy ?? {};
  // Apply per-page service/package overrides (visibility, order, name/desc/price).
  // Both editor mode and public render use the same resolved arrays — keeps the
  // preview faithful to what visitors will see.
  const services = applyServiceOverrides(trainer.services, trainer.customization);
  const packages = applyPackageOverrides(trainer.packages, trainer.customization);

  // Default HTML for rich-text fields — used both as the EditableRichCopy default
  // (no override yet) and as the fallback rendered in read mode. Same HTML on both
  // sides so editor and public look identical. Sanitizer allows <em>, <span style="color:#hex">, <br>.
  const accentColor = "#d4ff00"; // Cinematic's brand lime
  const RICH_DEFAULTS = {
    fullbleedQuote: `„Każdy klient jest <span style="color: ${accentColor}">inny</span>. Każdy program — <span style="color: ${accentColor}">indywidualny</span>."`,
    servicesH2: `Sposoby pracy <em>— wybierz</em>`,
    packagesH2: `Długa gra. <em>Realne wyniki.</em>`,
    galleryH2: `Z drogi, <em>lasu, startów.</em>`,
    reviewsH2: `Głosy <em>z drogi.</em>`,
    certificationsH2: `Czarno <em>na białym.</em>`,
  } as const;

  // Resolve about chapters. If the trainer has explicitly authored chapters via
  // EditableAboutChapters, use them as-is. Otherwise auto-split trainer.about by
  // \n\n into up to 3 paragraphs and pair with hardcoded titles — preserves the
  // existing read-mode behaviour for trainers who haven't customised yet.
  const FALLBACK_TITLES = ["01 / Zaczęło się", "02 / Metoda", "03 / Z kim pracuję"];
  const FALLBACK_HEADS = ["Skąd przyszłaś.", "Jak pracujesz.", "Z kim."];
  const customChapters = copy.aboutChapters ?? [];
  const useCustomChapters = customChapters.length > 0;
  const fallbackChapters = (trainer.about || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((body, i) => ({
      id: `fb_${i}`,
      title: FALLBACK_TITLES[i] ?? `0${i + 1} /`,
      head: FALLBACK_HEADS[i] ?? "—",
      body,
    }));
  const chaptersForDisplay = useCustomChapters ? customChapters : fallbackChapters;

  // Section visibility + ordering. Cinematic sections sit inside a flex
  // column and use CSS `order` to honour the trainer's `customization.sections`
  // ordering from the studio editor — without this, all sections render in
  // their hardcoded JSX order regardless of the sidebar drag-reorder.
  // Sections marked `visible: false` are skipped entirely.
  const sectionConfig = trainer.customization.sections ?? [];
  const sectionOrder = new Map<string, number>();
  const visibleSet = new Set<string>();
  sectionConfig.forEach((s, i) => {
    sectionOrder.set(s.id, i);
    if (s.visible) visibleSet.add(s.id);
  });
  // Each configurable section gets `order = 10 + position * 10` (leaving room
  // for hero/ticker/fullbleed before and finale/footer after). Default 999
  // when a section isn't in the config — pushes it to the end.
  const orderOf = (id: string): number => {
    const pos = sectionOrder.get(id);
    return pos === undefined ? 999 : 10 + pos * 10;
  };
  const isVisible = (id: string): boolean => {
    // If the section isn't in the config at all, treat as visible (legacy
    // accounts predating the section-toggle feature).
    if (!sectionOrder.has(id)) return true;
    return visibleSet.has(id);
  };
  // Auto-numbered chapter eyebrow ("Rozdział VI · Certyfikaty") that updates
  // when the trainer drags sections around in the studio sidebar. Position
  // counts only VISIBLE sections so the numbering stays gap-free when a
  // section is toggled off.
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const visibleOrdered: string[] = sectionConfig
    .filter((s) => visibleSet.has(s.id) || !sectionOrder.has(s.id))
    .map((s) => s.id as string);
  const chapterNumberOf = (id: string): string => {
    const idx = visibleOrdered.indexOf(id);
    if (idx < 0) return "I";
    return ROMAN[idx] ?? String(idx + 1);
  };

  return (
    // @container + containerType: inline-size establishes this element as a size container,
    // so descendants can use both `cqw` units for typography and `@[1024px]:`/`@[640px]:` Tailwind
    // variants for LAYOUT breakpoints. The big difference vs plain `lg:`/`sm:` is the
    // breakpoint resolves against THIS element's width — so in a narrow editor canvas
    // (~1000px) we render the single-column phone-style layout, in fullscreen / public
    // (~1900px) the multi-column desktop layout. No "I have window=1920 but canvas=1000"
    // mismatch.
    <div
      className="@container bg-[#0a0a0c] text-[#f5f5f4] min-h-screen font-sans antialiased flex flex-col"
      // zoom 0.9 in standalone view per user UX preference — the Cinematic
      // page reads best at 90% of natural size on typical desktops. Editor
      // preview (isEmbed) stays at 100% so the canvas isn't padded with
      // blank space, and inline-size container queries keep working since
      // `cqw` measures the post-zoom layout width.
      // `flex flex-col` lets configurable sections respect the user's
      // `customization.sections` ordering via inline `style.order` — see
      // sectionOrder/orderOf above.
      style={{ containerType: "inline-size", zoom: isEmbed ? undefined : 0.9 }}
    >
      {/* Top progress accent line — hidden in editor preview to avoid overlapping editor chrome */}
      {!isEmbed && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-[60] bg-gradient-to-r from-[#d4ff00] via-[#d4ff00] to-transparent" style={{ backgroundSize: "34% 100%", backgroundRepeat: "no-repeat" }} />
      )}

      {/* CHROME — sticky nav (hidden in editor preview) */}
      {!isEmbed && (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0c]/70 backdrop-blur-xl backdrop-saturate-[1.4]" style={{ order: 0 }}>
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12 h-[68px] flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
            <span className="w-7 h-7 rounded-md bg-[#d4ff00] text-[#0a0a0c] inline-flex items-center justify-center text-[13px] font-bold">N</span>
            NaZdrow!
          </Link>
          <nav className="hidden md:flex gap-8 text-[13px] text-white/70">
            <a href="#about" className="hover:text-white transition">O mnie</a>
            <a href="#cases" className="hover:text-white transition">Kejsy</a>
            <a href="#services" className="hover:text-white transition">Sposoby</a>
            <a href="#packages" className="hover:text-white transition">Pakiety</a>
            <a href="#certifications" className="hover:text-white transition">Certyfikaty</a>
            <a href="#gallery" className="hover:text-white transition">Galeria</a>
            <a href="#reviews" className="hover:text-white transition">Opinie</a>
          </nav>
          <div className="flex gap-2.5 items-center">
            <span className="hidden sm:inline-flex font-mono text-[11px] text-white/50 px-2.5 py-1.5 border border-white/10 rounded-full items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4ff00] shadow-[0_0_10px_#d4ff00]" />
              Dostępna · {trainer.location}
            </span>
            {!isOwner && (
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-white inline-flex items-center justify-center hover:bg-white/20 transition disabled:opacity-70"
                size={16}
              />
            )}
            {isOwner && <EditProfileHeaderButton slug={trainer.id} />}
            <Link href={`/trainers/${trainer.id}/book`} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[13px] font-semibold hover:brightness-110 transition">
              Umów sesję →
            </Link>
          </div>
        </div>
      </header>
      )}

      {/* HERO */}
      <section className="relative min-h-[92vh] px-6 sm:px-12 pt-20 pb-12 overflow-hidden flex items-end" style={{ order: 1 }}>
        {/* Hero photo + dimming gradient. EditableCinematicHero paints the
            cover image as backgroundImage and lays the gradient on top via
            backgroundOverlay so it stays a single CSS layer. The dimming
            stays slightly stronger when the trainer uploaded their own
            (brighter) photo so the bottom CTA bar always reads. */}
        <EditableCinematicHero
          current={trainer.customization.coverImage}
          currentFocal={trainer.customization.coverImageFocal}
          fallback={FALLBACK_HERO}
          alt={`${trainer.name} — okładka`}
          editable={editMode}
          containerClassName={`absolute inset-0 z-0 contrast-[1.05] saturate-[0.95] ${hasCustomCover ? "brightness-[0.88]" : ""}`}
          overlay={
            hasCustomCover
              ? "linear-gradient(180deg, rgba(10,10,12,0.4) 0%, rgba(10,10,12,0.22) 40%, rgba(10,10,12,0.92) 100%)"
              : "linear-gradient(180deg, rgba(10,10,12,0.4) 0%, rgba(10,10,12,0.2) 40%, rgba(10,10,12,0.95) 100%)"
          }
        />
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 80%, rgba(212,255,0,0.08), transparent 50%)" }} />
        {/* SVG turbulence noise overlay — adds film-grain texture per the design.
            Inline data: URL so we don't need a separate asset; mix-blend overlay
            keeps it subtle and ties it visually to whatever bg is behind. */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none mix-blend-overlay opacity-50"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* Top meta strip */}
        <div className="absolute top-10 left-6 sm:left-12 right-6 sm:right-12 z-10 flex justify-between items-center font-mono text-[11px] text-white/50 uppercase tracking-[0.12em]">
          <div className="flex gap-6 items-center">
            <span>NaZdrow! / Profil</span>
            <span className="text-[#d4ff00]">01</span>
            <span className="hidden sm:inline">Cinematic edition</span>
          </div>
          <div className="hidden md:flex gap-6 items-center">
            <span>{trainer.location}</span>
          </div>
        </div>

        {/* Narrow canvas: stack & center for visual balance (no awkward right-side void).
            Wide canvas: original editorial 2-column with left-aligned text + right stats. */}
        <div className="relative z-10 w-full grid grid-cols-1 @[1024px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-12 items-end text-center @[1024px]:text-left">
          <div className="flex flex-col items-center @[1024px]:items-start">
            <h1
              className="font-medium text-white m-0 mb-6"
              style={{ fontSize: "clamp(48px, 11cqw, 148px)", lineHeight: 0.88, letterSpacing: "-0.06em" }}
            >
              {firstWords}
              {lastWord && (
                <span className="block italic font-light text-white/70 @[1024px]:ml-[0.25em]">{lastWord}.</span>
              )}
            </h1>
            <p className="text-[16px] sm:text-[18px] leading-[1.5] text-white/70 max-w-[440px] tracking-[-0.01em]">
              {trainer.tagline}
            </p>

            {/* Languages line — Cinematic editorial style: mono / uppercase /
                wide tracking, faint white over the dark hero. Sits between the
                tagline and the CTA buttons so it reads as part of the
                "credentials at a glance" block. */}
            <div className="mt-7 font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 flex items-center gap-2 flex-wrap justify-center @[1024px]:justify-start">
              <span>Mówi</span>
              <span className="w-6 h-px bg-white/30" />
              <span className="text-white/70">{trainer.languages.join(" · ") || "Polski"}</span>
            </div>

            <div className="flex gap-2.5 mt-9 flex-wrap justify-center @[1024px]:justify-start">
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[15px] font-semibold hover:brightness-110 transition"
              >
                Zarezerwuj sesję →
              </Link>
              <Link
                href={`/account/messages?with=${trainer.id}`}
                className="inline-flex items-center gap-2 h-14 px-7 rounded-full border border-white/15 text-[15px] font-medium hover:bg-white/5 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                Wiadomość
              </Link>
            </div>
          </div>

          {/* Right column: play-card mock + stats. Both centered on narrow canvas
              and left-aligned on @[1024px]+. */}
          <div className="flex flex-col gap-5 max-w-[440px] w-full mx-auto @[1024px]:mx-0">
          {/* Play card — VideoIntroCard owns the layout, click-to-open lightbox,
              and the upload pill in editMode. Title and subtitle stay here so
              EditableCopy continues to wire through cinematicCopy actions. */}
          <VideoIntroCard
            videoUrl={trainer.customization.cinematicVideoIntroUrl ?? null}
            editMode={editMode}
            title={
              editMode ? (
                <EditableCopy field="videoIntroTitle" initial={copy.videoIntroTitle} defaultValue="Obejrzyj intro · 1:12" maxLength={50} theme="dark" />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: copy.videoIntroTitle ?? "Obejrzyj intro · 1:12" }} />
              )
            }
            subtitle={
              editMode ? (
                <EditableCopy field="videoIntroSubtitle" initial={copy.videoIntroSubtitle} defaultValue="Metoda treningu w 90 sekund" maxLength={60} theme="dark" />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: copy.videoIntroSubtitle ?? "Metoda treningu w 90 sekund" }} />
              )
            }
          />
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-white/15 border border-white/15 rounded-2xl overflow-hidden">
            <Stat
              value={String(trainer.experience)}
              suffix="lat"
              labelField="statStaz"
              labelDefault="Staż"
              labelOverride={copy.statStaz}
              editMode={editMode}
            />
            <Stat
              value={String(trainer.reviewCount)}
              suffix="+"
              labelField="statKlienci"
              labelDefault="Klientów"
              labelOverride={copy.statKlienci}
              editMode={editMode}
            />
            <Stat
              value={trainer.rating.toString().replace(".", ",")}
              suffix="★"
              labelField="statOpinii"
              labelDefault={`Z ${trainer.reviewCount} opinii`}
              labelOverride={copy.statOpinii}
              editMode={editMode}
            />
            <Stat
              value="<2"
              suffix="h"
              labelField="statResponse"
              labelDefault="Czas odpowiedzi"
              labelOverride={copy.statResponse}
              editMode={editMode}
            />
          </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden @[1024px]:flex flex-col items-center gap-3 font-mono text-[10px] text-white/50 uppercase tracking-[0.2em]">
          <span>Scroll</span>
          <span className="w-px h-10 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </section>

      {/* TICKER — horizontal scroll with prev/next buttons (CinematicTicker, client).
          In editMode the trainer can also add/remove specializations inline.
          Wrapped so the flex parent can apply CSS `order: 2` (between hero and
          configurable sections). */}
      <div style={{ order: 2 }}>
        <CinematicTicker
          specializations={trainer.customization.specializations ?? trainer.specializations}
          globalSpecs={trainer.specializations}
          editMode={editMode}
        />
      </div>

      {/* CHAPTER I — About. In editMode always renders so the trainer can add the
          first chapter via EditableAboutChapters. Read-mode renders only when
          there's something to show. */}
      {isVisible("about") && (editMode || chaptersForDisplay.length > 0) && (
        <section id="about" data-section-id="about" className="py-12 sm:py-20 scroll-mt-20" style={{ order: orderOf("about") }}>
          {editMode && (
            <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
              <SectionAITextButton
                label="O mnie"
                currentText={trainer.about}
                onGenerate={generateAboutVariants}
                onApply={applyAboutVariant}
                template="cinematic"
                pillClassName={AI_PILL_THEMES.cinematic}
              />
            </div>
          )}
          <div className="mx-auto max-w-[1440px] px-6 sm:px-12 grid @[1024px]:grid-cols-[420px_minmax(0,1fr)] gap-16 @[1024px]:gap-24 items-start">
            <div className="@[1024px]:sticky @[1024px]:top-24 min-w-0">
              <Chap>{`Rozdział ${chapterNumberOf("about")} · O mnie`}</Chap>
              <h2 style={{ fontSize: "clamp(36px, 7cqw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0 mb-9">
                {editMode ? (
                  <EditableCopy field="aboutH2Line1" initial={copy.aboutH2Line1} defaultValue="Droga," maxLength={30} theme="dark" />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: copy.aboutH2Line1 ?? "Droga," }} />
                )}
                <br />
                <em className="italic font-light text-white/70">
                  {editMode ? (
                    <EditableCopy field="aboutH2Line2" initial={copy.aboutH2Line2} defaultValue="nie cel." maxLength={30} theme="dark" />
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: copy.aboutH2Line2 ?? "nie cel." }} />
                  )}
                </em>
              </h2>
              <p className="text-[15px] leading-[1.55] text-white/70">
                {trainer.tagline}
              </p>
              {/* About signature — small avatar + name + role/year per design.
                  Year is current year minus experience (so "od 2014" if they're
                  in their 12th year of practice). */}
              <div className="mt-5 pt-5 border-t border-white/10 flex gap-3.5 items-center">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                  {trainer.avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={trainer.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full inline-flex items-center justify-center text-[#0a0a0c] font-semibold text-base bg-[#d4ff00]">
                      {(trainer.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-[14px] font-medium tracking-[-0.005em]">{trainer.name}</div>
                  <div className="font-mono text-[12px] text-white/50 tracking-[0.05em] mt-0.5">
                    Trener · od {new Date().getFullYear() - (trainer.experience || 0)}
                  </div>
                </div>
              </div>
            </div>
            {editMode ? (
              <EditableAboutChapters chapters={useCustomChapters ? customChapters : fallbackChapters} />
            ) : (
              <div className="grid gap-16 sm:gap-18 min-w-0">
                {chaptersForDisplay.map((c) => (
                  <div key={c.id} className="min-w-0">
                    <div
                      className="font-mono text-[11px] text-[#d4ff00] tracking-[0.2em] mb-3"
                      dangerouslySetInnerHTML={{ __html: c.title }}
                    />
                    <h3
                      style={{ fontSize: "clamp(22px, 3.5cqw, 42px)" }}
                      className="leading-[1.1] tracking-[-0.025em] font-medium m-0 mb-5"
                      dangerouslySetInnerHTML={{ __html: c.head }}
                    />
                    <p
                      className="text-[15px] sm:text-[17px] leading-[1.6] text-white/70 m-0 tracking-[-0.005em]"
                      dangerouslySetInnerHTML={{ __html: c.body }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* FULLBLEED editorial shot. Like the hero: extra dimming (brightness +
          stronger gradient) only kicks in when the trainer uploaded their own
          photo. The default stock shot is already moody enough. */}
      <section className="relative my-6 sm:my-10 h-[60vh] sm:h-[72vh] overflow-hidden" style={{ order: 3 }}>
        <EditableCinematicFullbleed
          current={trainer.customization.cinematicFullbleedImage}
          currentFocal={trainer.customization.cinematicFullbleedFocal}
          fallback={FALLBACK_FULLBLEED}
          alt="Editorial fullbleed"
          editable={editMode}
          containerClassName="absolute inset-0"
          className={`w-full h-full object-cover scale-[1.03] ${hasCustomFullbleed ? "brightness-[0.88]" : ""}`}
        />
        <div
          className={
            hasCustomFullbleed
              ? "absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/15 via-[#0a0a0c]/10 to-[#0a0a0c]/90 pointer-events-none"
              : "absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]/90 pointer-events-none"
          }
        />
        <div className="absolute left-6 sm:left-12 right-6 sm:right-12 bottom-8 sm:bottom-12 z-10 flex justify-between items-end gap-6 flex-wrap">
          <div style={{ fontSize: "clamp(20px, 3cqw, 40px)", lineHeight: 1.15, letterSpacing: "-0.025em" }} className="font-normal max-w-[640px]">
            {editMode ? (
              <EditableRichCopy
                field="fullbleedQuote"
                initial={copy.fullbleedQuote}
                defaultHTML={RICH_DEFAULTS.fullbleedQuote}
                accentColor={accentColor}
                multiline
                block
                maxLength={300}
              />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: copy.fullbleedQuote ?? RICH_DEFAULTS.fullbleedQuote }} />
            )}
          </div>
          <div className="font-mono text-[11px] text-white/50 uppercase tracking-[0.15em] text-right shrink-0">
            {editMode ? (
              <EditableCopy field="fullbleedMetaTop" initial={copy.fullbleedMetaTop} defaultValue="Filozofia" maxLength={40} theme="dark" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: copy.fullbleedMetaTop ?? "Filozofia" }} />
            )}
            <br />
            {editMode ? (
              <EditableCopy field="fullbleedMetaBottom" initial={copy.fullbleedMetaBottom} defaultValue="§ 02 / Metoda" maxLength={40} theme="dark" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: copy.fullbleedMetaBottom ?? "§ 02 / Metoda" }} />
            )}
          </div>
        </div>
      </section>

      {/* CHAPTER II — Certyfikaty. Trust strip — credentials right after the
          personal "Filozofia" pull-quote and before the commercial sections.
          Hidden in view mode when there are no certs (no point showing an
          empty trust signal); always visible in editMode so the trainer can
          start filling it from the studio. */}
      {isVisible("certifications") && trainer.certifications.length > 0 && (
        <section id="certifications" data-section-id="certifications" className="py-12 sm:py-20 scroll-mt-20" style={{ order: orderOf("certifications") }}>
          <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
            <Chap>{`Rozdział ${chapterNumberOf("certifications")} · Certyfikaty`}</Chap>
            <h2 style={{ fontSize: "clamp(28px, 5cqw, 64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0 mb-9">
              {editMode ? (
                <EditableRichCopy
                  field="certificationsH2"
                  initial={copy.certificationsH2}
                  defaultHTML={RICH_DEFAULTS.certificationsH2}
                  accentColor={accentColor}
                  maxLength={80}
                />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: copy.certificationsH2 ?? RICH_DEFAULTS.certificationsH2 }} />
              )}
            </h2>
            <div className="grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-3">
              {trainer.certifications.map((cert, i) => {
                const detail = trainer.certificationDetails?.[i];
                return (
                  <div
                    key={detail?.id ?? i}
                    className="bg-white/[0.025] border border-white/10 rounded-2xl p-5 flex flex-col gap-3"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="font-mono text-[11px] text-[#d4ff00]/80 tracking-[0.15em] uppercase shrink-0 mt-0.5">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="text-[16px] sm:text-[17px] leading-[1.5] text-white/90 tracking-[-0.005em]">
                        {cert}
                      </div>
                    </div>
                    {(detail?.verificationUrl || detail?.attachmentUrl) && (
                      <div className="flex gap-2 flex-wrap pt-2 border-t border-white/5 ml-9">
                        {detail.verificationUrl && (
                          <a
                            href={detail.verificationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#d4ff00]/90 hover:text-[#d4ff00] font-mono uppercase tracking-[0.1em] border border-[#d4ff00]/30 hover:border-[#d4ff00]/60 rounded-full px-2.5 py-1 transition"
                          >
                            ↗ Sprawdź
                          </a>
                        )}
                        {detail.attachmentUrl && (
                          <a
                            href={detail.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white font-mono uppercase tracking-[0.1em] border border-white/15 hover:border-white/30 rounded-full px-2.5 py-1 transition"
                          >
                            📎 PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CHAPTER · CASES — narrative case studies between the editorial fullbleed
          and services. Same data + actions as Studio (one shared `studioCopy.cases`
          array under the hood). In editMode always rendered so the trainer can
          seed examples; in view mode hidden when empty. */}
      {(() => {
        if (!isVisible("cases")) return null;
        const studioCopyForCases = trainer.customization.studioCopy ?? {};
        const casesArr = studioCopyForCases.cases ?? [];
        const casesNeverSet = !("cases" in studioCopyForCases);
        if (!editMode && casesArr.length === 0) return null;
        const galleryFallbacks = trainer.gallery.length > 0 ? trainer.gallery.slice(0, 6) : [];
        return (
          <section id="cases" data-section-id="cases" className="py-12 sm:py-20 scroll-mt-20" style={{ order: orderOf("cases") }}>
            <div className="mx-auto max-w-[1440px]">
              {editMode && (
                <div className="px-6 sm:px-12">
                  <SectionAICasesButton
                    currentCasesCount={casesArr.length}
                    template="cinematic"
                    pillClassName={AI_PILL_THEMES.cinematic}
                  />
                </div>
              )}
              <div className="px-6 sm:px-12 mb-12 sm:mb-16">
                <Chap>{`Rozdział ${chapterNumberOf("cases")} · Studia przypadków`}</Chap>
                <h2
                  style={{ fontSize: "clamp(28px, 5cqw, 64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}
                  className="font-medium m-0 max-w-[680px]"
                >
                  {editMode ? (
                    <EditableRichCopy
                      field="casesH2"
                      initial={copy.casesH2}
                      defaultHTML={`Wybrane <em>drogi.</em>`}
                      accentColor={accentColor}
                      maxLength={120}
                    />
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: copy.casesH2 ?? `Wybrane <em>drogi.</em>` }} />
                  )}
                </h2>
                {(editMode || copy.casesSub) && (
                  <p className="text-[15px] sm:text-[17px] leading-[1.6] text-white/70 m-0 mt-5 max-w-[560px]">
                    {editMode ? (
                      <EditableCopy
                        field="casesSub"
                        initial={copy.casesSub}
                        defaultValue=""
                        placeholder="Opcjonalny podtytuł sekcji…"
                        maxLength={250}
                        multiline
                        theme="dark"
                      />
                    ) : (
                      copy.casesSub
                    )}
                  </p>
                )}
              </div>
              <CinematicCases
                cases={casesArr}
                galleryPhotos={galleryFallbacks}
                casesNeverSet={casesNeverSet}
                editMode={editMode}
              />
            </div>
          </section>
        );
      })()}

      {/* CHAPTER III — Services. In editMode the section always renders (even when empty)
          so the trainer can add a first service via the "+ Dodaj usługę" tile inside
          CinematicServicesEditor. */}
      {isVisible("services") && (editMode || services.length > 0) && (
        <section id="services" data-section-id="services" className="py-12 sm:py-20 scroll-mt-20" style={{ order: orderOf("services") }}>
          <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
            {editMode && (
              <SectionAIServicesButton
                currentServicesCount={services.length}
                template="cinematic"
                pillClassName={AI_PILL_THEMES.cinematic}
              />
            )}
            <Chap>{`Rozdział ${chapterNumberOf("services")} · Usługi`}</Chap>
            <h2 style={{ fontSize: "clamp(28px, 5cqw, 64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0 mb-9">
              {editMode ? (
                <EditableRichCopy
                  field="servicesH2"
                  initial={copy.servicesH2}
                  defaultHTML={RICH_DEFAULTS.servicesH2}
                  accentColor={accentColor}
                  maxLength={80}
                />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: copy.servicesH2 ?? RICH_DEFAULTS.servicesH2 }} />
              )}
            </h2>
            {editMode ? (
              <CinematicServicesEditor
                services={trainer.services
                  .filter((s): s is typeof s & { id: string } => !!s.id)
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
              <div className="grid gap-px bg-white/10 border-y border-white/10 mt-10">
                {services.map((svc, i) => (
                  <Link
                    key={svc.id ?? i}
                    href={svc.id ? `/trainers/${trainer.id}/book?service=${svc.id}` : `/trainers/${trainer.id}/book`}
                    className="group bg-[#0a0a0c] grid grid-cols-[60px_minmax(0,1fr)_auto] @[640px]:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_180px] gap-4 @[640px]:gap-8 items-center py-7 @[640px]:py-9 px-2 hover:bg-[#111114] hover:px-4 @[640px]:hover:px-6 transition-all"
                  >
                    <div className="font-mono text-[12px] @[640px]:text-[13px] text-white/50 tracking-[0.1em]">/ {String(i + 1).padStart(3, "0")}</div>
                    <div
                      style={{ fontSize: "clamp(14px, 2cqw, 28px)" }}
                      className="tracking-[-0.02em] font-medium leading-tight group-hover:text-[#d4ff00] transition"
                    >
                      {svc.name}
                    </div>
                    <div
                      style={{ fontSize: "clamp(11px, 1.2cqw, 14px)" }}
                      className="hidden @[640px]:block text-white/70 leading-[1.55]"
                    >{svc.description}</div>
                    <div className="text-right flex flex-col gap-0.5 shrink-0">
                      <div
                        style={{ fontSize: "clamp(14px, 1.8cqw, 26px)" }}
                        className="tracking-[-0.02em] font-medium"
                      >{svc.price} zł</div>
                      <div className="font-mono text-[10px] @[640px]:text-[11px] text-white/50 tracking-[0.08em] uppercase">{svc.duration} min</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CHAPTER III — Pricing stage. In editMode always renders so the trainer can add
          a first package via the "+ Dodaj pakiet" tile inside CinematicPackagesEditor. */}
      {isVisible("packages") && (editMode || packages.length > 0) && (
        <section id="packages" data-section-id="packages" className="py-12 sm:py-20 px-6 sm:px-12 bg-[#111114] border-y border-white/10 scroll-mt-20" style={{ order: orderOf("packages") }}>
          {editMode && (
            <div className="mx-auto max-w-[1440px]">
              <SectionAIPackagesButton
                currentPackagesCount={packages.length}
                template="cinematic"
                pillClassName={AI_PILL_THEMES.cinematic}
              />
            </div>
          )}
          <div className="mx-auto max-w-[1440px] mb-12 grid @[1024px]:grid-cols-[minmax(0,1fr)_auto] gap-12 items-end">
            <div>
              <Chap>{`Rozdział ${chapterNumberOf("packages")} · Pakiety`}</Chap>
              <h2 style={{ fontSize: "clamp(28px, 5cqw, 64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0">
                {editMode ? (
                  <EditableRichCopy
                    field="packagesH2"
                    initial={copy.packagesH2}
                    defaultHTML={RICH_DEFAULTS.packagesH2}
                    accentColor={accentColor}
                    maxLength={80}
                  />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: copy.packagesH2 ?? RICH_DEFAULTS.packagesH2 }} />
                )}
              </h2>
            </div>
            <p className="text-[15px] sm:text-[17px] leading-[1.55] text-white/70 max-w-[420px]">
              {editMode ? (
                <EditableCopy
                  field="packagesSubcopy"
                  initial={copy.packagesSubcopy}
                  defaultValue="Pojedyncze sesje są dla tych, którzy chcą spróbować. Pakiety — dla tych, którzy są gotowi na prawdziwą zmianę."
                  maxLength={300}
                  multiline
                  block
                  theme="dark"
                />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: copy.packagesSubcopy ?? "Pojedyncze sesje są dla tych, którzy chcą spróbować. Pakiety — dla tych, którzy są gotowi na prawdziwą zmianę." }} />
              )}
            </p>
          </div>
          {editMode ? (
            <CinematicPackagesEditor
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
            <div className="mx-auto max-w-[1440px] grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative rounded-[20px] p-9 flex flex-col min-h-[420px] transition-all duration-300 ${
                    pkg.featured
                      ? "border border-[#d4ff00] bg-gradient-to-b from-[#d4ff00]/[0.08] to-[#d4ff00]/[0.02] shadow-[0_30px_80px_-40px_rgba(212,255,0,0.35)]"
                      : "border border-white/15 bg-white/[0.025] hover:border-white/25 hover:-translate-y-1"
                  }`}
                >
                  {pkg.featured && (
                    <span className="absolute -top-3 left-9 bg-[#d4ff00] text-[#0a0a0c] font-mono text-[11px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full">
                      ★ NAJCZĘŚCIEJ WYBIERANY
                    </span>
                  )}
                  <div className={`font-mono text-[11px] tracking-[0.2em] uppercase mb-4 ${pkg.featured ? "text-[#d4ff00]" : "text-white/50"}`}>
                    {pkg.name}
                  </div>
                  <div className="text-[24px] sm:text-[28px] tracking-[-0.02em] font-medium leading-[1.15] m-0 mb-4">
                    {pkg.description || pkg.name}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-4 pb-6 border-b border-white/10">
                    <span
                      style={{ fontSize: "clamp(28px, 4cqw, 48px)" }}
                      className="font-medium tracking-[-0.03em] leading-none"
                    >{pkg.price.toLocaleString("pl-PL")} zł</span>
                    {pkg.period && <span className="font-mono text-[13px] text-white/50">/ {pkg.period}</span>}
                  </div>
                  <ul className="list-none p-0 m-0 grid gap-3 mb-8">
                    {pkg.items.slice(0, 6).map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-[14px] text-white/70 leading-[1.45]">
                        <span className={`w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5 ${
                          pkg.featured ? "bg-[#d4ff00] text-[#0a0a0c]" : "bg-white/10 text-[#d4ff00]"
                        }`}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/trainers/${trainer.id}/book`}
                    className={`mt-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full text-[14px] font-medium transition ${
                      pkg.featured
                        ? "bg-[#d4ff00] text-[#0a0a0c] font-semibold hover:brightness-110"
                        : "border border-white/15 hover:bg-white/5"
                    }`}
                  >
                    Wybierz {pkg.name} →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* CHAPTER IV — Reel */}
      {/* Gallery — in editMode always rendered (so trainer can add the first
          photo via the upload tile). Read mode hides empty galleries. */}
      {isVisible("gallery") && (editMode || trainer.gallery.length > 0) && (
        <section id="gallery" data-section-id="gallery" className="py-12 sm:py-20 scroll-mt-20" style={{ order: orderOf("gallery") }}>
          <div className="mx-auto max-w-[1440px] mb-12 px-6 sm:px-12 flex justify-between items-end gap-12 flex-wrap">
            <div>
              <Chap>{`Rozdział ${chapterNumberOf("gallery")} · Kadry`}</Chap>
              <h2 style={{ fontSize: "clamp(28px, 5cqw, 64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0">
                {editMode ? (
                  <EditableRichCopy
                    field="galleryH2"
                    initial={copy.galleryH2}
                    defaultHTML={RICH_DEFAULTS.galleryH2}
                    accentColor={accentColor}
                    maxLength={80}
                  />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: copy.galleryH2 ?? RICH_DEFAULTS.galleryH2 }} />
                )}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] text-white/50 uppercase tracking-[0.12em]">
                {trainer.gallery.length} {trainer.gallery.length === 1 ? "kadr" : "kadrów"}
              </span>
            </div>
          </div>
          {(() => {
            const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
            const visibleGallery = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
            return editMode ? (
              <CinematicGalleryEditor items={visibleGallery} focalMap={trainer.customization.galleryFocal} />
            ) : (
              <CinematicGalleryView items={visibleGallery} focalMap={trainer.customization.galleryFocal} />
            );
          })()}
        </section>
      )}

      {/* CHAPTER V — Reviews. In editMode always rendered so the trainer can
          add their first testimonial. Mixes real DB reviews with manual
          testimonials from customization (real ones first). */}
      {(() => {
        if (!isVisible("reviews")) return null;
        const testimonials = copy.testimonials ?? [];
        const hasAnyReview = trainer.reviews.length > 0 || testimonials.length > 0;
        if (!editMode && !hasAnyReview) return null;
        // Big-rating fallback when only testimonials exist (DB rating column
        // doesn't include them — average client-side from the testimonial pool).
        const displayRating =
          trainer.rating > 0
            ? trainer.rating
            : testimonials.length > 0
              ? Math.round(
                  (testimonials.reduce((s, t) => s + t.rating, 0) / testimonials.length) * 10,
                ) / 10
              : 0;
        const displayCount = trainer.reviewCount + testimonials.length;
        return (
          <section id="reviews" data-section-id="reviews" className="py-12 sm:py-20 scroll-mt-20" style={{ order: orderOf("reviews") }}>
            <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
              <div className="grid @[1024px]:grid-cols-[minmax(0,1fr)_auto] gap-12 @[1024px]:gap-24 items-end mb-14">
                <div>
                  <Chap>{`Rozdział ${chapterNumberOf("reviews")} · Opinie`}</Chap>
                  <h2 style={{ fontSize: "clamp(28px, 5cqw, 64px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0">
                    {editMode ? (
                      <EditableRichCopy
                        field="reviewsH2"
                        initial={copy.reviewsH2}
                        defaultHTML={RICH_DEFAULTS.reviewsH2}
                        accentColor={accentColor}
                        maxLength={80}
                      />
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: copy.reviewsH2 ?? RICH_DEFAULTS.reviewsH2 }} />
                    )}
                  </h2>
                </div>
                {hasAnyReview && (
                  <div className="flex gap-8 items-end">
                    <div style={{ fontSize: "clamp(64px, 12cqw, 160px)", lineHeight: 0.85, letterSpacing: "-0.06em" }} className="font-medium">
                      {displayRating.toString().replace(".", ",")}
                      <em className="not-italic text-[#d4ff00]">★</em>
                    </div>
                    <div className="pb-3">
                      <div className="text-[#d4ff00] tracking-[0.25em] mb-2">★★★★★</div>
                      <div className="font-mono text-[11px] text-white/50 tracking-[0.12em] uppercase">{displayCount} opinii</div>
                    </div>
                  </div>
                )}
              </div>
              {editMode ? (
                <div className="flex flex-col gap-10">
                  {/* Read-only DB reviews — same as public, sliced to 3 with
                      Pokaż więcej. Real reviews are client-authored; trainers
                      can't edit them, only reply via /studio/reviews. */}
                  {trainer.reviews.length > 0 && (
                    <CinematicReviewsList reviews={trainer.reviews} testimonials={[]} />
                  )}
                  {/* Manual-testimonial editor below. Trainer-authored content
                      that lives in customization.cinematicCopy.testimonials. */}
                  <CinematicTestimonialsEditor testimonials={testimonials} />
                </div>
              ) : (
                <CinematicReviewsList reviews={trainer.reviews} testimonials={testimonials} />
              )}
            </div>
          </section>
        );
      })()}

      {/* FINALE */}
      <section className="relative py-32 sm:py-44 px-6 sm:px-12 text-center overflow-hidden bg-[#0a0a0c]" style={{ order: 100 }}>
        <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at center, rgba(212,255,0,0.12) 0%, transparent 60%)" }} />
        <h2
          className="relative z-10 font-medium m-0 mb-8"
          style={{ fontSize: "clamp(48px, 12cqw, 168px)", lineHeight: 0.9, letterSpacing: "-0.05em" }}
        >
          {editMode ? (
            <EditableCopy field="finaleH2Line1" initial={copy.finaleH2Line1} defaultValue="Gotów?" maxLength={40} theme="dark" />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: copy.finaleH2Line1 ?? "Gotów?" }} />
          )}
          <br />
          <em className="italic font-light text-[#d4ff00]">
            {editMode ? (
              <EditableCopy field="finaleH2Line2" initial={copy.finaleH2Line2} defaultValue="Zaczynamy." maxLength={40} theme="dark" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: copy.finaleH2Line2 ?? "Zaczynamy." }} />
            )}
          </em>
        </h2>
        <p className="relative z-10 text-[16px] sm:text-[20px] leading-[1.5] text-white/70 max-w-[580px] mx-auto mb-12">
          {editMode ? (
            <EditableCopy
              field="finaleSubcopy"
              initial={copy.finaleSubcopy}
              defaultValue="Pierwsza 20-minutowa rozmowa jest bezpłatna. Opowiesz mi, gdzie jesteś — a ja powiem, dokąd możemy iść razem."
              maxLength={300}
              multiline
              block
              theme="dark"
            />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: copy.finaleSubcopy ?? "Pierwsza 20-minutowa rozmowa jest bezpłatna. Opowiesz mi, gdzie jesteś — a ja powiem, dokąd możemy iść razem." }} />
          )}
        </p>
        <div className="relative z-10 flex gap-3 justify-center flex-wrap">
          <Link
            href={`/trainers/${trainer.id}/book`}
            className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[15px] font-semibold hover:brightness-110 transition"
          >
            {editMode ? (
              <EditableCopy field="finaleCtaPrimary" initial={copy.finaleCtaPrimary} defaultValue="Umów bezpłatną rozmowę →" maxLength={40} theme="light" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: copy.finaleCtaPrimary ?? "Umów bezpłatną rozmowę →" }} />
            )}
          </Link>
          <Link
            href={`/account/messages?with=${trainer.id}`}
            className="inline-flex items-center gap-2 h-14 px-7 rounded-full border border-white/15 text-[15px] font-medium hover:bg-white/5 transition"
          >
            {editMode ? (
              <EditableCopy field="finaleCtaSecondary" initial={copy.finaleCtaSecondary} defaultValue="Napisz wiadomość" maxLength={40} theme="dark" />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: copy.finaleCtaSecondary ?? "Napisz wiadomość" }} />
            )}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-10 border-t border-white/10 flex justify-between font-mono text-[11px] text-white/50 uppercase tracking-[0.1em] gap-4 flex-wrap" style={{ order: 101 }}>
        <span>© {new Date().getFullYear()} NaZdrow! · {trainer.name}</span>
        <span className="hidden sm:inline">Cinematic template · v1</span>
        <span>{trainer.location}</span>
      </footer>

      {/* Mobile sticky bottom CTA per design. Pinned to viewport bottom on
          narrow public views; hidden in editMode (would clutter the editor)
          and in isEmbed (editor canvas already has its own chrome). The
          spacer below pads the footer so it isn't hidden under the sticky bar. */}
      {!editMode && !isEmbed && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0c]/95 backdrop-blur-md border-t border-white/15 px-5 pt-3 pb-5 grid grid-cols-[1fr_auto] gap-3 items-center @[640px]:hidden">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-white/50 uppercase tracking-[0.1em]">Od</span>
              <span className="text-[17px] font-semibold text-white">{trainer.priceFrom} zł / sesja</span>
            </div>
            <Link
              href={`/trainers/${trainer.id}/book`}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[14px] font-semibold hover:brightness-110 transition"
            >
              Rezerwuj →
            </Link>
          </div>
          <div className="h-24 @[640px]:hidden" />
        </>
      )}
    </div>
  );
}

function Stat({
  value,
  suffix,
  labelField,
  labelDefault,
  labelOverride,
  editMode,
}: {
  value: string;
  suffix?: string;
  labelField: string;
  labelDefault: string;
  labelOverride?: string;
  editMode: boolean;
}) {
  return (
    <div className="bg-[#0a0a0c]/60 backdrop-blur-md p-4 sm:p-5">
      <div className="text-[24px] sm:text-[32px] tracking-[-0.03em] font-medium leading-none">
        {value}
        {suffix && <em className="not-italic text-[#d4ff00] text-[16px] sm:text-[18px] ml-0.5">{suffix}</em>}
      </div>
      <div className="text-[10px] sm:text-[11px] text-white/50 mt-1.5 uppercase tracking-[0.08em]">
        {editMode ? (
          <EditableCopy
            field={labelField}
            initial={labelOverride}
            defaultValue={labelDefault}
            maxLength={40}
            theme="dark"
          />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: labelOverride ?? labelDefault }} />
        )}
      </div>
    </div>
  );
}

function Chap({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-white/50 tracking-[0.2em] uppercase mb-3.5 flex gap-2.5 items-center">
      <span className="w-8 h-px bg-[#d4ff00]" />
      {children}
    </div>
  );
}

