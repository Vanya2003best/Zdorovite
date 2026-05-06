import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificationsEditor from "./CertificationsEditor";
import AvatarTile from "./AvatarTile";
import AiContextForm from "./AiContextForm";
import type { AiContext } from "./ai-context-actions";
import QrSection from "./QrSection";
import BasicForm from "./BasicForm";
import ProfileSectionNav from "./ProfileSectionNav";
import ProfileSideRail from "./ProfileSideRail";
import SpecializationsForm from "./SpecializationsForm";
import LocationForm from "./LocationForm";
import SocialForm from "./SocialForm";
import PolicyTab from "./PolicyTab";
import type { Certification } from "@/types";

/**
 * /studio/profile — design 28 implementation. The page is split into 6
 * tabs (Podstawowe / Specjalizacje / Certyfikaty / Lokalizacja / Social /
 * Polityka), with a sticky right rail that previews the public profile,
 * shows completion %, and a tip nudging gallery uploads.
 *
 * Architecturally this is the SOURCE OF TRUTH for trainer-data fields
 * (display_name, tagline, about, mission, location, social, etc.) —
 * /studio/design now focuses on visual choices (template, colors,
 * section order). The inline editors on /trainers/[slug] still write
 * to the same columns, so changes propagate either way.
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

  // --- Specializations (M:N) + lookup table ---------------------------
  const [{ data: allSpecs }, { data: trainerSpecs }, certsRes, galleryRes] = await Promise.all([
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
      .from("gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id),
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

  const galleryCount = galleryRes.count ?? 0;
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

  // Completion checklist for the right rail.
  const completion = computeCompletion({
    avatar: !!profile?.avatar_url,
    bio: !!(trainer.tagline ?? "").trim() || !!(trainer.about ?? "").trim(),
    specs: selectedSpecIds.length >= 3,
    location: !!(trainer.location ?? "").trim() || !!(trainer.city ?? "").trim(),
    pricing: false, // wired once a price_from / services count is queried
    gallery: galleryCount > 0,
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

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-8 py-5 sm:py-7">
      <ProfileSectionNav
        counts={{
          specializations: selectedSpecIds.length,
          certifications: certs.length,
          social: socialCount,
          aiContext: aiContextFilled,
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start mt-4">
        <div className="min-w-0 space-y-4">
          <div id="podstawowe">
            <BasicForm
              avatarUrl={profile?.avatar_url ?? null}
              avatarFocal={profile?.avatar_focal ?? null}
              displayName={profile?.display_name ?? ""}
              publicName={trainer.display_name ?? ""}
              email={user.email ?? ""}
              tagline={trainer.tagline ?? ""}
              about={trainer.about ?? ""}
              mission={trainer.mission ?? ""}
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
          </div>

          <div id="specjalizacje">
            <SpecializationsForm
              allSpecs={(allSpecs ?? []) as { id: string; label: string; icon: string }[]}
              selected={selectedSpecIds}
              clientGoals={trainer.client_goals ?? []}
              suggestionSeed={trainer.about ?? trainer.tagline ?? ""}
            />
          </div>

          <div id="certyfikaty">
            <Card>
              <CardHeader
                title="Certyfikaty i dokumenty"
                hint={`${certs.length} ${certs.length === 1 ? "certyfikat" : "certyfikatów"}`}
                sub="Przesłane PDF/JPG widoczne tylko po weryfikacji. Klienci widzą tylko nazwę i rok."
              />
              <p className="text-[12px] text-slate-500 mt-1 mb-4 leading-[1.55] max-w-[640px]">
                Dodaj swoje certyfikaty z linkiem do publicznego rejestru wystawcy (np. EREPS, AWF) lub załącz
                skan dyplomu. Na publicznej stronie obok każdego certyfikatu pojawi się badge weryfikacji,
                który klient może kliknąć.
              </p>
              <CertificationsEditor certs={certs} />
            </Card>
          </div>

          <div id="lokalizacja" className="space-y-4">
            <LocationForm
              location={trainer.location ?? ""}
              city={trainer.city ?? ""}
              district={trainer.district ?? ""}
              workMode={trainer.work_mode ?? "both"}
              travelRadiusKm={trainer.travel_radius_km ?? 15}
            />

            <Card>
              <CardHeader
                title="QR i udostępnianie"
                sub="Wydrukuj kod QR na ulotkę, wizytówkę lub plakat w klubie. Każdy QR ma swoje źródło, więc widzisz w analityce skąd przyszedł klient."
              />
              <div className="mt-3">
                <QrSection
                  trainerSlug={trainer.slug}
                  trainerName={profile?.display_name ?? ""}
                  origin={origin}
                  branches={branches}
                />
              </div>
            </Card>
          </div>

          <div id="social">
            <SocialForm
              instagram={social.instagram ?? ""}
              youtube={social.youtube ?? ""}
              tiktok={social.tiktok ?? ""}
              facebook={social.facebook ?? ""}
              website={social.website ?? ""}
              phone={profile?.phone ?? ""}
              email={social.email ?? user.email ?? ""}
            />
          </div>

          <div id="ai">
            <AiContextForm initial={aiContext} />
          </div>

          <div id="polityka">
            <PolicyTab slug={trainer.slug} />
          </div>
        </div>

        {/* Right rail — completion + tip (no public-preview photo card) */}
        <ProfileSideRail completionPct={completion.pct} completionItems={completion.items} />
      </div>
    </div>
  );
}

function computeCompletion(flags: {
  avatar: boolean;
  bio: boolean;
  specs: boolean;
  location: boolean;
  pricing: boolean;
  gallery: boolean;
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
    { label: "Galeria zdjęć (0/8)", done: flags.gallery },
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      {children}
    </section>
  );
}

function CardHeader({ title, hint, sub }: { title: string; hint?: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-[-0.005em] text-slate-900 m-0">{title}</h3>
        {sub && <p className="text-[12px] text-slate-500 mt-1 max-w-[640px] leading-[1.55]">{sub}</p>}
      </div>
      {hint && <span className="text-[12px] text-slate-500 shrink-0">{hint}</span>}
    </div>
  );
}
