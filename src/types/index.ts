export type Specialization =
  | "weight-loss"
  | "muscle-gain"
  | "rehabilitation"
  | "flexibility"
  | "cardio"
  | "strength"
  | "crossfit"
  | "yoga"
  | "martial-arts"
  | "nutrition";

export interface SpecializationInfo {
  id: Specialization;
  label: string;
  icon: string;
}

export interface Service {
  id?: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  /** Seeded placeholder data shown to brand-new trainers right after signup
   *  (see migration 017 + seed_trainer_placeholders). UI fades these rows and
   *  shows a "Kliknij aby spersonalizować" hint. Cleared to false the first
   *  time the trainer edits any field on the row. */
  isPlaceholder?: boolean;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period?: string;
  featured?: boolean;
  /** See Service.isPlaceholder. */
  isPlaceholder?: boolean;
}

/**
 * Certification record with optional self-verification metadata. Phase 1 of
 * cert verification: trainer can attach a `verificationUrl` (link to issuer's
 * registry — EREPS, AWF, FMS) and/or an uploaded `attachmentUrl` (PDF/image
 * of the diploma in cert-attachments bucket). Phase 2 will add admin-stamped
 * `verifiedAt`/`verifiedBy` fields.
 */
export interface Certification {
  id: string;
  text: string;
  verificationUrl?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
}

export interface Review {
  id: string;
  trainerId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  text: string;
  date: string;
  /** Public reply from the trainer (Yelp / Google Business pattern). When
   *  set, every template renders an "Odpowiedź od trenera" block under the
   *  client's review on the public profile. Edited from /studio/reviews. */
  replyText?: string;
  /** ISO date when the reply was last set; populated by the
   *  `touch_review_reply_at` trigger (migration 016). */
  replyAt?: string;
}

export type TemplateName =
  | "premium"
  | "cozy"
  | "luxury"
  | "studio"
  | "cinematic"
  | "signature";

export type SectionId =
  | "about"
  | "cases"
  | "services"
  | "packages"
  | "gallery"
  | "certifications"
  | "reviews";

export interface SectionConfig {
  id: SectionId;
  visible: boolean;
}

export type ServiceLayout = "cards" | "list" | "table";
export type GalleryLayout = "grid" | "carousel" | "before-after";

/**
 * Cinematic-template-specific copy overrides.
 *
 * The Cinematic profile renders many editorial labels and headings that started
 * out as hardcoded Polish strings. This bag lets a trainer customize each one;
 * any field left blank falls back to the hardcoded default at render time.
 *
 * `aboutChapters` replaces the auto-split of `trainer.about` into 3 paragraphs
 * with an explicit list — each chapter has its own title (e.g. "01 / Zaczęło się"),
 * head ("Skąd przyszłaś."), and body text. When this array is set, it overrides
 * the auto-split behaviour entirely, including the chapter count.
 */
export interface AboutChapter {
  id: string;
  title: string;
  head: string;
  body: string;
}

/**
 * Trainer-authored testimonial that lives outside the real `reviews` table.
 * Real reviews require a client account (FK author_id) and only get created
 * after a session. Testimonials let a trainer seed their profile with
 * legacy / off-platform reviews. Rendered alongside DB reviews on the profile.
 */
export interface CinematicTestimonial {
  id: string;
  authorName: string;
  rating: number;        // 1–5
  text: string;
  date?: string;         // free-form, e.g. "Maraton · 03.2026"
  authorAvatar?: string; // optional photo URL
}

/**
 * Luxury-template-specific copy. Editorial / "tihaja roskosh" voice — Fraunces
 * serif italics, gold accents, "Filozofia · Programy · Atelier · Akredytacje"
 * vocabulary. Mirrors Cinematic/Signature copy bags.
 */
export interface LuxuryCopy {
  brandName?: string;          // header brand text — falls back to trainer.name
  heroEyebrow?: string;        // "Trener · Gdańsk"
  heroTag?: string;            // italic pull-quote under name
  heroStampNum?: string;       // "nº 073"
  heroStampLabel?: string;     // "Trener zaufany"
  /** Per-page-scoped hero portrait. Falls back to trainer.gallery[0] →
   *  trainer.avatar → editorial Unsplash when unset. */
  heroPhoto?: string;
  /** CSS object-position for the hero portrait (e.g. "30% 45%"). */
  heroPhotoFocal?: string;
  navAbout?: string;           // "Filozofia"
  navServices?: string;        // "Usługi"
  navPackages?: string;        // "Programy"
  navGallery?: string;         // "Atelier"
  navCertifications?: string;  // "Akredytacje"
  navReviews?: string;         // "Referencje"
  aboutH2?: string;            // "Filozofia pracy"
  aboutSub?: string;
  aboutQuote?: string;         // big italic side quote
  aboutBody?: string;          // body paragraphs (split by \n\n)
  /** Case-studies section header — eyebrow chapter label + headline + optional
   *  subtitle. Cases data itself lives in the shared `studioCopy.cases` array
   *  (template-agnostic), only these labels are template-styled. */
  casesLabel?: string;         // "II. Studia przypadków"
  casesH2?: string;            // "Wybrane <em>drogi.</em>"
  casesSub?: string;
  servicesH2?: string;
  servicesSub?: string;
  packagesH2?: string;
  packagesSub?: string;
  galleryH2?: string;
  gallerySub?: string;
  certificationsH2?: string;
  certificationsSub?: string;
  reviewsH2?: string;
  reviewsSub?: string;
  finalEyebrow?: string;       // "Zapraszam"
  finalH2?: string;            // "Porozmawiajmy o twojej drodze"
  finalSub?: string;
  finalCta?: string;           // "Umów konsultację"
  /** Label on the "Obejrzyj film" pill below the hero tagline. */
  videoIntroLabel?: string;
}

/**
 * One Studio "case study" — a narrative card with a category tag, headline,
 * body paragraph, and three free-form stats (value + label). Stored as
 * elements of `StudioCopy.cases`. The array is per-page-scoped via the
 * normal customization JSONB pipeline.
 */
export interface StudioCaseStudy {
  id: string;             // uuid; stable across edits + reorders
  tag?: string;           // "Rehabilitacja ACL"
  title?: string;         // rich; "Od zerwania więzadła do gry…"
  body?: string;          // multiline plain
  /** Public URL of an uploaded image. Falls back to gallery / stock when
   *  unset. Stored as the result of uploadStudioCasePhoto, cleared by
   *  removeStudioCasePhoto. */
  photo?: string;
  /** CSS object-position string (e.g. "30% 45%") that controls which part of
   *  the photo stays visible inside the 4/3 crop. Defaults to "center". Set
   *  by clicking on the image in editMode — saves via updateStudioCaseField. */
  photoFocal?: string;
  /** Explicit "no photo" marker. When true, neither the upload nor the
   *  fallback is shown — the photo area renders as a muted placeholder.
   *  Cleared the moment the trainer uploads a new file. */
  photoHidden?: boolean;
  stat1?: string;         // free-form value, e.g. "24 tyg" / "+34%" / "100km"
  stat1Label?: string;    // "Od operacji do meczu"
  stat2?: string;
  stat2Label?: string;
  stat3?: string;
  stat3Label?: string;
}

/**
 * Studio-template-specific copy. Editorial portfolio voice — burnt-orange
 * "/" slashes in the hero name, italic muted em-em phrases like "w skrócie",
 * "case studies", "współpracujemy". Mirrors LuxuryCopy/SignatureCopy bags.
 *
 * Visual language: dense numbered labels ("01 / Kim jestem"), big Geist Sans
 * 500-weight headings with italic muted em accents, asymmetric grids.
 */
export interface StudioCopy {
  brandName?: string;          // header brand text — falls back to "Zdorovite"
  heroSlash?: string;          // accent word in hero ("rehabilitacja")
  heroTag?: string;            // long-form tagline under hero name
  heroAvailability?: string;   // "Dostępna · Najbliższy termin 23 kwietnia"
  /** Public URL of an uploaded photo for the hero card. Falls back to
   *  trainer.avatar / gallery[0] when unset. Per-page-scoped. */
  heroPhoto?: string;
  /** CSS object-position for hero photo (e.g. "30% 45%"). Set via click-to-
   *  focal in editMode. Defaults to "center". */
  heroPhotoFocal?: string;
  /** "No photo" marker for the hero slot — see StudioCaseStudy.photoHidden. */
  heroPhotoHidden?: boolean;
  /** Public URL of the photo cell inside the about-collage grid. Falls back
   *  to trainer.gallery[0] / stock when unset. Per-page-scoped. */
  aboutCollagePhoto?: string;
  /** CSS object-position for the about-collage photo. */
  aboutCollagePhotoFocal?: string;
  /** "No photo" marker for the about-collage cell. */
  aboutCollagePhotoHidden?: boolean;
  // Section labels — "01 / Kim jestem", "02 / Prace", etc.
  aboutLabel?: string;
  aboutH2?: string;            // "Metoda<br>w skrócie"
  aboutSub?: string;
  servicesLabel?: string;
  servicesH2?: string;         // "Jak<br>współpracujemy"
  servicesSub?: string;
  packagesLabel?: string;
  packagesH2?: string;         // "Długoterminowe<br>programy"
  packagesSub?: string;
  galleryLabel?: string;
  galleryH2?: string;          // "Atelier<br>w kadrze"
  gallerySub?: string;
  certificationsLabel?: string;
  certificationsH2?: string;   // "Certyfikaty<br>i szkolenia"
  certificationsSub?: string;
  reviewsLabel?: string;
  reviewsH2?: string;          // "Co mówią<br>klienci"
  reviewsSub?: string;
  reviewsAiInsight?: string;   // big italic paragraph on the dark hero card
  // Cases — "Wybrane case studies": narrative case-study cards between About
  // and Services. Section labels are flat fields; each individual case study
  // lives in the `cases` array below so trainers can add/remove cards.
  casesLabel?: string;
  casesH2?: string;            // "Wybrane<br>case studies"
  casesSub?: string;
  cases?: StudioCaseStudy[];
  finalLabel?: string;
  finalH2?: string;            // "Opowiedz mi<br>swoją historię"
  finalSub?: string;
  finalCtaPrimary?: string;    // "Umów bezpłatną rozmowę →"
  finalCtaSecondary?: string;  // "Napisz wiadomość"
  /** Label on the "Obejrzyj film" pill in the hero info-card. */
  videoIntroLabel?: string;
  // About-collage cells — Studio's editorial "philosophy" callouts.
  aboutPhilosophyLabel?: string;   // "Filozofia"
  aboutPhilosophyHead?: string;    // "Ciało ma pamięć..."
  aboutPhilosophyBody?: string;
}

/**
 * Signature template owns its own social-proof primitives:
 * - MembershipTier replaces "packages" with a "join, with reciprocal commitment"
 *   model. 3 tiers max (Bronze / Silver / Gold). Featured one shows the gold
 *   "Najczęściej wybierane" badge.
 * - PressMention is a curated quote from a publication, sitting between
 *   testimonials (real customers) and certifications (formal credentials).
 */
export interface MembershipTier {
  id: string;
  tierLabel: string;       // "Bronze" / "Silver" / "Gold"
  name: string;            // "Essentials" / "Signature Method" / "Private Client"
  description?: string;
  price: number;
  period?: string;         // "miesiąc" / "kwartał"
  items: string[];
  featured: boolean;
  ctaText?: string;        // "Dołącz do Silver →"
}

export interface PressMention {
  id: string;
  publication: string;     // "VOGUE POLSKA"
  quote: string;
  meta?: string;           // "Wydanie 09/2025 · Profile: Anna K."
  /** "serif" → italic editorial; "bold" → all-caps wordmark */
  publicationStyle: "serif" | "bold";
}

/**
 * Signature-template-specific copy. Mirrors the CinematicCopy bag pattern but
 * keyed differently — Signature uses a "letter to a new client" / "manifesto"
 * voice, plus its own AI-bio insight slot.
 */
export interface SignatureCopy {
  domainBar?: string;            // "katarzyna-nowak.pl"
  domainBarLabel?: string;       // "Signature member · est. 2022"
  monogramOverride?: string;     // override auto-derived "K · N"
  monogramTagline?: string;      // "Personal Training Studio · Kraków"
  heroVolLabel?: string;         // "Vol. IV"
  heroIssueLabel?: string;       // "№ 12 · Kraków · Kwiecień 2026"
  heroSubtitle?: string;         // overrides trainer.tagline if set
  /** Per-page-scoped hero portrait. Falls back to trainer.avatar /
   *  editorial Unsplash. */
  heroPhoto?: string;
  /** CSS object-position for the hero portrait (e.g. "30% 45%"). */
  heroPhotoFocal?: string;
  manifestoLabel?: string;       // "Manifesto"
  manifestoText?: string;        // big italic-laden quote
  manifestoSignature?: string;   // "— Katarzyna"
  /** Case-studies section header. Cases array itself is shared via
   *  `studioCopy.cases`; these labels are Signature-styled. */
  casesLabel?: string;           // "§ 01 · Akta klienta"
  casesH2?: string;              // "Wybrane <em>studia.</em>"
  casesSub?: string;
  letterLabel?: string;          // "§ 01 · O mnie"
  letterTitle?: string;          // "List do nowej klientki."
  letterSignName?: string;       // "— Katarzyna"
  letterSignMeta?: string;       // "Kraków · Kwiecień 2026"
  /** Frozen AI-generated bio summary. Phase 3 will recompute via LLM call;
   *  for now stored verbatim and editable like any other copy field. */
  aiInsightTitle?: string;       // "Co powtarza się w opiniach"
  aiInsightText?: string;        // "Na podstawie 186 opinii..."
  servicesLabel?: string;        // "§ 02 · Usługi"
  servicesH2?: string;           // "Sposoby współpracy."
  servicesSubcopy?: string;      // intro paragraph
  membershipLabel?: string;      // "§ 03 · Członkostwo"
  membershipH2?: string;         // "Nie pakiety. Członkostwo."
  membershipSubcopy?: string;
  pressLabel?: string;           // "§ 04 · Prasa"
  pressH2?: string;              // "Co o mnie pisano."
  certificationsLabel?: string;  // "§ 04 · Wykształcenie"
  certificationsH2?: string;     // "Czarno na białym."
  galleryLabel?: string;         // "§ 05 · Studio"
  galleryH2?: string;            // "Kazimierz, Kraków."
  /** Reviews section header (Signature renders client-quote grid). */
  reviewsLabel?: string;         // "§ 06 · Opinie klientów"
  reviewsH2?: string;            // "Co mówią <em>klienci.</em>"
  reviewsSub?: string;
  contactLabel?: string;         // "§ 06 · Kontakt"
  contactH2?: string;            // "Bezpośrednio do mnie."
  contactSubcopy?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactStudio?: string;
  /** Per-tier label overrides for the membership grid (default Bronze/Silver/
   *  Gold). Indexed 1..3; out-of-range tiers fall back to the default. */
  tier1Label?: string;
  tier2Label?: string;
  tier3Label?: string;
  /** Label on the "Obejrzyj film" pill below the hero subtitle. */
  videoIntroLabel?: string;
}

export interface CinematicCopy {
  aboutChapters?: AboutChapter[];
  testimonials?: CinematicTestimonial[];
  /** Per-page-scoped hero portrait. Falls back to trainer.avatar /
   *  trainer.gallery[0] / stock when unset. */
  heroPhoto?: string;
  /** CSS object-position for the hero portrait (e.g. "30% 45%"). */
  heroPhotoFocal?: string;
  // Chapter eyebrows ("Rozdział X · Y"). Hardcoded numbers are defaults; the
  // trainer can edit them to match their actual section ordering since
  // Cinematic doesn't auto-renumber.
  aboutLabel?: string;            // "Rozdział I · O mnie"
  certificationsLabel?: string;   // "Rozdział II · Certyfikaty"
  servicesLabel?: string;         // "Rozdział III · Usługi"
  packagesLabel?: string;         // "Rozdział IV · Pakiety"
  galleryLabel?: string;          // "Rozdział V · Kadry"
  reviewsLabel?: string;          // "Rozdział VI · Opinie"
  aboutH2Line1?: string;       // "Droga,"
  aboutH2Line2?: string;       // "nie cel."  (rendered italic on line 2)
  servicesH2?: string;         // "Sposoby pracy — wybierz"
  packagesH2?: string;         // "Długa gra. Realne wyniki."
  packagesSubcopy?: string;    // "Pojedyncze sesje są dla tych..."
  galleryH2?: string;          // "Z drogi, lasu, startów."
  reviewsH2?: string;          // "Głosy z drogi."
  certificationsH2?: string;   // "Czarno na białym."
  finaleH2Line1?: string;      // "Gotów?"
  finaleH2Line2?: string;      // "Zaczynamy."  (italic line 2)
  finaleSubcopy?: string;
  finaleCtaPrimary?: string;
  finaleCtaSecondary?: string;
  fullbleedQuote?: string;
  fullbleedMetaTop?: string;   // "Filozofia"
  fullbleedMetaBottom?: string;// "§ 02 / Metoda"
  statStaz?: string;
  statKlienci?: string;
  statOpinii?: string;         // template uses "Z {N} opinii" — N stays dynamic
  statResponse?: string;
  /** Hero "play card" — visual CTA for an intro video. Both fields default
   *  to a sensible Polish copy if unset. The video URL itself isn't wired
   *  yet (no upload action); the card just sits there as design chrome. */
  videoIntroTitle?: string;
  videoIntroSubtitle?: string;
  /** Case-studies section header — eyebrow chapter label + headline +
   *  optional subtitle. Cases data lives in shared `studioCopy.cases`. */
  casesLabel?: string;         // "Rozdział III · Studia przypadków"
  casesH2?: string;            // "Wybrane <em>drogi.</em>"
  casesSub?: string;
}

/**
 * Per-page override for a single service or package row. Stored as a map
 * (keyed by row id) inside `customization.serviceOverrides` / `packageOverrides`
 * so a trainer can hide/reorder/rename items differently on each page without
 * duplicating the underlying services/packages tables.
 *
 * All fields optional. Empty/missing override = render the row from the
 * master table verbatim. `hidden=true` removes it from the page entirely.
 * `position` (when set) wins over the master-table `position` for that page.
 * Text/price overrides override the master values only on this page.
 */
export interface ItemOverride {
  hidden?: boolean;
  position?: number;
  name?: string;
  description?: string;
  price?: number;
  /** Per-page free-form text shown in the service/package meta line
   *  (e.g. "min · sala", "online", "studio"). Lets each page customise the
   *  format/location label without editing the master row. */
  meta?: string;
}

export interface ProfileCustomization {
  template: TemplateName;
  accentColor: string;
  sections: SectionConfig[];
  serviceLayout: ServiceLayout;
  galleryLayout: GalleryLayout;
  coverImage?: string;
  /** CSS object/background-position for the cover image (e.g. "30% 45%").
   *  Set via drag-pan in editMode; defaults to "center". */
  coverImageFocal?: string;
  /** Cinematic-template editorial mid-page shot. Falls back to gallery[1] if unset. */
  cinematicFullbleedImage?: string;
  /** Drag-pan focal point for the Cinematic fullbleed image. */
  cinematicFullbleedFocal?: string;
  /** Cinematic-template hero intro video — 45-second clip rendered behind the
   *  hero "play card". When set, clicking the card opens a lightbox player. */
  cinematicVideoIntroUrl?: string;
  cinematicCopy?: CinematicCopy;
  /** Signature-template copy bag (manifesto, letter title, AI insight, all
   *  per-section labels and headings). Empty for trainers using other templates. */
  signatureCopy?: SignatureCopy;
  /** Luxury-template copy bag (filozofia / atelier / akredytacje labels +
   *  per-section editorial subheadings). Empty for trainers on other templates. */
  luxuryCopy?: LuxuryCopy;
  /** Studio-template copy bag — every editorial label and section heading on
   *  the burnt-orange / lime / off-white "design studio portfolio" template.
   *  Empty for trainers on other templates. */
  studioCopy?: StudioCopy;
  /** Per-page object-position for individual gallery photos. Keyed by
   *  gallery_photos.id; values are CSS object-position strings ("30% 45%").
   *  Lets the same photo be cropped differently on different pages. */
  galleryFocal?: Record<string, string>;
  /** IDs of gallery photos hidden on THIS page. Soft-delete written by the
   *  gallery editor's trash button — saved via the customization snapshot
   *  pipeline so undo can bring the photo back. The underlying gallery_photos
   *  row + storage file are untouched; permanent deletion is a separate
   *  action exposed at /studio/profile/gallery. */
  galleryHidden?: string[];
  /** Per-page service overrides: hide / reorder / rewrite specific services
   *  on this page only. Keyed by service id. */
  serviceOverrides?: Record<string, ItemOverride>;
  /** Per-page package overrides — same shape as serviceOverrides but keyed by
   *  package id. */
  packageOverrides?: Record<string, ItemOverride>;
  /** Per-page specializations override. When present, the trainer's chip row
   *  on this page uses these instead of the global `trainer.specializations`
   *  field — so a B2B page can advertise different niches than a B2C page.
   *  Empty array is meaningful: "no chips on this page". Undefined means
   *  "fall back to trainer.specializations". */
  specializations?: string[];
  /**
   * Up to 20 prior snapshots of THIS customization object (each one without
   * its own _history field — no recursion). Pushed before every mutation that
   * runs through saveCustomization in cinematic-copy-actions or updateDesign.
   * Older entries first; popping the last one is the "undo" target.
   *
   * For deletions of side-effect rows (services / packages — rows that live
   * outside customization JSONB), the snapshot also carries an
   * `_restoreOnUndo` payload so undoCustomization can re-insert the row
   * before applying the snapshot. Only present on tombstone snapshots.
   */
  _history?: Array<Omit<ProfileCustomization, "_history" | "_redoStack"> & {
    _restoreOnUndo?: RestoreOp;
  }>;
  /**
   * Redo stack — populated by `undoCustomization` when it pops `_history`,
   * cleared by every other mutation. Each entry mirrors a `_history` entry
   * but represents the state we'd like to RETURN TO via Powtórz, plus the
   * `_restoreOnUndo` payload of the thing we just undid (so Powtórz can
   * re-execute the side effect, not just re-apply customization JSONB).
   */
  _redoStack?: Array<Omit<ProfileCustomization, "_history" | "_redoStack"> & {
    _redoAction?: RestoreOp;
  }>;
}

/**
 * Discriminated union covering every undoable side-effect mutation. Each
 * variant carries enough data to revert AND re-apply (Powtórz):
 *  - "deleted" rows ship the full row → undo = insert, redo = delete by id
 *  - "created" rows ship the full row → undo = delete by id, redo = insert
 *  - "updated" variants ship before+after → undo = patch with before, redo = patch with after
 *  - specialization variants only need the composite-PK spec_id
 */
export type RestoreOp =
  | { kind: "trainerUpdated"; before: Record<string, unknown>; after: Record<string, unknown> }
  | { kind: "serviceDeleted"; row: Record<string, unknown> }
  | { kind: "serviceCreated"; row: Record<string, unknown> }
  | { kind: "serviceUpdated"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }
  | { kind: "packageDeleted"; row: Record<string, unknown> }
  | { kind: "packageCreated"; row: Record<string, unknown> }
  | { kind: "packageUpdated"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }
  | { kind: "specializationAdded"; specId: string }
  | { kind: "specializationRemoved"; specId: string };

/**
 * One row in `trainer_pages` — a single public-facing presentation of the
 * trainer with its own template + customization bag + URL slug. Trainers can
 * have multiple pages (B2C / B2B / seasonal / niche) all sharing the same
 * underlying account-level data (services, packages, certifications, etc.)
 * which lives on the master `trainers` row and related tables.
 *
 * The page marked `isPrimary` is what visitors see at /trainers/{trainerSlug}
 * by default; other pages live under /trainers/{trainerSlug}/{pageSlug}.
 */
export interface TrainerPage {
  id: string;
  trainerId: string;
  slug: string;
  template: TemplateName;
  customization: ProfileCustomization;
  isPrimary: boolean;
  status: "draft" | "published";
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Trainer {
  id: string;
  name: string;
  avatar: string;
  specializations: Specialization[];
  tagline: string;
  about: string;
  experience: number;
  rating: number;
  reviewCount: number;
  priceFrom: number;
  location: string;
  languages: string[];
  certifications: string[];
  /** Parallel to `certifications` (same length, same order) but with
   *  per-cert verification metadata. Empty for mock trainers; populated for
   *  DB-backed trainers when migration 014 has been applied. Renderers prefer
   *  this array (so they can show verification badges) and fall back to plain
   *  `certifications` text when missing. */
  certificationDetails?: Certification[];
  gallery: string[];
  /** Same gallery items but with stable photo IDs — needed by edit affordances
   *  (delete a specific photo) and any per-photo metadata in the future. */
  galleryItems?: { id: string; url: string }[];
  services: Service[];
  packages: Package[];
  reviews: Review[];
  /** Signature-template owned content. Empty array on trainers using other
   *  templates — SignatureProfile falls back to packages-as-tiers when missing. */
  membershipTiers?: MembershipTier[];
  pressMentions?: PressMention[];
  customization: ProfileCustomization;
}
