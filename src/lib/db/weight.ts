import { createClient } from "@/lib/supabase/server";

export type WeightPoint = {
  recordedAt: string; // YYYY-MM-DD
  weightKg: number;
};

type Row = { recorded_at: string; weight_kg: string | number };

function mapRow(r: Row): WeightPoint {
  return { recordedAt: r.recorded_at, weightKg: Number(r.weight_kg) };
}

/** Most-recent-first weight readings. limit defaults to 90 days of data. */
export async function getWeightLog(clientId: string, limit = 90): Promise<WeightPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_weight_log")
    .select("recorded_at, weight_kg")
    .eq("client_id", clientId)
    .order("recorded_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

/** Single latest reading, or null. */
export async function getLatestWeight(clientId: string): Promise<WeightPoint | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_weight_log")
    .select("recorded_at, weight_kg")
    .eq("client_id", clientId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as unknown as Row);
}

/**
 * Returns the closest reading at OR after the start of the current year — used for
 * "−6,2 kg od stycznia" hero stat. Falls back to the very first reading if there's
 * nothing this year.
 */
export async function getYearStartWeight(clientId: string): Promise<WeightPoint | null> {
  const supabase = await createClient();
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { data, error } = await supabase
    .from("client_weight_log")
    .select("recorded_at, weight_kg")
    .eq("client_id", clientId)
    .gte("recorded_at", yearStart)
    .order("recorded_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return mapRow(data as unknown as Row);
  // Fallback: the very first reading we have.
  const { data: first } = await supabase
    .from("client_weight_log")
    .select("recorded_at, weight_kg")
    .eq("client_id", clientId)
    .order("recorded_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!first) return null;
  return mapRow(first as unknown as Row);
}
