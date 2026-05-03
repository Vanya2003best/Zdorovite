import { createClient } from "@/lib/supabase/server";
import type {
  Trainer,
  ProfileCustomization,
  Specialization,
} from "@/types";
import { normalizeTemplate } from "@/data/templates";

// ---- DB row shape returned by the joined query ----
type TrainerRow = {
  id: string;
  slug: string;
  tagline: string;
  about: string;
  experience: number;
  price_from: number;
  location: string;
  languages: string[];
  cover_image: string | null;
  rating: number | string; // numeric comes back as string sometimes
  review_count: number;
  customization: ProfileCustomization;
  profile: { display_name: string; avatar_url: string | null } | null;
  trainer_specializations: { specialization_id: string }[];
  services: {
    id: string;
    name: string;
    description: string;
    duration: number;
    price: number;
    position: number;
    is_placeholder?: boolean;
  }[];
  packages: {
    id: string;
    name: string;
    description: string;
    items: string[];
    price: number;
    period: string | null;
    featured: boolean;
    position: number;
    is_placeholder?: boolean;
  }[];
  certifications: {
    id: string;
    text: string;
    position: number;
    /** Populated by a separate post-fetch when migration 014 is applied. Null
     *  when the columns don't exist yet so the rest of the trainer query still
     *  succeeds. */
    verification_url?: string | null;
    attachment_url?: string | null;
    attachment_filename?: string | null;
  }[];
  gallery_photos: { id: string; url: string; position: number }[];
  reviews: {
    id: string;
    rating: number;
    text: string;
    created_at: string;
    reply_text: string | null;
    reply_at: string | null;
    author: { display_name: string; avatar_url: string | null } | null;
  }[];
  membership_tiers: {
    id: string;
    tier_label: string;
    name: string;
    description: string | null;
    price: number;
    period: string | null;
    items: string[];
    featured: boolean;
    cta_text: string | null;
    position: number;
  }[];
  press_mentions: {
    id: string;
    publication: string;
    quote: string;
    meta: string | null;
    publication_style: string;
    position: number;
  }[];
};

const SELECT = `
  id, slug, tagline, about, experience, price_from, location, languages,
  cover_image, rating, review_count, customization,
  profile:profiles!id ( display_name, avatar_url ),
  trainer_specializations ( specialization_id ),
  services ( id, name, description, duration, price, position, is_placeholder ),
  packages ( id, name, description, items, price, period, featured, position, is_placeholder ),
  certifications ( id, text, position ),
  gallery_photos ( id, url, position ),
  reviews ( id, rating, text, created_at, reply_text, reply_at, author:profiles!author_id ( display_name, avatar_url ) ),
  membership_tiers ( id, tier_label, name, description, price, period, items, featured, cta_text, position ),
  press_mentions ( id, publication, quote, meta, publication_style, position )
`;

function mapTrainer(row: TrainerRow): Trainer {
  const sortByPos = <T extends { position: number }>(a: T, b: T) =>
    a.position - b.position;

  return {
    id: row.slug,
    name: row.profile?.display_name ?? "",
    avatar:
      row.profile?.avatar_url ??
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop",
    specializations: row.trainer_specializations.map(
      (ts) => ts.specialization_id as Specialization,
    ),
    tagline: row.tagline,
    about: row.about,
    experience: row.experience,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    priceFrom: row.price_from,
    location: row.location,
    languages: row.languages ?? [],
    certifications: [...row.certifications]
      .sort(sortByPos)
      .map((c) => c.text),
    certificationDetails: [...row.certifications].sort(sortByPos).map((c) => ({
      id: c.id,
      text: c.text,
      verificationUrl: c.verification_url ?? undefined,
      attachmentUrl: c.attachment_url ?? undefined,
      attachmentFilename: c.attachment_filename ?? undefined,
    })),
    gallery: [...row.gallery_photos].sort(sortByPos).map((g) => g.url),
    galleryItems: [...row.gallery_photos].sort(sortByPos).map((g) => ({ id: g.id, url: g.url })),
    services: [...row.services].sort(sortByPos).map(({ id, name, description, duration, price, is_placeholder }) => ({
      id,
      name,
      description,
      duration,
      price,
      isPlaceholder: !!is_placeholder,
    })),
    packages: [...row.packages].sort(sortByPos).map(({ id, name, description, items, price, period, featured, is_placeholder }) => ({
      id,
      name,
      description,
      items,
      price,
      period: period ?? undefined,
      featured: featured ?? false,
      isPlaceholder: !!is_placeholder,
    })),
    reviews: row.reviews.map((r) => ({
      id: r.id,
      trainerId: row.slug,
      authorName: r.author?.display_name ?? "Anonim",
      authorAvatar: r.author?.avatar_url ?? undefined,
      rating: r.rating,
      text: r.text,
      date: r.created_at.slice(0, 10),
      replyText: r.reply_text ?? undefined,
      replyAt: r.reply_at ?? undefined,
    })),
    membershipTiers: [...(row.membership_tiers ?? [])].sort(sortByPos).map((t) => ({
      id: t.id,
      tierLabel: t.tier_label,
      name: t.name,
      description: t.description ?? undefined,
      price: t.price,
      period: t.period ?? undefined,
      items: t.items ?? [],
      featured: t.featured,
      ctaText: t.cta_text ?? undefined,
    })),
    pressMentions: [...(row.press_mentions ?? [])].sort(sortByPos).map((p) => ({
      id: p.id,
      publication: p.publication,
      quote: p.quote,
      meta: p.meta ?? undefined,
      publicationStyle: (p.publication_style === "bold" ? "bold" : "serif") as "serif" | "bold",
    })),
    customization: {
      ...row.customization,
      // Coerce stale templates ("minimal" / "sport") that may still be in DB
      // from before we trimmed to 6 in 2026-04. Without this, TemplateProfile
      // crashes on `templates[template]` lookup.
      template: normalizeTemplate(row.customization?.template),
    },
  };
}

/**
 * Optionally fetch the verification_url / attachment_url / attachment_filename
 * columns from `certifications` and stitch them into the rows we already have.
 *
 * Tolerant of the columns not existing yet (Postgres error 42703 = undefined
 * column). When migration 014 hasn't been applied, this returns silently and
 * profiles render without verification badges; once the migration runs, the
 * extras flow through automatically without a code change.
 */
async function attachCertVerification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: TrainerRow[],
): Promise<void> {
  const trainerIds = rows.map((r) => r.id);
  if (trainerIds.length === 0) return;

  const { data, error } = await supabase
    .from("certifications")
    .select("id, trainer_id, verification_url, attachment_url, attachment_filename")
    .in("trainer_id", trainerIds);

  // 42703 = undefined column → migration 014 not applied yet. Other errors:
  // log + give up so the page still renders without verification badges.
  if (error) {
    if ((error as { code?: string }).code !== "42703") {
      console.warn("[trainers] cert verification fetch error:", error.message);
    }
    return;
  }

  const byId = new Map<string, { verification_url: string | null; attachment_url: string | null; attachment_filename: string | null }>(
    (data ?? []).map((c: { id: string; verification_url: string | null; attachment_url: string | null; attachment_filename: string | null; }) => [c.id, c]),
  );
  for (const row of rows) {
    for (const cert of row.certifications) {
      const extras = byId.get(cert.id);
      if (extras) {
        cert.verification_url = extras.verification_url;
        cert.attachment_url = extras.attachment_url;
        cert.attachment_filename = extras.attachment_filename;
      }
    }
  }
}

export async function getTrainers(): Promise<Trainer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainers")
    .select(SELECT)
    .eq("published", true)
    .order("rating", { ascending: false });
  if (error) throw error;
  const rows = data as unknown as TrainerRow[];
  await attachCertVerification(supabase, rows);
  return rows.map(mapTrainer);
}

export async function getTopTrainers(limit = 3): Promise<Trainer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainers")
    .select(SELECT)
    .eq("published", true)
    .order("rating", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data as unknown as TrainerRow[];
  await attachCertVerification(supabase, rows);
  return rows.map(mapTrainer);
}

export async function getTrainerBySlug(slug: string): Promise<Trainer | null> {
  const supabase = await createClient();
  // Note: we DON'T filter by published here — RLS ("trainers read published or own")
  // handles visibility automatically. Without auth: only published returns.
  // As the owner: returns own row even when unpublished, so trainer can preview/edit drafts.
  const { data, error } = await supabase
    .from("trainers")
    .select(SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as TrainerRow;
  await attachCertVerification(supabase, [row]);
  // The PRIMARY trainer page mirrors trainers.customization (kept in sync by
  // the design editor's actions), so we don't need a second lookup here. The
  // SECONDARY pages have their own customization in trainer_pages — those are
  // resolved by the /trainers/{slug}/{pageSlug} route via getTrainerPageByPath.
  return mapTrainer(row);
}
