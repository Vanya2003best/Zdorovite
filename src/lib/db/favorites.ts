import { createClient } from "@/lib/supabase/server";

export type FavoriteTrainerBrief = {
  slug: string;
  name: string;
  avatar: string | null;
  rating: number;
  mainSpec: string | null;
};

/** UUIDs only — for fast catalog filtering. */
export async function getFavoriteTrainerIds(clientId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_favorites")
    .select("trainer_id")
    .eq("client_id", clientId);
  if (error) throw error;
  return (data ?? []).map((r) => r.trainer_id as string);
}

/** Lightweight rows for the dashboard sidebar list. */
export async function getFavoriteTrainersBrief(clientId: string): Promise<FavoriteTrainerBrief[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_favorites")
    .select(`
      created_at,
      trainer:trainers!trainer_id (
        slug, rating,
        profile:profiles!id ( display_name, avatar_url ),
        trainer_specializations ( specialization_id )
      )
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    trainer: {
      slug: string;
      rating: number | string;
      profile: { display_name: string; avatar_url: string | null } | null;
      trainer_specializations: { specialization_id: string }[];
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.trainer !== null)
    .map((r) => ({
      slug: r.trainer!.slug,
      name: r.trainer!.profile?.display_name ?? "",
      avatar: r.trainer!.profile?.avatar_url ?? null,
      rating: Number(r.trainer!.rating),
      mainSpec: r.trainer!.trainer_specializations[0]?.specialization_id ?? null,
    }));
}

/** Cheap single-row check, used to SSR-seed the heart button. */
export async function isFavorite(clientId: string, trainerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_favorites")
    .select("trainer_id")
    .eq("client_id", clientId)
    .eq("trainer_id", trainerId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
