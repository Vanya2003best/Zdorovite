import { createClient } from "@/lib/supabase/server";

export type ClientHealth = {
  note: string | null;
  heightCm: number | null;
  fmsScore: number | null;
  restingHr: number | null;
  updatedAt: string | null;
};

const EMPTY: ClientHealth = {
  note: null,
  heightCm: null,
  fmsScore: null,
  restingHr: null,
  updatedAt: null,
};

/** Returns the client's health snapshot, or an empty record if they haven't filled it in yet. */
export async function getHealth(clientId: string): Promise<ClientHealth> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_health")
    .select("note, height_cm, fms_score, resting_hr, updated_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY;
  return {
    note: data.note,
    heightCm: data.height_cm,
    fmsScore: data.fms_score,
    restingHr: data.resting_hr,
    updatedAt: data.updated_at,
  };
}
