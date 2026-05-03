import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization, TrainerPage } from "@/types";
import { normalizeTemplate } from "@/data/templates";

/**
 * Fetchers for the `trainer_pages` table. The shape returned matches the
 * TrainerPage interface (camelCase, with customization parsed back into the
 * ProfileCustomization type so callers don't have to assert).
 */

type Row = {
  id: string;
  trainer_id: string;
  slug: string;
  template: string;
  customization: ProfileCustomization;
  is_primary: boolean;
  status: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Row): TrainerPage {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    slug: r.slug,
    template: normalizeTemplate(r.template as string | null),
    customization: r.customization ?? ({} as ProfileCustomization),
    isPrimary: r.is_primary,
    status: r.status === "published" ? "published" : "draft",
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** All pages belonging to a trainer, ordered with primary first. */
export async function listTrainerPages(trainerId: string): Promise<TrainerPage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_pages")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    // 42P01 = table not present (migration 015 not applied yet). Fall back to
    // empty so the rest of /studio still renders; the wizard will clearly
    // surface the migration step the trainer needs to run.
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return (data as Row[]).map(mapRow);
}

/** A trainer's primary page, or null if migration hasn't run / no rows yet. */
export async function getPrimaryPage(trainerId: string): Promise<TrainerPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_pages")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("is_primary", true)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
  return data ? mapRow(data as Row) : null;
}

/** Resolve a specific page by trainer-slug + page-slug. Used by the
 *  /trainers/{trainerSlug}/{pageSlug} route. Returns null if either the
 *  trainer or the page doesn't exist (or migration not applied). */
export async function getTrainerPageByPath(
  trainerSlug: string,
  pageSlug: string,
): Promise<{ trainerId: string; page: TrainerPage } | null> {
  const supabase = await createClient();
  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("slug", trainerSlug)
    .maybeSingle();
  if (!trainer) return null;

  const { data, error } = await supabase
    .from("trainer_pages")
    .select("*")
    .eq("trainer_id", trainer.id)
    .eq("slug", pageSlug)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
  if (!data) return null;
  return { trainerId: trainer.id, page: mapRow(data as Row) };
}

/** Single page by id — used by /studio/design when it scopes to ?page={id}. */
export async function getTrainerPageById(id: string): Promise<TrainerPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
  return data ? mapRow(data as Row) : null;
}
