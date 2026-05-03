import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization } from "@/types";

/**
 * Shared customization load/save helpers used by every action that mutates a
 * trainer's `customization` JSONB. Two modes:
 *
 *   - **No pageId** → legacy path: reads/writes `trainers.customization`. This
 *     is what every existing action does today; equivalent to "edit the
 *     primary page".
 *   - **With pageId** → reads/writes `trainer_pages.customization` for the
 *     specific page row. Used when the design editor is scoped to a secondary
 *     page via `?page={id}`.
 *
 * Ownership is enforced in both modes: the row's `trainer_id` (for pages) or
 * the row's `id` (for trainers) must match the authenticated user.
 *
 * History snapshots are appended on every save (capped at 20) so undo works
 * uniformly across both modes.
 */

const HISTORY_LIMIT = 20;

export type LoadResult =
  | { error: string }
  | { userId: string; customization: ProfileCustomization; about: string };

export async function loadCustomization(pageId?: string): Promise<LoadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowany" };

  if (pageId) {
    // Page-scoped read. Verify ownership via trainer_id check, then pull
    // customization. We also fetch trainer.about because cinematic actions
    // need it for chapter materialization fallback (trainer_pages don't have
    // their own about column — about is account-level).
    const { data, error } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Strona nie istnieje" };
    if (data.trainer_id !== user.id) return { error: "Nie należy do Ciebie" };

    const { data: trainer } = await supabase
      .from("trainers")
      .select("about")
      .eq("id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      customization: (data.customization ?? {}) as ProfileCustomization,
      about: (trainer?.about ?? "") as string,
    };
  }

  // Legacy: read trainers.customization + about together.
  const { data, error } = await supabase
    .from("trainers")
    .select("customization, about")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { error: error.message };

  return {
    userId: user.id,
    customization: (data?.customization ?? {}) as ProfileCustomization,
    about: (data?.about ?? "") as string,
  };
}

function snapshotForHistory(
  c: ProfileCustomization,
): Omit<ProfileCustomization, "_history" | "_redoStack"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _history, _redoStack, ...snap } = c;
  return snap;
}

/**
 * Save with history snapshot push. Pass the previous state (typically what
 * was returned by loadCustomization) and the new state. The previous gets
 * pushed onto _history; _history itself is capped at HISTORY_LIMIT entries.
 */
export async function saveCustomization(
  userId: string,
  previous: ProfileCustomization,
  next: ProfileCustomization,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const history = (previous._history ?? []).slice(-(HISTORY_LIMIT - 1));
  const withHistory: ProfileCustomization = {
    ...next,
    _history: [...history, snapshotForHistory(previous)],
    // Any forward-direction change invalidates the redo stack — standard
    // editor semantics: if the trainer undoes, then makes a new edit, we
    // discard the redo frontier they walked away from.
    _redoStack: [],
  };

  const supabase = await createClient();
  if (pageId) {
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization: withHistory })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("trainers")
      .update({ customization: withHistory })
      .eq("id", userId);
    if (error) return { error: error.message };
  }
  revalidatePath("/studio/design");
  revalidatePath("/studio/pages");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

/**
 * Push a tombstone snapshot — used by side-effect deletions (services,
 * packages) where the deleted entity lives outside `customization` JSONB and
 * therefore wouldn't be recoverable by the regular pop-and-apply undo flow.
 *
 * The snapshot represents the CURRENT customization (no actual customization
 * change is being made by the calling action) plus a `_restoreOnUndo`
 * payload that `undoCustomization` reads to re-insert the deleted row before
 * applying the snapshot.
 *
 * Writes to whichever customization scope the editor is in (`pageId`
 * provided → trainer_pages row; otherwise → trainers row). The Cofnij button
 * reads its history from the same scope it's editing, so the tombstone has
 * to land there for the user's "undo my last action" intent to actually
 * undo the deletion they just performed.
 */
export async function pushDeleteTombstone(
  userId: string,
  payload: NonNullable<NonNullable<ProfileCustomization["_history"]>[number]["_restoreOnUndo"]>,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  if (pageId) {
    const { data } = await supabase
      .from("trainer_pages")
      .select("customization, trainer_id")
      .eq("id", pageId)
      .maybeSingle();
    if (!data || data.trainer_id !== userId) return { error: "Strona nie istnieje" };

    const current = (data.customization ?? {}) as ProfileCustomization;
    const history = (current._history ?? []).slice(-(HISTORY_LIMIT - 1));
    const tombstone = { ...snapshotForHistory(current), _restoreOnUndo: payload };
    const next: ProfileCustomization = {
      ...current,
      _history: [...history, tombstone],
      _redoStack: [], // forward-direction mutation → discard redo frontier
    };

    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization: next })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
  } else {
    const { data } = await supabase
      .from("trainers")
      .select("customization")
      .eq("id", userId)
      .maybeSingle();

    const current = (data?.customization ?? {}) as ProfileCustomization;
    const history = (current._history ?? []).slice(-(HISTORY_LIMIT - 1));
    const tombstone = { ...snapshotForHistory(current), _restoreOnUndo: payload };
    const next: ProfileCustomization = {
      ...current,
      _history: [...history, tombstone],
      _redoStack: [], // forward-direction mutation → discard redo frontier
    };

    const { error } = await supabase
      .from("trainers")
      .update({ customization: next })
      .eq("id", userId);
    if (error) return { error: error.message };
  }

  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

/** Direct save without pushing to history. Used by undo (which restores a
 *  popped snapshot — appending it to history would create a loop). */
export async function saveDirect(
  userId: string,
  customization: ProfileCustomization,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (pageId) {
    const { error } = await supabase
      .from("trainer_pages")
      .update({ customization })
      .eq("id", pageId)
      .eq("trainer_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("trainers")
      .update({ customization })
      .eq("id", userId);
    if (error) return { error: error.message };
  }
  revalidatePath("/studio/design");
  revalidatePath("/studio/pages");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}
