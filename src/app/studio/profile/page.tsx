import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificationsEditor from "./CertificationsEditor";
import AvatarTile from "./AvatarTile";
import AiContextForm from "./AiContextForm";
import type { AiContext } from "./ai-context-actions";
import QrSection from "./QrSection";
import BasicForm from "./BasicForm";
import AboutForm from "./AboutForm";
import SpecializationsForm from "./SpecializationsForm";
import LocationForm from "./LocationForm";
import SocialForm from "./SocialForm";
import PolicyTab from "./PolicyTab";
import ProfileEditorShell, { type EditorSection } from "./ProfileEditorShell";
import type { Certification } from "@/types";

/**
 * /studio/profile — OLX-style unified editor (slice 1.1 of spec 9.3).
 *
 * Two panes: left — collapsible sections in PUBLIC-PROFILE order
 * (Zdjęcie+Imię+Tagline → Lokalizacja → Specjalizacje → O mnie →
 * Usługi → Pakiety → Galeria → Certyfikaty → Social → QR → AI →
 * Polityka), right — live scaled preview of /trainers/[slug]?embed=1.
 *
 * All data is fetched here once, server-side. Every form's server
 * action calls revalidatePath + router.refresh(), which re-renders
 * this component; `previewStamp` (hash of all preview-relevant data)
 * then changes and the preview iframe reloads — no per-form wiring.
 *
 * Usługi/Pakiety/Galeria are read-only summaries with links to their
 * current editors (/studio/uslugi, /studio/design) — inline editing
 * for them lands in slices 1.3/1.4. /studio/design stays available as
 * the "Zaawansowany edytor wyglądu" (template, colors, section order).
 *
 * Tolerant of unapplied migrations:
 *   - 014 (cert URL/file) — falls back to legacy text-only certs
 *   - 019 (ai_context) — page still loads without AI block
 *   - 020 (avatar_focal) — avatar tile renders without focal pan
 *   - 021 (gym_chains) — QR section drops to "Ogólny" mode only
 *   - 026 (mission/city/district/work_mode/radius/social/goals) —
 *     forms render with empty defaults; saves silently no-op
 *     for missing columns until the migration is applied.
 */
export default async function StudioProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/profile");

  // --- Profile (avatar, name, phone) ----------------------------------
  type ProfileShape = {
    display_name: string | null;
    avatar_url: string | null;
    avatar_focal?: string | null;
    phone?: string | null;
  };
  let profile: ProfileShape | null = null;
  const profileFull = await supabase
    .from("profiles")
    .select("display_name, avatar_url, avatar_focal, phone")
    .eq("id", user.id)
    .single();
  if (profileFull.error?.code === "42703") {
    // Try the older shape (pre-026 phone, pre-020 focal).
    const stripped = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    profile = stripped.data ? { ...stripped.data, avatar_focal: null, phone: null } : null;
  } else {
    profile = profileFull.data as ProfileShape;
  }

  // --- Trainer (full row including 026 + 027 fields) ------------------
  type TrainerShape = {
    slug: string;
    tagline: string | null;
    about: string | null;
    location: string | null;
    published: boolean | null;
    experience: number | null;
    rating: number | null;
    review_count: number | null;
    display_name?: string | null;
    mission?: string | null;
    city?: string | null;
    district?: string | null;
    work_mode?: "stationary" | "online" | "both" | null;
    travel_radius_km?: number | null;
    client_goals?: string[] | null;
    social?: Record<string, string> | null;
    ai_context?: Record<string, unknown> | null;
  };
  let trainer: TrainerShape | null = null;
  const trainerFull = await supabase
    .from("trainers")
    .select(
      "slug, tagline, about, location, published, experience, rating, review_count, display_name, mission, city, district, work_mode, travel_radius_km, client_goals, social, ai_context",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (trainerFull.error?.code === "42703") {
    const stripped = await supabase
      .from("trainers")
      .select("slug, tagline, about, location, published, experience, rating, review_count")
      .eq("id", user.id)
      .maybeSingle();
    trainer = stripped.data
      ? {
          ...stripped.data,
          display_name: null,
          mission: null,
          city: null,
          district: null,
          work_mode: null,
          travel_radius_km: null,
          client_goals: null,
          social: null,
          ai_context: null,
        }
      : null;
  } else {
    trainer = trainerFull.data as TrainerShape;
  }

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

  // --- Specializations (M:N), certs, offer + gallery ------------------
  const [{ data: allSpecs }, { data: trainerSpecs }, certsRes, servicesRes, packagesRes, galleryRes] =
    await Promise.all([
      supabase.from("specializations").select("id, label, icon").order("id"),
      supabase.from("trainer_specializations").select("specialization_id").eq("trainer_id", user.id),
      supabase
        .from("certifications")
        .select(
          "id, text, verification_url, attachment_url, attachment_filename, verification_status, reject_reason, position",
        )
        .eq("trainer_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, duration, price, position")
        .eq("trainer_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("packages")
        .select("id, name, price, period, sessions_total, featured, position")
        .eq("trainer_id", user.id)
        .order("position", { ascending: true }),
      supabase
        .from("gallery_photos")
        .select("id, url, position")
        .eq("trainer_id", user.id)
        .order("position", { ascending: true }),
    ]);

  // Certs — same fallback pattern as before for unapplied 014.
  let certs: Certification[] = [];
  if (certsRes.error?.code === "42703") {
    // 028 (verification_status / reject_reason) not applied — retry with
    // 014's columns. If 014 is also missing the next fallback hits.
    const cert014 = await supabase
      .from("certifications")
      .select("id, text, verification_url, attachment_url, attachment_filename, position")
      .eq("trainer_id", user.id)
      .order("position", { ascending: true });
    if (cert014.error?.code === "42703") {
      const certsLegacy = await supabase
        .from("certifications")
        .select("id, text, position")
        .eq("trainer_id", user.id)
        .order("position", { ascending: true });
      certs = (certsLegacy.data ?? []).map((c: { id: string; text: string }) => ({
        id: c.id,
        text: c.text,
      }));
    } else if (cert014.data) {
      certs = cert014.data.map(
        (c: {
          id: string;
          text: string;
          verification_url: string | null;
          attachment_url: string | null;
          attachment_filename: string | null;
        }) => ({
          id: c.id,
          text: c.text,
          verificationUrl: c.verification_url ?? undefined,
          attachmentUrl: c.attachment_url ?? undefined,
          attachmentFilename: c.attachment_filename ?? undefined,
        }),
      );
    }
  } else if (certsRes.data) {
    certs = certsRes.data.map(
      (c: {
        id: string;
        text: string;
        verification_url: string | null;
        attachment_url: string | null;
        attachment_filename: string | null;
        verification_status: "unverified" | "pending" | "verified" | "rejected" | null;
        reject_reason: string | null;
      }) => ({
        id: c.id,
        text: c.text,
        verificationUrl: c.verification_url ?? undefined,
        attachmentUrl: c.attachment_url ?? undefined,
        attachmentFilename: c.attachment_filename ?? undefined,
        verificationStatus: c.verification_status ?? undefined,
        rejectReason: c.reject_reason ?? undefined,
      }),
    );
  }

  type ServiceRow = { id: string; name: string; duration: number; price: number };
  type PackageRow = {
    id: string;
    name: string;
    price: number;
    period: string | null;
    sessions_total: number | null;
    featured: boolean;
  };
  const services = (servicesRes.data ?? []) as ServiceRow[];
  const packages = (packagesRes.data ?? []) as PackageRow[];
  // Upload flow inserts a row with url:"" first — hide those until done.
  const galleryPhotos = ((galleryRes.data ?? []) as { id: string; url: string }[]).filter(
    (p) => !!p.url,
  );

  const selectedSpecIds = (trainerSpecs ?? []).map((s) => s.specialization_id);

  // --- QR section data (host + branches) ------------------------------
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  type BranchOption = {
    id: string;
    chainSlug: string;
    branchSlug: string;
    chainName: string;
    branchName: string;
    status: "self_claimed" | "verified" | "rejected";
  };
  let branches: BranchOption[] = [];
  const aff = await supabase
    .from("trainer_branches")
    .select(
      `
      status,
      branch:gym_branches!branch_id (
        id, slug, name,
        chain:gym_chains!chain_id ( slug, name )
      )
      `,
    )
    .eq("trainer_id", user.id);
  if (!aff.error && aff.data) {
    branches = aff.data
      .map((r) => {
        const b = (r as unknown as {
          status: BranchOption["status"];
          branch: {
            id: string;
            slug: string;
            name: string;
            chain: { slug: string; name: string } | null;
          } | null;
        }).branch;
        const status = (r as unknown as { status: BranchOption["status"] }).status;
        if (!b || !b.chain) return null;
        return {
          id: b.id,
          chainSlug: b.chain.slug,
          chainName: b.chain.name,
          branchSlug: b.slug,
          branchName: b.name,
          status,
        };
      })
      .filter((x): x is BranchOption => x !== null)
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "verified" ? -1 : 1));
  }

  const social = (trainer.social ?? {}) as Record<string, string>;
  const socialCount = ["instagram", "youtube", "tiktok", "facebook", "website"].filter(
    (k) => !!social[k],
  ).length;

  const aiContext = (trainer.ai_context ?? {}) as AiContext;
  const aiContextFilled = (
    ["background", "targetAudience", "methodology", "differentiators", "tonePreference"] as const
  ).filter((k) => (aiContext[k] ?? "").trim().length > 0).length;

  // Completion checklist for the header card.
  const completion = computeCompletion({
    avatar: !!profile?.avatar_url,
    bio: !!(trainer.tagline ?? "").trim() || !!(trainer.about ?? "").trim(),
    specs: selectedSpecIds.length >= 3,
    location: !!(trainer.location ?? "").trim() || !!(trainer.city ?? "").trim(),
    pricing: services.length > 0,
    gallery: galleryPhotos.length,
    video: false, // tracked once trainers.video_url is on the row
    aiContext: aiContextFilled,
  });

  // Build the role/specialty subtitle the design shows under the name —
  // "Trener personalny · siłownia + funkcjonalny". Joins up to 2 of the
  // trainer's selected specialization labels.
  const specLabelMap = new Map((allSpecs ?? []).map((s) => [s.id, s.label.toLowerCase()]));
  const specLabels = selectedSpecIds
    .map((id) => specLabelMap.get(id))
    .filter((s): s is string => !!s)
    .slice(0, 2);
  const roleLine =
    specLabels.length > 0 ? `Trener personalny · ${specLabels.join(" + ")}` : "Trener personalny";

  // Fingerprint of everything the public profile can show — when any
  // save lands, router.refresh() re-runs this component, the stamp
  // changes and the preview iframe reloads. djb2 keeps the prop tiny.
  const previewStamp = hashStamp(
    JSON.stringify([
      trainer,
      profile,
      selectedSpecIds,
      certs,
      services,
      packages,
      galleryPhotos,
    ]),
  );

  // --- Left-column sections, in public-profile order ------------------
  const sections: EditorSection[] = [
    {
      id: "podstawowe",
      title: "Zdjęcie, imię i tagline",
      sub: "Najczęściej oglądana sekcja — pierwsze wrażenie w katalogu i na profilu.",
      defaultOpen: true,
      content: (
        <BasicForm
          avatarUrl={profile?.avatar_url ?? null}
          avatarFocal={profile?.avatar_focal ?? null}
          displayName={profile?.display_name ?? ""}
          publicName={trainer.display_name ?? ""}
          email={user.email ?? ""}
          tagline={trainer.tagline ?? ""}
          location={trainer.location ?? ""}
          roleLine={roleLine}
          experience={trainer.experience ?? 0}
          rating={trainer.rating ?? 0}
          reviewCount={trainer.review_count ?? 0}
          avatarSlot={
            <AvatarTile
              currentUrl={profile?.avatar_url ?? null}
              currentFocal={profile?.avatar_focal ?? null}
              size="lg"
            />
          }
        />
      ),
    },
    {
      id: "lokalizacja",
      title: "Lokalizacja",
      sub: "Gdzie prowadzisz treningi. Wpływa na sortowanie po odległości w katalogu.",
      content: (
        <LocationForm
          location={trainer.location ?? ""}
          city={trainer.city ?? ""}
          district={trainer.district ?? ""}
          workMode={trainer.work_mode ?? "both"}
          travelRadiusKm={trainer.travel_radius_km ?? 15}
        />
      ),
    },
    {
      id: "specjalizacje",
      title: "Specjalizacje",
      sub: "Wpływa na to, w jakich filtrach katalogu się pojawisz. Wybierz 3–6.",
      badge: selectedSpecIds.length > 0 ? String(selectedSpecIds.length) : undefined,
      content: (
        <SpecializationsForm
          allSpecs={(allSpecs ?? []) as { id: string; label: string; icon: string }[]}
          selected={selectedSpecIds}
          clientGoals={trainer.client_goals ?? []}
          suggestionSeed={trainer.about ?? trainer.tagline ?? ""}
        />
      ),
    },
    {
      id: "o-mnie",
      title: "O mnie",
      sub: "Twoja historia i misja — sekcja „O mnie” na publicznym profilu.",
      content: <AboutForm about={trainer.about ?? ""} mission={trainer.mission ?? ""} />,
    },
    {
      id: "uslugi",
      title: "Usługi i ceny",
      sub: "Pojedyncze sesje widoczne w cenniku i przy rezerwacji.",
      badge: services.length > 0 ? String(services.length) : undefined,
      content: (
        <OfferSummary
          rows={services.map((s) => ({
            id: s.id,
            name: s.name,
            meta: `${s.duration} min`,
            price: s.price,
          }))}
          emptyText="Nie masz jeszcze żadnej usługi — klienci nie mogą rezerwować sesji."
          editHref="/studio/uslugi"
          editLabel="Edytuj usługi i ceny"
        />
      ),
    },
    {
      id: "pakiety",
      title: "Pakiety",
      sub: "Zestawy sesji w niższej cenie — sekcja pakietów na profilu.",
      badge: packages.length > 0 ? String(packages.length) : undefined,
      content: (
        <OfferSummary
          rows={packages.map((p) => ({
            id: p.id,
            name: p.name + (p.featured ? " ★" : ""),
            meta: p.sessions_total
              ? `${p.sessions_total} sesji${p.period ? ` · ${p.period}` : ""}`
              : (p.period ?? ""),
            price: p.price,
          }))}
          emptyText="Nie masz jeszcze pakietów. Pakiety zwiększają wartość rezerwacji."
          editHref="/studio/uslugi?mode=pakiety"
          editLabel="Edytuj pakiety"
        />
      ),
    },
    {
      id: "galeria",
      title: "Galeria",
      sub: "Zdjęcia ze studia i treningów pokazywane na profilu.",
      badge: galleryPhotos.length > 0 ? String(galleryPhotos.length) : undefined,
      content: <GallerySummary photos={galleryPhotos} />,
    },
    {
      id: "certyfikaty",
      title: "Certyfikaty",
      sub: "Przesłane PDF/JPG widoczne tylko po weryfikacji. Klienci widzą tylko nazwę i rok.",
      badge: certs.length > 0 ? String(certs.length) : undefined,
      content: <CertificationsEditor certs={certs} />,
    },
    {
      id: "social",
      title: "Social i kontakt",
      sub: "Pokazane jako ikonki na profilu. Email i telefon zobaczy klient dopiero po pierwszej rezerwacji.",
      badge: socialCount > 0 ? String(socialCount) : undefined,
      content: (
        <SocialForm
          instagram={social.instagram ?? ""}
          youtube={social.youtube ?? ""}
          tiktok={social.tiktok ?? ""}
          facebook={social.facebook ?? ""}
          website={social.website ?? ""}
          phone={profile?.phone ?? ""}
          email={social.email ?? user.email ?? ""}
        />
      ),
    },
    {
      id: "qr",
      title: "QR i udostępnianie",
      sub: "Wydrukuj kod QR na ulotkę, wizytówkę lub plakat w klubie. Każdy QR ma swoje źródło w analityce.",
      content: (
        <QrSection
          trainerSlug={trainer.slug}
          trainerName={profile?.display_name ?? ""}
          origin={origin}
          branches={branches}
        />
      ),
    },
    {
      id: "ai",
      title: "Kontekst AI",
      sub: "Materiał dla generatorów treści — im więcej wypełnisz, tym lepsze opisy.",
      badge: `${aiContextFilled}/5`,
      flush: true,
      content: <AiContextForm initial={aiContext} />,
    },
    {
      id: "polityka",
      title: "Polityka i prywatność",
      sub: "Widoczność profilu, adres URL, usunięcie konta.",
      flush: true,
      content: <PolicyTab slug={trainer.slug} />,
    },
  ];

  return (
    <ProfileEditorShell
      slug={trainer.slug}
      published={trainer.published ?? false}
      previewStamp={previewStamp}
      completionPct={completion.pct}
      completionItems={completion.items}
      sections={sections}
    />
  );
}

/** djb2 — tiny non-crypto fingerprint for the preview-reload stamp. */
function hashStamp(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function computeCompletion(flags: {
  avatar: boolean;
  bio: boolean;
  specs: boolean;
  location: boolean;
  pricing: boolean;
  /** Number of uploaded gallery photos. */
  gallery: number;
  video: boolean;
  /** Number of filled AI-context fields out of 5. Threshold of 3+
   *  marks the row as done — same "enough to be useful" bar that AI
   *  generators on /studio/design use as a signal that the trainer
   *  has given them real material to work with. */
  aiContext: number;
}): { pct: number; items: { label: string; done: boolean }[] } {
  const items = [
    { label: "Zdjęcie profilowe", done: flags.avatar },
    { label: "Bio i tagline", done: flags.bio },
    { label: "Specjalizacje (3+)", done: flags.specs },
    { label: "Lokalizacja", done: flags.location },
    { label: "Cennik i pakiety", done: flags.pricing },
    { label: `Galeria zdjęć (${flags.gallery}/8)`, done: flags.gallery > 0 },
    { label: "Wideo prezentujące", done: flags.video },
    {
      label: `Kontekst AI (${flags.aiContext}/5)`,
      done: flags.aiContext >= 3,
    },
  ];
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  return { pct, items };
}

/**
 * Read-only offer summary (slice 1.1) — real rows from services /
 * packages with a link to the editor that owns them today. Replaced
 * by inline editing in slice 1.4.
 */
function OfferSummary({
  rows,
  emptyText,
  editHref,
  editLabel,
}: {
  rows: { id: string; name: string; meta: string; price: number }[];
  emptyText: string;
  editHref: string;
  editLabel: string;
}) {
  return (
    <div>
      {rows.length === 0 ? (
        <div className="rounded-[12px] border-[1.5px] border-dashed border-slate-200 px-4 py-5 text-center">
          <p className="text-[13px] text-slate-500 m-0">{emptyText}</p>
        </div>
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-slate-900 truncate">{r.name}</div>
                {r.meta && <div className="text-[12px] text-slate-500 mt-0.5">{r.meta}</div>}
              </div>
              <div className="text-[13.5px] font-semibold text-slate-900 shrink-0">
                {r.price.toLocaleString("pl-PL")} zł
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={editHref}
        className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-[7px] transition"
      >
        {editLabel} →
      </Link>
    </div>
  );
}

/**
 * Read-only gallery preview (slice 1.1) — real photos from
 * gallery_photos; upload/reorder/delete lands here in slice 1.3
 * (today it lives in /studio/design and the template editors).
 */
function GallerySummary({ photos }: { photos: { id: string; url: string }[] }) {
  return (
    <div>
      {photos.length === 0 ? (
        <div className="rounded-[12px] border-[1.5px] border-dashed border-slate-200 px-4 py-5 text-center">
          <p className="text-[13px] text-slate-500 m-0">
            Brak zdjęć w galerii. Profile z galerią mają średnio 2.3× więcej rezerwacji.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {photos.slice(0, 8).map((p) => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
              <Image
                src={p.url}
                alt="Zdjęcie z galerii"
                fill
                sizes="130px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
      <Link
        href="/studio/design#gallery"
        className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-[7px] transition"
      >
        Edytuj galerię →
      </Link>
    </div>
  );
}
