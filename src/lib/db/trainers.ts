import { createClient } from "@/lib/supabase/server";
import type {
  Trainer,
  ProfileCustomization,
  Specialization,
} from "@/types";

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
  }[];
  certifications: { text: string; position: number }[];
  gallery_photos: { url: string; position: number }[];
  reviews: {
    id: string;
    rating: number;
    text: string;
    created_at: string;
    author: { display_name: string } | null;
  }[];
};

const SELECT = `
  id, slug, tagline, about, experience, price_from, location, languages,
  cover_image, rating, review_count, customization,
  profile:profiles!id ( display_name, avatar_url ),
  trainer_specializations ( specialization_id ),
  services ( id, name, description, duration, price, position ),
  packages ( id, name, description, items, price, period, featured, position ),
  certifications ( text, position ),
  gallery_photos ( url, position ),
  reviews ( id, rating, text, created_at, author:profiles!author_id ( display_name ) )
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
    gallery: [...row.gallery_photos].sort(sortByPos).map((g) => g.url),
    services: [...row.services].sort(sortByPos).map(({ id, name, description, duration, price }) => ({
      id,
      name,
      description,
      duration,
      price,
    })),
    packages: [...row.packages].sort(sortByPos).map(({ id, name, description, items, price, period, featured }) => ({
      id,
      name,
      description,
      items,
      price,
      period: period ?? undefined,
      featured: featured ?? false,
    })),
    reviews: row.reviews.map((r) => ({
      id: r.id,
      trainerId: row.slug,
      authorName: r.author?.display_name ?? "Anonim",
      rating: r.rating,
      text: r.text,
      date: r.created_at.slice(0, 10),
    })),
    customization: row.customization,
  };
}

export async function getTrainers(): Promise<Trainer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainers")
    .select(SELECT)
    .eq("published", true)
    .order("rating", { ascending: false });
  if (error) throw error;
  return (data as unknown as TrainerRow[]).map(mapTrainer);
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
  return (data as unknown as TrainerRow[]).map(mapTrainer);
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
  return mapTrainer(data as unknown as TrainerRow);
}
