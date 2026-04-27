import { createClient } from "@/lib/supabase/server";

export type Goal = {
  id: string;
  title: string;
  unit: string | null;
  startValue: number;
  currentValue: number;
  targetValue: number;
  targetDate: string | null;
  note: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 0..1, direction-agnostic. NaN protected — returns 0 for degenerate goals. */
  pct: number;
};

type Row = {
  id: string;
  title: string;
  unit: string | null;
  start_value: string | number;
  current_value: string | number;
  target_value: string | number;
  target_date: string | null;
  note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Direction-agnostic progress: works for both lose-weight and gain-distance goals.
 * Pct is clamped to [0, 1]; if target == start the goal is degenerate and pct is 0.
 */
function computePct(start: number, current: number, target: number): number {
  const span = target - start;
  if (span === 0) return 0;
  const made = current - start;
  const raw = made / span;
  return Math.max(0, Math.min(1, raw));
}

function mapRow(r: Row): Goal {
  const start = Number(r.start_value);
  const current = Number(r.current_value);
  const target = Number(r.target_value);
  return {
    id: r.id,
    title: r.title,
    unit: r.unit,
    startValue: start,
    currentValue: current,
    targetValue: target,
    targetDate: r.target_date,
    note: r.note,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pct: computePct(start, current, target),
  };
}

/** Open (not archived) goals for the dashboard. */
export async function getGoals(clientId: string): Promise<Goal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_goals")
    .select("id, title, unit, start_value, current_value, target_value, target_date, note, archived_at, created_at, updated_at")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}
