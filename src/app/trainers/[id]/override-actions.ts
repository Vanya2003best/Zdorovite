"use server";

import type { ItemOverride, ProfileCustomization } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";

/**
 * Per-page overrides for services + packages. Stored in customization JSONB
 * (no new DB tables) — keyed by the underlying row id.
 *
 * All actions take optional `pageId`. When set → mutates the override map on
 * the trainer_pages row. When omitted → mutates trainers.customization (the
 * primary page). The override map merge-patches: passing a partial ItemOverride
 * leaves un-mentioned fields untouched.
 *
 * Use `setOverride` for individual field changes (toggle hidden, rename, etc.)
 * and `setOverrides` for bulk reorder operations.
 */

export type ActionResult = { ok: true } | { error: string };

type Kind = "service" | "package";

/** The customization key holding the override map for a given kind. */
function bagKey(kind: Kind): "serviceOverrides" | "packageOverrides" {
  return kind === "service" ? "serviceOverrides" : "packageOverrides";
}

/**
 * Patch a single item's override. Pass `null` for any field to clear it; the
 * server merges with the existing override and keeps the map clean (drops
 * empty objects). Convenience: passing all-null effectively removes the
 * override entirely.
 */
export async function setItemOverride(
  kind: Kind,
  itemId: string,
  patch: Partial<ItemOverride>,
  pageId?: string,
): Promise<ActionResult> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const key = bagKey(kind);
  const existing = (ctx.customization[key] ?? {}) as Record<string, ItemOverride>;
  const current = existing[itemId] ?? {};
  const merged: ItemOverride = { ...current, ...patch };

  // Drop fields that are explicitly cleared (set to undefined in the patch).
  for (const k of Object.keys(patch) as (keyof ItemOverride)[]) {
    if (patch[k] === undefined) delete merged[k];
  }

  // If the resulting override is empty, drop the key entirely so the JSONB
  // stays small (otherwise we'd accumulate {} entries forever).
  const isEmpty = Object.keys(merged).length === 0;
  const nextBag = { ...existing };
  if (isEmpty) delete nextBag[itemId];
  else nextBag[itemId] = merged;

  const next: ProfileCustomization = {
    ...ctx.customization,
    [key]: nextBag,
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/** Toggle the `hidden` flag for a service or package on this page. */
export async function setItemHidden(
  kind: Kind,
  itemId: string,
  hidden: boolean,
  pageId?: string,
): Promise<ActionResult> {
  return setItemOverride(kind, itemId, { hidden: hidden ? true : undefined }, pageId);
}

/**
 * Reorder all items of a kind at once. Pass the desired ordering as an array
 * of ids; this writes `position: 0..N-1` on each via the override map. Any
 * existing overrides for those items are preserved (merge-patched).
 */
export async function setItemOrder(
  kind: Kind,
  orderedIds: string[],
  pageId?: string,
): Promise<ActionResult> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const key = bagKey(kind);
  const existing = (ctx.customization[key] ?? {}) as Record<string, ItemOverride>;
  const nextBag: Record<string, ItemOverride> = { ...existing };

  orderedIds.forEach((id, idx) => {
    const current = nextBag[id] ?? {};
    nextBag[id] = { ...current, position: idx };
  });

  const next: ProfileCustomization = {
    ...ctx.customization,
    [key]: nextBag,
  };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/** Clear all overrides for a kind on this page — items go back to master-table
 *  values. Useful for a "Reset to default" action in the editor. */
export async function clearItemOverrides(
  kind: Kind,
  pageId?: string,
): Promise<ActionResult> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const key = bagKey(kind);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [key]: _dropped, ...rest } = ctx.customization;
  return saveCustomization(ctx.userId, ctx.customization, rest as ProfileCustomization, pageId);
}

/**
 * Set the per-page specializations chip list. Pass an array of slug values
 * matching `Specialization` keys; pass `null` to clear and fall back to the
 * trainer's global list. The override is bounded to 12 chips so the chip
 * row stays a single line on desktop and doesn't overrun mobile cards.
 */
export async function setPageSpecializations(
  specs: string[] | null,
  pageId?: string,
): Promise<ActionResult> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  if (specs && specs.length > 12) {
    return { error: "Maks. 12 specjalizacji na stronie." };
  }

  const next: ProfileCustomization = specs === null
    ? (() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { specializations: _drop, ...rest } = ctx.customization;
        return rest as ProfileCustomization;
      })()
    : { ...ctx.customization, specializations: specs };

  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}
