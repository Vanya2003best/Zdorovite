import Link from "next/link";
import type { Trainer } from "@/types";
import { getSpecLabel } from "@/data/specializations";
import FavoriteButton from "./FavoriteButton";
import EditableSigCopy from "./EditableSigCopy";
import EditableAboutInline from "./EditableAboutInline";
import EditableTemplateHeroImage from "./EditableTemplateHeroImage";
import SignatureServicesEditor from "./SignatureServicesEditor";
import SignaturePackagesEditor from "./SignaturePackagesEditor";
import SignatureGalleryEditor from "./SignatureGalleryEditor";
import SignatureGalleryView from "./SignatureGalleryView";
import SignatureReviewsList from "./SignatureReviewsList";
import SignatureBookingWidget from "./SignatureBookingWidget";
import VideoIntroButton from "./VideoIntroButton";
import AutoHideHeader from "@/components/AutoHideHeader";
import SignatureCases from "./SignatureCases";
import EditableSpecializations from "./EditableSpecializations";
import SectionAITextButton from "./SectionAITextButton";
import SectionAIServicesButton from "./SectionAIServicesButton";
import SectionAIPackagesButton from "./SectionAIPackagesButton";
import SectionAICasesButton from "./SectionAICasesButton";
import { generateAboutVariants, applyAboutVariant } from "./ai-actions";
import { AI_PILL_THEMES } from "./ai-pill-themes";
import type { Service } from "@/types";
import { applyServiceOverrides, applyPackageOverrides } from "./apply-overrides";

// Signature = "personal brand" — burgundy + cream + gold editorial. Designed
// pixel-close to designs/16-profile-signature-desktop.html and 17-mobile.html.
//
// Phase 1 implementation: render-only against existing trainer fields. The
// design's exclusive features (membership-tier model, press DB, AI bio insight
// via real LLM call, custom domain CNAME) are Phase 2 — for now we render
// believable placeholders sourced from existing data: packages → tiers,
// reviews → press cards, static "As seen in" strip, computed AI insight from
// review counts.

const FALLBACK_PORTRAIT = "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&h=1000&fit=crop&crop=faces";

/** Roman-numeral helper for the §-numbered services list. Caps at V because
 *  realistic trainers won't list more than ~5-6 services here; anything past
 *  that falls back to plain numerals. */
function roman(n: number): string {
  const map = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return map[n] ?? String(n);
}

/** Initials for the K · N monogram. "Ivan Zhigalin" → "I · Z". Falls back to
 *  "—" if name is empty so the layout keeps its rhythm. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return `${parts[0]![0]!.toUpperCase()} · ${parts[parts.length - 1]![0]!.toUpperCase()}`;
}

/** Slug → fake personal domain ("ivan-zhigalin" → "ivan-zhigalin.pl"). Used
 *  by the contact email + footer to suggest "this trainer has their own
 *  brand site". The top domain-bar that used to expose this URL was removed
 *  per UX direction (was reading as platform chrome, not part of the design). */
function fakeDomain(slug: string): string {
  return `${slug}.pl`;
}

const POLISH_MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

export default function SignatureProfile({
  trainer,
  trainerDbId,
  availabilityDows = [],
  editMode,
  isOwner,
  published,
  initialIsFavorite,
  needsLoginToFavorite,
  isEmbed = false,
}: {
  trainer: Trainer;
  /** Trainer's UUID — passed to the booking widget so it can fetch real
   *  availability slots. Distinct from `trainer.id` (which is the URL slug). */
  trainerDbId?: string;
  /** Day-of-week numbers (0–6) the trainer accepts bookings on, derived from
   *  availability_rules. Drives which calendar cells are highlighted in the
   *  hero booking widget. */
  availabilityDows?: number[];
  editMode: boolean;
  isOwner: boolean;
  published: boolean;
  initialIsFavorite: boolean;
  needsLoginToFavorite: boolean;
  isEmbed?: boolean;
}) {
  const sigCopy = trainer.customization.signatureCopy ?? {};
  const effectiveSpecs = trainer.customization.specializations ?? trainer.specializations;
  // Per-page overrides for services/packages (visibility/order/copy).
  const services = applyServiceOverrides(trainer.services, trainer.customization);
  const packages = applyPackageOverrides(trainer.packages, trainer.customization);
  const m = sigCopy.monogramOverride?.trim() || monogram(trainer.name);
  const monoTagline = sigCopy.monogramTagline?.trim() || `Personal Training Studio · ${trainer.location.split(",")[0]}`;
  // Used by contact email fallback + footer; the top domain-bar that
  // exposed it was removed per UX direction.
  const domain = sigCopy.domainBar?.trim() || fakeDomain(trainer.id);

  // Live "issue" stamp for the editorial chrome — Vol/№/month/year all derive
  // from the current date so the page reads as a fresh issue each month, not
  // a frozen "Kwiecień 2026" from when the design was built. Trainer can still
  // override via heroIssueLabel / letterSignMeta editable copy fields.
  const now = new Date();
  const monthLabelPL = POLISH_MONTHS[now.getMonth()] ?? "";
  const yearLabel = now.getFullYear();
  const issueNumber = now.getMonth() + 1; // 1..12 — "№ 5" in May, "№ 12" in December
  const cityShort = trainer.location.split(",")[0] ?? trainer.location;
  /** Resolve a signatureCopy field with fallback. Trims whitespace and treats
   *  empty as unset so a deleted override falls back to the design default. */
  const t = (k: keyof typeof sigCopy, fb: string): string => {
    const v = sigCopy[k]?.trim();
    return v && v.length > 0 ? v : fb;
  };

  /** In editMode → render EditableSigCopy hooked to updateSignatureCopyField.
   *  In view mode → render the resolved string as HTML (sigCopy values are
   *  sanitized on save so this is safe). Use for every editable signatureCopy
   *  field; opts let callers force plain-text mode for fields like phone. */
  const Sig = ({
    k,
    fb,
    multiline = false,
    maxLength = 200,
    rich = true,
    block = false,
  }: {
    k: keyof typeof sigCopy;
    fb: string;
    multiline?: boolean;
    maxLength?: number;
    rich?: boolean;
    block?: boolean;
  }) => {
    if (editMode) {
      return (
        <EditableSigCopy
          field={String(k)}
          initial={sigCopy[k]}
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

  // Letter-format about: split body by blank lines, keep up to ~5 paragraphs.
  // First paragraph gets the drop-cap treatment (`::first-letter` styled in JSX).
  const aboutParas = (trainer.about || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 5);

  // Membership tiers: prefer real DB-backed tiers (Phase 2) → fall back to
  // packages-as-tiers (Phase 1) so trainers with the older data shape still
  // get a fully-rendered section. Cap at 3 either way (the dark grid only
  // looks right with exactly 3 cards).
  type TierLike = {
    id: string;
    tierLabel: string;
    name: string;
    description?: string;
    price: number;
    period?: string;
    items: string[];
    featured: boolean;
    ctaText?: string;
  };
  const realTiers = trainer.membershipTiers ?? [];
  const tierLabelDefaults = ["Bronze", "Silver", "Gold"];
  /** Resolve the tier label for slot i (0-based). Trainer can override via
   *  signatureCopy.tier1Label / tier2Label / tier3Label from the inline editor. */
  const tierLabelAt = (i: number): string => {
    const key = (`tier${i + 1}Label`) as keyof typeof sigCopy;
    return sigCopy[key]?.trim() || tierLabelDefaults[i] || `Tier ${i + 1}`;
  };
  const tiers: TierLike[] =
    realTiers.length > 0
      ? realTiers.slice(0, 3)
      : packages.slice(0, 3).map((p, i) => ({
          id: p.id,
          tierLabel: tierLabelAt(i),
          name: p.name,
          description: p.description,
          price: p.price,
          period: p.period,
          items: p.items,
          featured: !!p.featured,
          ctaText: undefined,
        }));

  // "As seen in" strip — derived from press_mentions if any exist, otherwise
  // fall back to a representative Polish-mag set so empty-state still looks
  // designed (not a half-built section).
  const realPress = trainer.pressMentions ?? [];
  const press =
    realPress.length > 0
      ? realPress.map((p) => ({ name: p.publication, bold: p.publicationStyle === "bold" }))
      : [
          { name: "VOGUE POLSKA", bold: true },
          { name: "Elle", bold: false },
          { name: "WOMEN'S HEALTH", bold: true },
          { name: "Glamour", bold: false },
          { name: "FORBES WOMEN", bold: true },
        ];

  // Press feature cards — same DB-or-fallback pattern. Fallbacks bake in the
  // trainer's name so they don't read as obvious lorem-ipsum stock copy.
  const pressFeatures =
    realPress.length > 0
      ? realPress.slice(0, 3).map((p) => ({
          pub: p.publication,
          bold: p.publicationStyle === "bold",
          quote: p.quote,
          meta: p.meta ?? "",
        }))
      : [
          {
            pub: "VOGUE POLSKA",
            bold: true,
            quote: `„Jeden z najbardziej szanowanych trenerów osobistych w Polsce — ${trainer.name} buduje relacje z klientami, które trwają latami."`,
            meta: "Wydanie 09/2025",
          },
          {
            pub: "Women's Health",
            bold: false,
            quote: `„Metoda jest antidotum na szybkie efekty. Klienci wracają, bo widzą — a nie czują — że się zmienili."`,
            meta: "Luty 2026 · Profile",
          },
          {
            pub: "FORBES",
            bold: true,
            quote: `„Gdy pytamy 50 polskich osób sukcesu, kto je trenuje, 11 z nich odpowiada nazwiskiem."`,
            meta: "Ranking · 10/2025",
          },
        ];

  // AI insight: prefer trainer-saved aiInsightText (Phase 2 lets them edit it
  // inline; Phase 3 will recompute via real LLM call). Falls back to a number-
  // grounded sentence built from current reviews + testimonials count.
  const totalReviews = trainer.reviews.length + (trainer.customization.cinematicCopy?.testimonials?.length ?? 0);
  const aiInsight =
    sigCopy.aiInsightText?.trim() ||
    (totalReviews > 0
      ? `Na podstawie ${totalReviews} ${totalReviews === 1 ? "opinii" : "opinii"}, trzy najczęściej powracające słowa to: cierpliwość, konkret, odczuwalna zmiana. Większość klientów zostaje dłużej niż 6 miesięcy.`
      : `AI bio insight pojawi się tu automatycznie, gdy klienci zaczną zostawiać opinie — będzie podsumowywać powtarzające się słowa i wzorce zwrotne.`);
  const aiInsightTitle = sigCopy.aiInsightTitle?.trim() || "Co powtarza się w opiniach";

  // Hero portrait fallback chain — used by view mode AND as the bottom of
  // the EditableTemplateHeroImage stack. Per-page signatureCopy.heroPhoto
  // overrides everything when set.
  const portraitFallback = trainer.avatar || FALLBACK_PORTRAIT;
  const portrait = sigCopy.heroPhoto || portraitFallback;

  return (
    <div
      className="min-h-screen bg-[#f6f1ea] text-[#1a1613] antialiased"
      // Note: no `zoom` here — Chrome's sticky positioning breaks when an
      // ancestor has `zoom`, and the hero left-column relies on sticky to
      // stay pinned while the photo+calendar scroll past. Browser zoom is
      // the right place for global "make it smaller" preference.
      style={{ containerType: "inline-size" }}
    >
      {/* Chrome header — looks like the trainer's own studio site, not Zdorovite's.
          Wrapped in AutoHideHeader so it slides off on scroll-down and back
          in on scroll-up (same UX as Studio/Luxury/Cozy). */}
      {!isEmbed && (
        <AutoHideHeader>
        <header className="px-6 sm:px-10 py-5 sm:py-[22px] flex justify-between items-center border-b border-[#e4dccf] bg-[#f6f1ea] gap-4">
          <div className="flex flex-col leading-none">
            <Link href="/" aria-label="NaZdrow!">
              <span className="text-[18px] sm:text-[22px] tracking-[0.3em] font-medium">
                {editMode ? (
                  <Sig k="monogramOverride" fb={m} maxLength={20} rich={false} />
                ) : (
                  m
                )}
              </span>
            </Link>
            <span className="text-[8px] sm:text-[9px] tracking-[0.3em] uppercase text-[#7d7268] mt-1.5">
              <Sig k="monogramTagline" fb={monoTagline} maxLength={80} rich={false} />
            </span>
          </div>
          <nav className="hidden @[1024px]:flex gap-9 text-[13px] text-[#3d362f] tracking-[0.02em]">
            <a href="#manifesto" className="hover:text-[#7d1f1f] transition">Manifesto</a>
            <a href="#letter" className="hover:text-[#7d1f1f] transition">Metoda</a>
            <a href="#cases" className="hover:text-[#7d1f1f] transition">Kejsy</a>
            <a href="#book" className="hover:text-[#7d1f1f] transition">Usługi</a>
            <a href="#membership" className="hover:text-[#7d1f1f] transition">Członkostwo</a>
            <a href="#certifications" className="hover:text-[#7d1f1f] transition">Certyfikaty</a>
            {realPress.length > 0 && (
              <a href="#press" className="hover:text-[#7d1f1f] transition">Prasa</a>
            )}
            <a href="#contact" className="hover:text-[#7d1f1f] transition">Kontakt</a>
          </nav>
          <div className="flex gap-3 items-center text-[12px]">
            {!isOwner && (
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-10 h-10 rounded-full bg-white border border-[#e4dccf] inline-flex items-center justify-center text-[#1a1613] hover:bg-[#ede4d6] transition disabled:opacity-70"
                size={16}
              />
            )}
            {isOwner && (
              <Link
                href="/studio/design"
                title="Edytuj profil"
                className="w-10 h-10 rounded-full bg-white border border-[#e4dccf] inline-flex items-center justify-center text-[#1a1613] hover:bg-[#ede4d6] hover:text-[#7d1f1f] transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            )}
            <span className="hidden @[640px]:inline text-[#7d7268] font-mono">+48 600 000 000</span>
            <Link
              href={`/trainers/${trainer.id}/book`}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:h-[42px] sm:px-5 rounded-full bg-[#7d1f1f] text-white text-[12px] sm:text-[13px] font-medium tracking-[-0.005em] border border-[#7d1f1f] hover:bg-[#5e1515] hover:border-[#5e1515] transition"
            >
              Umów konsultację →
            </Link>
          </div>
        </header>
        </AutoHideHeader>
      )}

      {/* HERO — editorial split: title/meta/CTA · portrait + inline calendar.
          Right column (portrait + calendar) is taller than left, so the left
          column is `sticky top-10 self-start` on @[1024px]+ — it stays in
          view as the user scrolls past the photo. Sticky releases when the
          calendar's bottom hits the top of the viewport, which is exactly
          "до конца календаря" — the left content rides along until the
          calendar finishes. */}
      <section className="px-6 sm:px-10 pt-12 sm:pt-16 pb-16 sm:pb-20">
        <div className="grid @[1024px]:grid-cols-[minmax(0,720px)_500px] @[1024px]:justify-center gap-8 @[1024px]:gap-12 items-start">
          <div className="@[1024px]:sticky @[1024px]:top-10 self-start">
            <div className="flex gap-3.5 items-center font-mono text-[11px] text-[#7d7268] tracking-[0.12em] uppercase mb-7">
              <span className="text-[#7d1f1f] font-semibold">
                <Sig
                  k="heroVolLabel"
                  fb={`Vol. ${roman(Math.max(1, Math.min(10, trainer.experience)))}`}
                  maxLength={20}
                  rich={false}
                />
              </span>
              {/* Issue stamp is auto-computed from current date — not
                  editable in the studio so the trainer can't accidentally
                  freeze it on one month. */}
              <span>{`№ ${issueNumber} · ${cityShort} · ${monthLabelPL} ${yearLabel}`}</span>
              <span className="flex-1 h-px bg-[#cfc3b0] hidden sm:block" />
            </div>
            <h1
              style={{ fontSize: "clamp(56px, 9cqw, 108px)", lineHeight: 0.9, letterSpacing: "-0.045em" }}
              className="font-normal m-0 mb-4 text-[#1a1613]"
            >
              {trainer.name.split(" ").slice(0, 1)}
              <br />
              {trainer.name.split(" ").slice(1).join(" ") || ""}
              <em className="not-italic font-light text-[#7d1f1f] italic">,</em>
            </h1>
            <p className="text-[16px] @[640px]:text-[20px] leading-[1.4] text-[#3d362f] max-w-[560px] tracking-[-0.01em] m-0 mb-6">
              <Sig k="heroSubtitle" fb={trainer.tagline} multiline block maxLength={300} />
            </p>

            {(editMode || trainer.customization.cinematicVideoIntroUrl) && (
              <div className="mb-9">
                <VideoIntroButton
                  videoUrl={trainer.customization.cinematicVideoIntroUrl ?? null}
                  editMode={editMode}
                  theme="light"
                  accentColor="#7d1f1f"
                  label={
                    <Sig k="videoIntroLabel" fb="Obejrzyj film o trenerze" maxLength={60} rich={false} />
                  }
                />
              </div>
            )}

            <div className="flex flex-wrap gap-6 @[640px]:gap-12 py-6 border-y border-[#e4dccf] mb-9">
              <Meta k="Staż" v={`${trainer.experience} lat`} />
              <Meta k="Klienci" v={`${trainer.reviewCount}+`} />
              <Meta k="Studio" v={trainer.location} />
              <Meta k="Języki" v={trainer.languages.join(" · ") || "Polski"} />
              <Meta k="Ocena" v={`${trainer.rating} ★ / ${trainer.reviewCount} opinii`} gold />
            </div>

            <div className="flex gap-3 items-center flex-wrap">
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-full bg-[#7d1f1f] text-white border border-[#7d1f1f] hover:bg-[#5e1515] hover:border-[#5e1515] transition font-medium text-[14px] tracking-[-0.005em]"
                style={{ height: 52 }}
              >
                Umów konsultację
              </Link>
              <span className="text-[#7d7268] text-[13px] italic">lub</span>
              <a
                href={`/trainers/${trainer.id}/messages`}
                className="inline-flex items-center justify-center gap-2 px-7 rounded-full bg-transparent text-[#3d362f] border border-[#cfc3b0] hover:bg-[#1a1613] hover:text-white hover:border-[#1a1613] transition font-medium text-[14px] tracking-[-0.005em]"
                style={{ height: 52 }}
              >
                Napisz wiadomość
              </a>
            </div>
          </div>

          {/* Right column: portrait + inline mini-calendar. The pb-32 on the
              wrapper extends this column past the natural calendar bottom so
              the grid container is meaningfully taller than the left text —
              that "extra" tail is what gives the sticky text more scroll
              distance to stay pinned through. */}
          <div className="flex flex-col gap-5 @[1024px]:pb-16">
            <div
              className="relative rounded-sm shadow-[0_40px_80px_-40px_rgba(26,22,19,0.35)]"
              style={{ aspectRatio: "9/10" }}
            >
              <EditableTemplateHeroImage
                template="signature"
                current={sigCopy.heroPhoto}
                currentFocal={sigCopy.heroPhotoFocal}
                fallback={portraitFallback}
                alt={trainer.name}
                editable={editMode}
                className="absolute inset-0 w-full h-full object-cover"
                containerClassName="absolute inset-0 rounded-sm overflow-hidden"
              />
              <div className="absolute top-5 left-5 bg-[#1a1613]/85 backdrop-blur-md text-[#ede4d6] px-3.5 py-2.5 rounded-sm pointer-events-none">
                <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#a68b5b] mb-1">
                  {m} · PORTRAIT № 02
                </div>
                <div className="text-[13px] font-medium tracking-[-0.005em]">
                  Studio · {trainer.location.split(",").slice(-1)[0]?.trim() || trainer.location}
                </div>
              </div>
            </div>

            {/* Real booking widget — current month, available days from
                availability_rules, slot click → /book?date=...&service=...
                with the date pre-filled. Replaces the static-mock calendar. */}
            <SignatureBookingWidget
              trainerDbId={trainerDbId}
              trainerSlug={trainer.id}
              defaultServiceId={trainer.services.find((s) => s.id)?.id}
              availableDows={availabilityDows}
            />
          </div>
        </div>
      </section>

      {/* Press strip "As seen in" — hidden when no real press_mentions to
          avoid showing fake VOGUE/Elle logos to trainers who haven't
          uploaded any actual press features. */}
      {realPress.length > 0 && (
        <div className="bg-[#ede4d6] border-y border-[#e4dccf] px-6 sm:px-10 py-6 sm:py-8 flex gap-6 @[640px]:gap-14 items-center justify-center flex-wrap">
          <span className="font-mono text-[10px] text-[#7d7268] tracking-[0.2em] uppercase">As seen in</span>
          {press.map((p, i) => (
            <span key={i} className="flex items-center gap-6 @[640px]:gap-14">
              <span
                className={
                  p.bold
                    ? "font-semibold tracking-[0.08em] text-[14px] @[640px]:text-[16px] uppercase text-[#3d362f]"
                    : "italic text-[#3d362f] tracking-[-0.01em] text-[18px] @[640px]:text-[22px] font-normal"
                }
              >
                {p.name}
              </span>
              {i < press.length - 1 && <span className="w-1 h-1 rounded-full bg-[#cfc3b0] hidden @[640px]:inline-block" />}
            </span>
          ))}
        </div>
      )}

      {/* MANIFESTO — centered editorial pull-quote with signature */}
      <section id="manifesto" className="px-6 sm:px-10 py-24 sm:py-[140px] text-center relative">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-[120px] sm:text-[240px] leading-none text-[#7d1f1f] opacity-[0.12] font-serif select-none pointer-events-none">
          &ldquo;
        </div>
        <div className="font-mono text-[11px] text-[#7d1f1f] tracking-[0.25em] uppercase mb-8 relative z-[1]">
          <Sig k="manifestoLabel" fb="Manifesto" maxLength={30} rich={false} />
        </div>
        <p
          style={{ fontSize: "clamp(22px, 4cqw, 44px)", lineHeight: 1.3, letterSpacing: "-0.02em" }}
          className="font-normal max-w-[1000px] mx-auto text-[#1a1613] m-0 relative z-[1]"
        >
          <Sig
            k="manifestoText"
            fb={`${trainer.name.split(" ")[0]} nie sprzedaje <em>kolejnej diety</em> ani <em>kolejnego wyzwania</em>. Sprzedaje cierpliwość, konkret i plan, który mieści się w realnym życiu — i daje <em>siłę, która zostaje</em>.`}
            multiline
            block
            maxLength={500}
          />
        </p>
        <div className="mt-10 inline-flex gap-3.5 items-center relative z-[1]">
          <span className="w-12 h-px bg-[#7d1f1f]" />
          <span className="font-serif italic text-[18px] sm:text-[20px] text-[#7d1f1f]">
            <Sig k="manifestoSignature" fb={`— ${trainer.name.split(" ")[0]}`} maxLength={40} rich={false} />
          </span>
          <span className="w-12 h-px bg-[#7d1f1f]" />
        </div>
      </section>

      {/* LETTER — about as a personal letter, with drop-cap and AI insight box */}
      <section id="letter" data-section-id="about" className="bg-white border-y border-[#e4dccf] px-6 sm:px-10 py-20 sm:py-[120px]">
        {editMode && (
          <div className="max-w-[1340px] mx-auto">
            <SectionAITextButton
              label="Metoda"
              currentText={trainer.about}
              onGenerate={generateAboutVariants}
              onApply={applyAboutVariant}
              template="signature"
              pillClassName={AI_PILL_THEMES.signature}
            />
          </div>
        )}
        {/* `items-start` so the photo column flows naturally (its full
            aspect-3/4 height drives the grid row), while the right column is
            `@[1024px]:sticky` so the text stays pinned at the top of the
            viewport as the user scrolls past the photo. Sticky releases when
            the section bottom comes into view. Photo column is NOT sticky —
            it scrolls normally. */}
        <div className="grid @[1024px]:grid-cols-[1fr_2fr] gap-12 @[1024px]:gap-[96px] max-w-[1200px] mx-auto items-start">
          <aside className="flex flex-col gap-6">
            <div className="font-mono text-[10px] text-[#7d7268] tracking-[0.25em] uppercase">
              <Sig k="letterLabel" fb="§ 01 · O mnie" maxLength={40} rich={false} />
            </div>
            <h2
              style={{ fontSize: "clamp(36px, 5cqw, 52px)", lineHeight: 0.95, letterSpacing: "-0.03em" }}
              className="font-normal m-0"
            >
              <Sig k="letterTitle" fb="List do nowego <em>klienta.</em>" maxLength={120} />
            </h2>
            {/* Letter-aside portrait is the SAME photo as the hero
                (`signatureCopy.heroPhoto` resolves into `portrait`). Wrapping
                it in EditableTemplateHeroImage means edits here propagate to
                the hero — one upload, two visible spots. */}
            <div className="rounded-sm overflow-hidden mt-3 relative bg-[#ede4d6]" style={{ aspectRatio: "3/4" }}>
              <EditableTemplateHeroImage
                template="signature"
                current={sigCopy.heroPhoto}
                currentFocal={sigCopy.heroPhotoFocal}
                fallback={portraitFallback}
                alt={trainer.name}
                editable={editMode}
                className="w-full h-full object-cover"
                containerClassName="absolute inset-0 rounded-sm overflow-hidden"
              />
            </div>
          </aside>

          {/* Right column is sticky on @[1024px]+ so the body stays in view
              while the user scrolls past the (typically taller) photo column.
              `self-start` is required for sticky to work in a CSS Grid item
              — without it the cell stretches to row height and there's
              nothing for sticky to scroll within. `top-10` keeps a small gap
              under the page chrome / nav. */}
          <div className="@[1024px]:sticky @[1024px]:top-10 self-start">
            {editMode ? (
              <div className="text-[16px] @[640px]:text-[19px] leading-[1.6] @[640px]:leading-[1.65] text-[#3d362f] tracking-[-0.005em] mb-5 whitespace-pre-line">
                <EditableAboutInline
                  initial={trainer.about}
                  placeholder="Napisz swój list do nowego klienta — podziel akapity pustą linią."
                />
              </div>
            ) : aboutParas.length === 0 ? (
              <p className="text-[19px] leading-[1.65] text-[#3d362f] tracking-[-0.005em] italic">
                Tu pojawi się list do Twoich klientów — uzupełnij sekcję &laquo;O mnie&raquo; w edytorze.
              </p>
            ) : (
              aboutParas.map((p, i) => (
                <p
                  key={i}
                  className={`text-[16px] @[640px]:text-[19px] leading-[1.6] @[640px]:leading-[1.65] text-[#3d362f] tracking-[-0.005em] mt-0 mb-5 ${i === 0 ? "first-letter:float-left first-letter:font-serif first-letter:text-[56px] @[640px]:first-letter:text-[80px] first-letter:leading-[0.82] first-letter:text-[#7d1f1f] first-letter:mr-3 first-letter:mt-1" : ""}`}
                >
                  {p}
                </p>
              ))
            )}

            {/* AI bio insight box — Signature exclusive (Phase 2 = real LLM call) */}
            <div className="mt-9 p-5 sm:p-7 bg-[#ede4d6] rounded-sm border-l-[3px] border-[#7d1f1f]">
              <div className="flex gap-2.5 items-center mb-3 flex-wrap">
                <span className="inline-flex gap-1.5 items-center px-2.5 py-[3px] rounded-full bg-gradient-to-br from-[#7d1f1f] to-[#a03030] text-white text-[10px] font-semibold tracking-[0.08em] uppercase">
                  <span>✦</span> AI · Bio insight
                </span>
                <span className="text-[12px] font-semibold tracking-[0.03em]">
                  <Sig k="aiInsightTitle" fb="Co powtarza się w opiniach" maxLength={60} rich={false} />
                </span>
              </div>
              <p className="text-[14px] @[640px]:text-[16px] leading-[1.55] m-0 text-[#3d362f]">
                <Sig k="aiInsightText" fb={aiInsight} multiline block maxLength={500} rich={false} />
              </p>
            </div>

            {/* Closing row — handwritten "— Ivan" left-aligned + city/date
                right-aligned, both under the body text. Reads like the
                closing of a letter: signature on one side, place + date on
                the other. */}
            <div className="mt-11 pt-7 border-t border-[#e4dccf] flex justify-between items-end gap-4 flex-wrap">
              <div className="font-serif italic text-[24px] sm:text-[36px] text-[#7d1f1f] leading-none">
                <Sig k="letterSignName" fb={`— ${trainer.name.split(" ")[0]}`} maxLength={40} rich={false} />
              </div>
              {/* Auto-computed (city + current month/year) — not editable so
                  it never freezes on a stale month. */}
              <div className="font-mono text-[10px] sm:text-[11px] text-[#7d7268] tracking-[0.08em] uppercase text-right">
                {cityShort}<br />{monthLabelPL} {yearLabel}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CASES — "Akta klienta" between letter and services. Same shared
          studioCopy.cases data + actions; SignatureCases applies cream-and-
          burgundy chrome with mono § labels. In editMode renders even when
          empty (auto-seeds 3). */}
      {(() => {
        const studioCopyForCases = trainer.customization.studioCopy ?? {};
        const casesArr = studioCopyForCases.cases ?? [];
        const casesNeverSet = !("cases" in studioCopyForCases);
        if (!editMode && casesArr.length === 0) return null;
        const galleryFallbacks = trainer.gallery.length > 0 ? trainer.gallery.slice(0, 6) : [];
        return (
          <section id="cases" data-section-id="cases" className="px-6 sm:px-10 py-20 sm:py-[120px] bg-white/40 scroll-mt-20">
            {editMode && (
              <div className="max-w-[1340px] mx-auto">
                <SectionAICasesButton
                  currentCasesCount={casesArr.length}
                  template="signature"
                  pillClassName={AI_PILL_THEMES.signature}
                />
              </div>
            )}
            <div className="max-w-[1340px] mx-auto mb-14">
              <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.2em] uppercase mb-4">
                <Sig k="casesLabel" fb="§ 01 · Akta klienta" maxLength={60} rich={false} />
              </div>
              <h2
                style={{ fontSize: "clamp(40px, 6cqw, 72px)", lineHeight: 0.95, letterSpacing: "-0.035em" }}
                className="font-normal m-0"
              >
                <Sig k="casesH2" fb="Wybrane <em>studia.</em>" maxLength={120} />
              </h2>
              {(editMode || sigCopy.casesSub) && (
                <p className="text-[14px] sm:text-[16px] leading-[1.6] text-[#3d362f] m-0 mt-4 max-w-[640px]">
                  <Sig
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
            <div className="max-w-[1340px] mx-auto">
              <SignatureCases
                cases={casesArr}
                galleryPhotos={galleryFallbacks}
                casesNeverSet={casesNeverSet}
                editMode={editMode}
              />
            </div>
          </section>
        );
      })()}

      {/* SERVICES — "book of" numbered §I-V row layout. In editMode swap the
          read-only rows for the shared InlineServicesEditor (same component
          other templates use) so trainer can add/edit/remove services. The
          underlying DB is shared so edits propagate to every template. */}
      {(editMode || services.length > 0) && (
        <section id="book" data-section-id="services" className="px-6 sm:px-10 py-20 sm:py-[120px]">
          {editMode && (
            <div className="max-w-[1340px] mx-auto">
              <SectionAIServicesButton
                currentServicesCount={services.length}
                template="signature"
                pillClassName={AI_PILL_THEMES.signature}
              />
            </div>
          )}
          <div className="max-w-[1340px] mx-auto mb-14 grid @[1024px]:grid-cols-2 gap-10 @[1024px]:gap-16 items-end">
            <div>
              <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.2em] uppercase mb-4">
                <Sig k="servicesLabel" fb="§ 02 · Usługi" maxLength={40} rich={false} />
              </div>
              <h2
                style={{ fontSize: "clamp(40px, 6cqw, 72px)", lineHeight: 0.95, letterSpacing: "-0.035em" }}
                className="font-normal m-0"
              >
                <Sig k="servicesH2" fb="Sposoby<br>współpracy<em>.</em>" maxLength={120} />
              </h2>
            </div>
            <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#3d362f] m-0 max-w-[480px]">
              <Sig
                k="servicesSubcopy"
                fb="Każdy nowy klient zaczyna od konsultacji. Tam decydujemy wspólnie, co ma sens — pojedynczy trening, program czy członkostwo."
                multiline
                block
                maxLength={400}
              />
            </p>
          </div>
          <div className="max-w-[1340px] mx-auto">
            {editMode ? (
              <SignatureServicesEditor
                // Pass the RAW master list (un-filtered) so the editor can
                // surface hidden items + let the trainer un-hide them. Display
                // values are still override-applied inside the editor for
                // visual fidelity with the read-only rendering.
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
              services.map((svc, i) => {
                const inner = (
                  <>
                    <div className="font-mono text-[12px] @[640px]:text-[13px] text-[#7d1f1f] tracking-[0.08em] font-medium pt-1 @[640px]:pt-0">
                      § {roman(i + 1)}
                    </div>
                    <div>
                      <div className="text-[18px] @[640px]:text-[22px] @[1024px]:text-[26px] tracking-[-0.02em] font-normal leading-[1.15]">
                        {svc.name}
                      </div>
                      <div className="@[640px]:hidden text-[13px] text-[#7d7268] mt-2 leading-[1.5]">{svc.description}</div>
                      <div className="@[640px]:hidden font-mono text-[11px] text-[#7d7268] tracking-[0.08em] uppercase mt-2">
                        {svc.duration} min · od {svc.price} zł
                      </div>
                    </div>
                    <div className="hidden @[640px]:block text-[14px] text-[#7d7268] leading-[1.5]">{svc.description}</div>
                    <div className="hidden @[640px]:block font-mono text-[11px] text-[#7d7268] tracking-[0.08em] uppercase">
                      {svc.duration} min · studio
                    </div>
                    <div className="hidden @[640px]:block text-right text-[20px] @[1024px]:text-[22px] tracking-[-0.015em] font-medium">
                      {svc.price} zł
                    </div>
                  </>
                );
                const cls =
                  "grid grid-cols-[40px_1fr] @[640px]:grid-cols-[60px_1fr_1fr_140px_120px] @[1024px]:grid-cols-[80px_1fr_1fr_200px_160px] gap-4 @[640px]:gap-6 @[1024px]:gap-8 items-start @[640px]:items-center py-6 @[640px]:py-8 border-t border-[#e4dccf] last:border-b last:border-[#e4dccf] hover:pl-4 transition-all";
                if (svc.id) {
                  return (
                    <Link
                      key={svc.id}
                      href={`/trainers/${trainer.id}/book?service=${svc.id}`}
                      className={`${cls} no-underline text-inherit hover:text-[#7d1f1f] cursor-pointer`}
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div key={i} className={cls}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* MEMBERSHIP TIERS — 3 dark cards on dark bg, gold accents. In editMode
          (when no real DB-backed membership_tiers yet, falling back to packages)
          swap to InlinePackagesEditor so the trainer can edit underlying data.
          Once real membership_tiers exist this becomes a Phase 3 dedicated tier
          editor with the gold-on-dark visual. */}
      {(editMode || tiers.length > 0) && (
        <section id="membership" data-section-id="packages" className="bg-[#1a1613] text-[#ede4d6] px-6 sm:px-10 py-20 sm:py-[120px]">
          {editMode && (
            <div className="max-w-[1340px] mx-auto">
              <SectionAIPackagesButton
                currentPackagesCount={tiers.length}
                template="signature"
                pillClassName={AI_PILL_THEMES.signature}
              />
            </div>
          )}
          <div className="max-w-[1340px] mx-auto mb-14 text-center">
            <div className="font-mono text-[11px] text-[#a68b5b] tracking-[0.25em] uppercase mb-5">
              <Sig k="membershipLabel" fb="§ 03 · Członkostwo" maxLength={40} rich={false} />
            </div>
            <h2
              style={{ fontSize: "clamp(44px, 7cqw, 80px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}
              className="font-normal m-0 mb-4 text-[#ede4d6]"
            >
              <Sig k="membershipH2" fb={`Nie pakiety.<br><em>Członkostwo.</em>`} maxLength={120} />
            </h2>
            <p className="text-[15px] @[640px]:text-[17px] leading-[1.55] text-[#ede4d6]/65 m-0 mx-auto max-w-[560px]">
              <Sig
                k="membershipSubcopy"
                fb="Przyjmuję ograniczoną liczbę klientów. Członkostwo to nie abonament — to zobowiązanie po obu stronach."
                multiline
                block
                maxLength={300}
              />
            </p>
          </div>

          {editMode ? (
            <SignaturePackagesEditor
              // RAW master packages so the editor can surface hidden cards
              // and let the trainer un-hide them.
              packages={trainer.packages}
              tierLabels={[tierLabelAt(0), tierLabelAt(1), tierLabelAt(2)]}
              overrides={trainer.customization.packageOverrides ?? {}}
            />
          ) : (
          <div className="max-w-[1340px] mx-auto grid @[1024px]:grid-cols-3 gap-5">
            {tiers.map((p) => {
              const featured = p.featured;
              return (
                <div
                  key={p.id}
                  className={`relative rounded-sm p-8 @[640px]:p-10 flex flex-col min-h-[520px] @[640px]:min-h-[580px] border ${featured ? "bg-gradient-to-b from-[#a68b5b]/[0.12] to-transparent border-[#a68b5b]" : "border-[#ede4d6]/15"}`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-8 bg-[#a68b5b] text-[#1a1613] font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-3.5 py-1.5 rounded-full">
                      Najczęściej wybierane
                    </span>
                  )}
                  <div className="font-mono text-[11px] text-[#a68b5b] tracking-[0.25em] uppercase mb-3.5">
                    {p.tierLabel}
                  </div>
                  <div className="text-[26px] @[640px]:text-[32px] leading-[1.1] tracking-[-0.02em] font-normal mb-5">
                    {p.name}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-4 pb-7 border-b border-[#ede4d6]/15">
                    <span className="text-[40px] @[640px]:text-[52px] tracking-[-0.03em] text-[#ede4d6] leading-none">
                      {p.price.toLocaleString("pl-PL")} zł
                    </span>
                    {p.period && <span className="text-[13px] text-[#ede4d6]/50 font-mono">/ {p.period}</span>}
                  </div>
                  {p.description && (
                    <p className="text-[14px] leading-[1.55] text-[#ede4d6]/70 m-0 mb-7">{p.description}</p>
                  )}
                  <ul className="list-none p-0 m-0 mb-8 grid gap-3">
                    {p.items.map((it, ii) => (
                      <li key={ii} className="flex gap-3 text-[13px] text-[#ede4d6]/85 leading-[1.5]">
                        <span className="w-3.5 h-3.5 border border-[#a68b5b] rounded-full text-[#a68b5b] inline-flex items-center justify-center shrink-0 mt-0.5 text-[8px]">
                          ✓
                        </span>
                        {it}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/trainers/${trainer.id}/book`}
                    className={`mt-auto inline-flex justify-center items-center h-12 rounded-full text-[13px] font-medium transition border ${featured ? "bg-[#a68b5b] text-[#1a1613] border-[#a68b5b] hover:bg-[#ede4d6] hover:border-[#ede4d6]" : "border-[#ede4d6]/25 text-[#ede4d6] hover:bg-[#ede4d6] hover:text-[#1a1613] hover:border-[#ede4d6]"}`}
                  >
                    {p.ctaText?.trim() || `Dołącz do ${p.tierLabel} →`}
                  </Link>
                </div>
              );
            })}
          </div>
          )}
        </section>
      )}

      {/* CERTIFICATIONS — small editorial strip; always rendered, empty-state below */}
      <section id="certifications" data-section-id="certifications" className="bg-white border-y border-[#e4dccf] px-6 sm:px-10 py-16 sm:py-20 scroll-mt-20">
        <div className="max-w-[1340px] mx-auto">
          <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.2em] uppercase mb-4 text-center">
            <Sig k="certificationsLabel" fb="§ 04 · Wykształcenie" maxLength={40} rich={false} />
          </div>
          <h2
            style={{ fontSize: "clamp(32px, 4.5cqw, 48px)", lineHeight: 1, letterSpacing: "-0.03em" }}
            className="font-normal m-0 mb-10 text-center"
          >
            <Sig k="certificationsH2" fb="Czarno na <em>białym.</em>" maxLength={80} />
          </h2>
          {trainer.certifications.length === 0 ? (
            <div className="border border-[#e4dccf] rounded-sm py-10 text-center max-w-[640px] mx-auto">
              <div className="text-[18px] sm:text-[20px] font-normal text-[#3d362f]">Wykształcenie nieuzupełnione</div>
              <div className="text-[12px] sm:text-[13px] text-[#7d7268] mt-2 max-w-[420px] mx-auto leading-[1.55]">
                Trener nie udostępnił jeszcze potwierdzonych certyfikatów ani dyplomów.
              </div>
            </div>
          ) : (
            <div className="grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-3">
              {trainer.certifications.map((cert, i) => {
                const detail = trainer.certificationDetails?.[i];
                return (
                  <div
                    key={detail?.id ?? i}
                    className="border border-[#e4dccf] rounded-sm p-5 flex flex-col gap-3"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="font-mono text-[11px] text-[#7d1f1f] tracking-[0.15em] uppercase shrink-0 mt-0.5">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="text-[16px] sm:text-[17px] leading-[1.5] text-[#3d362f] tracking-[-0.005em]">{cert}</div>
                    </div>
                    {(detail?.verificationUrl || detail?.attachmentUrl) && (
                      <div className="flex gap-2 flex-wrap pt-2 border-t border-[#e4dccf] ml-9">
                        {detail.verificationUrl && (
                          <a
                            href={detail.verificationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#7d1f1f] hover:text-[#5e1515] font-mono uppercase tracking-[0.1em] border border-[#7d1f1f]/30 hover:border-[#7d1f1f]/60 rounded-full px-2.5 py-1 transition"
                          >
                            ↗ Sprawdź
                          </a>
                        )}
                        {detail.attachmentUrl && (
                          <a
                            href={detail.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#7d7268] hover:text-[#1a1613] font-mono uppercase tracking-[0.1em] border border-[#cfc3b0] hover:border-[#1a1613]/30 rounded-full px-2.5 py-1 transition"
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
          )}
        </div>
      </section>

      {/* PRESS FEATURE — three quote cards. Hidden entirely when the trainer
          has no real press_mentions: the fallback Polish-mag content is too
          attention-grabbing for an empty state and was reading as "this
          section appeared out of nowhere" in the editor preview. Trainers
          add real press via /studio/profile (press_mentions table). */}
      {realPress.length > 0 && (
      <section id="press" className="bg-white border-y border-[#e4dccf] px-6 sm:px-10 py-20 sm:py-24">
        <div className="max-w-[1340px] mx-auto mb-14 text-center">
          <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.2em] uppercase mb-4">
            <Sig k="pressLabel" fb="§ 05 · Prasa" maxLength={40} rich={false} />
          </div>
          <h2
            style={{ fontSize: "clamp(36px, 5cqw, 56px)", lineHeight: 1, letterSpacing: "-0.03em" }}
            className="font-normal m-0"
          >
            <Sig k="pressH2" fb="Co o mnie <em>pisano.</em>" maxLength={100} />
          </h2>
        </div>
        <div className="max-w-[1340px] mx-auto grid @[1024px]:grid-cols-3 gap-5">
          {pressFeatures.map((p, i) => (
            <div key={i} className="border border-[#e4dccf] rounded-sm p-6 sm:p-7 flex flex-col gap-4">
              <div
                className={
                  p.bold
                    ? "font-semibold tracking-[0.08em] uppercase text-[14px] text-[#7d7268]"
                    : "font-serif italic text-[18px] text-[#7d7268] tracking-[-0.005em]"
                }
              >
                {p.pub}
              </div>
              <div className="text-[15px] @[640px]:text-[17px] leading-[1.45] tracking-[-0.005em] text-[#1a1613]">
                {p.quote}
              </div>
              <div className="mt-auto pt-4 border-t border-[#e4dccf] font-mono text-[11px] text-[#7d7268] tracking-[0.05em]">
                {p.meta}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* GALLERY — asymmetric bento. Per-page galleryHidden filters out
          photos the trainer soft-deleted on this page; undo can bring them
          back via the customization-snapshot pipeline. */}
      {(editMode || trainer.gallery.length > 0) && (
        <section data-section-id="gallery" className="px-6 sm:px-10 py-20 sm:py-[120px]">
          <div className="max-w-[1340px] mx-auto mb-10 flex justify-between items-end gap-4 flex-wrap">
            <div>
              <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.2em] uppercase mb-3.5">
                <Sig k="galleryLabel" fb="§ 06 · Studio" maxLength={40} rich={false} />
              </div>
              <h2
                style={{ fontSize: "clamp(40px, 6cqw, 72px)", lineHeight: 0.95, letterSpacing: "-0.03em" }}
                className="font-normal m-0"
              >
                <Sig
                  k="galleryH2"
                  fb={`${trainer.location.split(",").slice(-1)[0]?.trim() || "Studio"}<em>.</em>`}
                  maxLength={100}
                />
              </h2>
            </div>
          </div>
          {(() => {
            const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
            const visibleGallery = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
            return editMode ? (
              <SignatureGalleryEditor
                items={visibleGallery}
                focalMap={trainer.customization.galleryFocal}
              />
            ) : (
              <SignatureGalleryView
                items={visibleGallery}
                focalMap={trainer.customization.galleryFocal}
              />
            );
          })()}
        </section>
      )}

      {/* REVIEWS — editorial quote grid in Signature chrome. Cards on white
          with cream border, serif italic body, mono author meta, burgundy
          accent on stars + reply eyebrow. Trainer reply (if set) renders
          beneath each review with a "Odpowiedź" gold-tinted block. */}
      {(editMode || trainer.reviews.length > 0) && (
        <section data-section-id="reviews" className="bg-white border-y border-[#e4dccf] px-6 sm:px-10 py-20 sm:py-[120px]">
          <div className="max-w-[1340px] mx-auto">
            <div className="mb-12 grid @[1024px]:grid-cols-[1fr_2fr] gap-8 @[1024px]:gap-16 items-end">
              <div>
                <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.25em] uppercase mb-4">
                  <Sig k="reviewsLabel" fb="§ 06 · Opinie klientów" maxLength={40} rich={false} />
                </div>
                <h2
                  style={{ fontSize: "clamp(36px, 5cqw, 56px)", lineHeight: 0.95, letterSpacing: "-0.03em" }}
                  className="font-normal m-0"
                >
                  <Sig k="reviewsH2" fb="Co mówią <em>klienci.</em>" maxLength={120} />
                </h2>
              </div>
              <div className="flex items-end gap-6 flex-wrap">
                <div>
                  <div
                    className="font-normal text-[#1a1613] leading-none"
                    style={{ fontSize: "clamp(56px, 7cqw, 88px)", letterSpacing: "-0.03em" }}
                  >
                    {trainer.rating > 0 ? trainer.rating.toString().replace(".", ",") : "—"}
                    <em className="not-italic text-[#7d1f1f] ml-1">★</em>
                  </div>
                  <div className="font-mono text-[10px] text-[#7d7268] tracking-[0.22em] uppercase mt-2">
                    {trainer.reviewCount} {trainer.reviewCount === 1 ? "opinia" : "opinii"}
                  </div>
                </div>
                {trainer.reviews.length > 0 && (
                  <p className="text-[14px] sm:text-[15px] leading-[1.6] text-[#3d362f] m-0 max-w-[520px]">
                    <Sig
                      k="reviewsSub"
                      fb="Wybór opinii klientów. Pełna lista — w sekcji publicznej."
                      multiline
                      block
                      maxLength={250}
                      rich={false}
                    />
                  </p>
                )}
              </div>
            </div>

            {trainer.reviews.length === 0 ? (
              <div className="border border-dashed border-[#cfc3b0] rounded-sm p-12 text-center font-serif italic text-[#7d7268]">
                Pierwsza opinia pojawi się tu po zakończonej sesji z klientem.
              </div>
            ) : (
              <SignatureReviewsList reviews={trainer.reviews} />
            )}
          </div>
        </section>
      )}

      {/* CONCIERGE CTA — split: copy + contact card */}
      <section id="contact" className="bg-gradient-to-br from-[#ede4d6] to-[#f6f1ea] px-6 sm:px-10 py-24 sm:py-[140px]">
        <div className="max-w-[1100px] mx-auto grid @[1024px]:grid-cols-2 gap-12 @[1024px]:gap-[72px] items-center">
          <div>
            <div className="font-mono text-[11px] text-[#7d1f1f] tracking-[0.25em] uppercase mb-5">
              <Sig k="contactLabel" fb="§ 07 · Kontakt" maxLength={40} rich={false} />
            </div>
            <h2
              style={{ fontSize: "clamp(44px, 7cqw, 80px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}
              className="font-normal m-0 mb-5"
            >
              <Sig k="contactH2" fb="Bezpośrednio<br>do <em>mnie.</em>" maxLength={100} />
            </h2>
            <p className="text-[15px] @[640px]:text-[17px] leading-[1.6] text-[#3d362f] m-0 mb-7 max-w-[440px]">
              <Sig
                k="contactSubcopy"
                fb="Bez asystentki, bez automatów. Napisz, zadzwoń albo umów konsultację — odpowiadam osobiście w ciągu jednego dnia roboczego."
                multiline
                block
                maxLength={400}
              />
            </p>
            <div className="flex gap-2.5 flex-wrap">
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="inline-flex items-center justify-center px-7 rounded-full bg-[#7d1f1f] text-white border border-[#7d1f1f] hover:bg-[#5e1515] hover:border-[#5e1515] transition font-medium text-[14px]"
                style={{ height: 52 }}
              >
                Umów konsultację →
              </Link>
              <a
                href={`/trainers/${trainer.id}/messages`}
                className="inline-flex items-center justify-center px-7 rounded-full bg-transparent text-[#3d362f] border border-[#cfc3b0] hover:bg-[#1a1613] hover:text-white hover:border-[#1a1613] transition font-medium text-[14px]"
                style={{ height: 52 }}
              >
                Napisz
              </a>
            </div>
          </div>
          <div className="bg-white border border-[#e4dccf] rounded-sm p-8 sm:p-9 shadow-[0_30px_60px_-30px_rgba(26,22,19,0.25)]">
            <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.15em] uppercase mb-2">TELEFON</div>
            <div className="text-[18px] @[640px]:text-[24px] font-medium tracking-[-0.015em] mb-6 pb-5 border-b border-[#e4dccf]">
              <Sig k="contactPhone" fb="+48 600 000 000" maxLength={30} rich={false} />
            </div>
            <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.15em] uppercase mb-2">E-MAIL</div>
            <div className="text-[18px] @[640px]:text-[24px] font-medium tracking-[-0.015em] mb-6 pb-5 border-b border-[#e4dccf] text-[#7d1f1f] underline decoration-[#cfc3b0] underline-offset-4 break-all">
              <Sig k="contactEmail" fb={`${trainer.id}@${domain}`} maxLength={80} rich={false} />
            </div>
            <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.15em] uppercase mb-2">STUDIO</div>
            <div className="text-[18px] @[640px]:text-[24px] font-medium tracking-[-0.015em]">
              <Sig k="contactStudio" fb={trainer.location} maxLength={120} multiline block rich={false} />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER — dark, 4-col, with monogram + powered-by */}
      {!isEmbed && (
        <footer className="bg-[#1a1613] text-[#ede4d6] px-6 sm:px-10 pt-14 pb-10 grid grid-cols-1 @[640px]:grid-cols-2 @[1024px]:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 sm:gap-12">
          <div>
            <div className="text-[20px] sm:text-[24px] tracking-[0.3em] mb-2">{m}</div>
            <div className="font-mono text-[10px] text-[#ede4d6]/50 tracking-[0.2em] uppercase mb-6">
              Personal Training Studio · {trainer.location.split(",")[0]}
            </div>
            <div className="font-mono text-[12px] text-[#a68b5b]">{domain}</div>
          </div>
          <FooterCol
            heading="Usługi"
            items={services.slice(0, 4).map((s) =>
              s.id
                ? { label: s.name, href: `/trainers/${trainer.id}/book?service=${s.id}` }
                : s.name,
            )}
            fallback={["Konsultacja", "Trening 1:1", "Program", "Retraity"]}
          />
          <FooterCol
            heading="Członkostwo"
            items={tiers.map((p) =>
              p.id
                ? { label: p.name, href: `/trainers/${trainer.id}/checkout/${p.id}` }
                : p.name,
            )}
            fallback={["Bronze", "Silver", "Gold"]}
          />
          <FooterCol
            heading="Kontakt"
            items={["+48 600 000 000", `${trainer.id}@${domain}`, `Studio · ${trainer.location.split(",")[0]}`]}
          />
          <div className="@[640px]:col-span-2 @[1024px]:col-span-4 pt-9 mt-6 border-t border-[#ede4d6]/12 flex justify-between gap-4 flex-wrap font-mono text-[10px] text-[#ede4d6]/45 tracking-[0.12em] uppercase">
            <span>© {new Date().getFullYear()} {trainer.name} · All rights reserved</span>
            <span className="text-[#ede4d6]/30">
              Hosted on <span className="text-[#a68b5b]">Zdorovite Signature</span>
            </span>
          </div>
        </footer>
      )}

      {/* Specializations strip — small chips at the very bottom for SEO/scan */}
      {(effectiveSpecs.length > 0 || editMode) && !isEmbed && (
        <div className="bg-[#0d0a09] text-[#ede4d6]/40 px-6 sm:px-10 py-4 flex gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.12em] justify-center items-center">
          {editMode ? (
            <EditableSpecializations
              current={effectiveSpecs}
              globalSpecs={trainer.specializations}
              chipClassName=""
              addBtnClassName="border-[#ede4d6]/30 text-[#ede4d6]/60 hover:border-[#ede4d6]/60 hover:text-[#ede4d6]"
            />
          ) : (
            effectiveSpecs.map((sp) => <span key={sp}>{getSpecLabel(sp)}</span>)
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ k, v, gold = false }: { k: string; v: string; gold?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#7d7268] mb-1.5">{k}</div>
      <div className={`text-[14px] @[640px]:text-[16px] font-medium tracking-[-0.01em] ${gold ? "text-[#7d1f1f]" : ""}`}>
        {v}
      </div>
    </div>
  );
}

function ContactRow({ k, v, email = false, last = false }: { k: string; v: string; email?: boolean; last?: boolean }) {
  return (
    <>
      <div className="font-mono text-[11px] text-[#7d7268] tracking-[0.15em] uppercase mb-2">{k}</div>
      <div
        className={`text-[18px] @[640px]:text-[24px] font-medium tracking-[-0.015em] mb-6 pb-5 ${last ? "" : "border-b border-[#e4dccf]"} ${email ? "text-[#7d1f1f] underline decoration-[#cfc3b0] underline-offset-4 break-all" : ""}`}
      >
        {v}
      </div>
    </>
  );
}

type FooterItem = string | { label: string; href: string };

function FooterCol({
  heading,
  items,
  fallback,
}: {
  heading: string;
  items: FooterItem[];
  fallback?: FooterItem[];
}) {
  const list = items.length > 0 ? items : fallback ?? [];
  if (list.length === 0) return null;
  return (
    <div>
      <h5 className="font-mono text-[10px] text-[#ede4d6]/50 tracking-[0.2em] uppercase m-0 mb-3.5">{heading}</h5>
      <ul className="list-none p-0 m-0 grid gap-2.5">
        {list.map((it, i) => {
          if (typeof it === "string") {
            return (
              <li key={i} className="text-[14px] text-[#ede4d6]/85 hover:text-[#a68b5b] transition cursor-default break-words">
                {it}
              </li>
            );
          }
          return (
            <li key={i} className="text-[14px] break-words">
              <Link
                href={it.href}
                className="text-[#ede4d6]/85 hover:text-[#a68b5b] transition"
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
