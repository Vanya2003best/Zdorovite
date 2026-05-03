"use server";

import { randomUUID } from "node:crypto";
import type { ProfileCustomization, StudioCopy, StudioCaseStudy } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";
import { sanitizeRichHTML } from "./sanitize-rich";

/**
 * Server actions for StudioProfile editable copy. Mirrors luxury/signature/
 * cinematic-copy-actions: every text field on the page is editable inline;
 * this module owns the round-trip through customization.studioCopy JSONB.
 *
 * Page-scoped via optional pageId — omit to write to trainers.customization
 * (primary page); pass to write to a specific trainer_pages row (secondary).
 *
 * RICH_FIELDS get HTML allowlist sanitisation (em + strong + br); plain fields
 * are stored verbatim. Voice in Studio is editorial-italic so most H2s carry
 * em accents (e.g. "Metoda <em>w skrócie</em>").
 */

const RICH_FIELDS: ReadonlySet<string> = new Set([
  "aboutH2",
  "servicesH2",
  "packagesH2",
  "galleryH2",
  "certificationsH2",
  "reviewsH2",
  "reviewsAiInsight",
  "finalH2",
  "aboutPhilosophyHead",
  "casesH2",
]);

/** Case-study text fields that accept rich (em/strong/br) markup on save.
 *  Every user-editable string field is rich so the trainer can accent any
 *  word — e.g. orange-highlight "100km" in a stat value, or italicise a key
 *  phrase in the body. Non-text fields (photo URLs, hidden flag) are excluded. */
const CASE_RICH_FIELDS: ReadonlySet<keyof StudioCaseStudy> = new Set<keyof StudioCaseStudy>([
  "tag", "title", "body",
  "stat1", "stat1Label",
  "stat2", "stat2Label",
  "stat3", "stat3Label",
]);

const CASE_ALLOWED_FIELDS: ReadonlySet<keyof StudioCaseStudy> = new Set<keyof StudioCaseStudy>([
  "tag", "title", "body",
  "stat1", "stat1Label",
  "stat2", "stat2Label",
  "stat3", "stat3Label",
  "photoFocal", "photoHidden",
]);

const ALLOWED_KEYS: ReadonlySet<keyof StudioCopy> = new Set<keyof StudioCopy>([
  "brandName",
  "heroSlash", "heroTag", "heroAvailability",
  "aboutLabel", "aboutH2", "aboutSub",
  "servicesLabel", "servicesH2", "servicesSub",
  "packagesLabel", "packagesH2", "packagesSub",
  "galleryLabel", "galleryH2", "gallerySub",
  "certificationsLabel", "certificationsH2", "certificationsSub",
  "reviewsLabel", "reviewsH2", "reviewsSub", "reviewsAiInsight",
  "finalLabel", "finalH2", "finalSub", "finalCtaPrimary", "finalCtaSecondary",
  "aboutPhilosophyLabel", "aboutPhilosophyHead", "aboutPhilosophyBody",
  "casesLabel", "casesH2", "casesSub",
  "videoIntroLabel",
  "heroPhotoFocal", "aboutCollagePhotoFocal",
  "heroPhotoHidden", "aboutCollagePhotoHidden",
]);

function sanitiseRich(input: string): string {
  // Use the full allowlist sanitizer so the Akcent toolbar (which produces
  // `<span style="color: #hex">…</span>`) actually survives the round-trip.
  // The earlier regex-only version stripped <span> entirely, which is why
  // accent highlighting silently disappeared on save.
  return sanitizeRichHTML(input).trim();
}

export async function updateStudioCopyField(
  field: string,
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ALLOWED_KEYS.has(field as keyof StudioCopy)) return { error: "Nieznane pole" };

  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const trimmed = value.trim();
  if (trimmed === "") {
    delete studioCopy[field as keyof StudioCopy];
  } else {
    const stored = RICH_FIELDS.has(field) ? sanitiseRich(trimmed) : trimmed;
    (studioCopy as Record<string, unknown>)[field] = stored;
  }

  const next = { ...ctx.customization, studioCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

export async function resetStudioCopy(pageId?: string): Promise<
  { ok: true } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { studioCopy, ...rest } = ctx.customization;
  return saveCustomization(ctx.userId, ctx.customization, rest as ProfileCustomization, pageId);
}

/** Default 3 case studies seeded the FIRST time the trainer clicks "+ Dodaj"
 *  on an empty cases array. Lets the section land already-populated (matching
 *  the original Studio design) instead of forcing the trainer to fill 3 cards
 *  from scratch. Subsequent adds just push one empty card. */
const SEED_CASES: Omit<StudioCaseStudy, "id">[] = [
  {
    tag: "Rehabilitacja ACL",
    title: "Od zerwania więzadła do gry w ekstraklasie — w 6 miesięcy.",
    body:
      "Klient M., 24 lata, piłkarz półzawodowy. Zerwanie ACL prawego kolana w trakcie meczu. Plan: diagnostyka, rekonstrukcja, 24-tygodniowy protokół powrotu do sportu z pomiarami co 4 tygodnie.",
    stat1: "24 tyg", stat1Label: "Od operacji do meczu",
    stat2: "100%",   stat2Label: "Symetria siły Q/H",
    stat3: "0",      stat3Label: "Nawroty w 18 mies.",
  },
  {
    tag: "Prewencja · Maraton",
    title: "Zbudowanie odporności kolana na obciążenia maratońskie.",
    body:
      "Klientka J., 38 lat, ultramaratonka amatorka. Cel: przebiec 100 km bez bólu kolana. 12-tygodniowy program wzmacniania w oparciu o ocenę FMS i analizę wideo biegu.",
    stat1: "12 tyg", stat1Label: "Czas programu",
    stat2: "+34%",   stat2Label: "Siły czworogłowych",
    stat3: "100km",  stat3Label: "Ukończonych bez bólu",
  },
  {
    tag: "Terapia · Kręgosłup",
    title: "Przewlekły ból lędźwi → powrót do codziennego treningu.",
    body:
      "Klient P., 42 lata, manager IT. 3 lata przewlekłego bólu lędźwiowego. Łączenie terapii manualnej, dry needlingu i progresywnego planu mobilności. Sesje 2 × w tygodniu.",
    stat1: "8 tyg",    stat1Label: "Do zniknięcia bólu",
    stat2: "-70%",     stat2Label: "VAS po 4 tyg.",
    stat3: "3×/tydz",  stat3Label: "Trening siłowy dziś",
  },
];

/** Append a case study. Empty array → seeds 3 defaults at once (matches
 *  original Studio design). Non-empty → pushes one blank card. Returns the
 *  ids of newly-added cases. */
export async function addStudioCase(
  pageId?: string,
): Promise<{ ok: true; ids: string[] } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const cases = [...(studioCopy.cases ?? [])];
  let newIds: string[];
  if (cases.length === 0) {
    newIds = SEED_CASES.map(() => randomUUID());
    SEED_CASES.forEach((seed, i) => cases.push({ id: newIds[i]!, ...seed }));
  } else {
    const id = randomUUID();
    cases.push({ id });
    newIds = [id];
  }
  studioCopy.cases = cases;

  const next = { ...ctx.customization, studioCopy };
  const res = await saveCustomization(ctx.userId, ctx.customization, next, pageId);
  if ("error" in res) return res;
  return { ok: true, ids: newIds };
}

/** Reorder case studies by ids. Same semantics as setItemOrder for services/
 *  packages — pass the desired order, the array is rewritten to match. */
export async function reorderStudioCases(
  orderedIds: string[],
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const byId = new Map((studioCopy.cases ?? []).map((c) => [c.id, c] as const));
  const reordered: StudioCaseStudy[] = [];
  for (const id of orderedIds) {
    const c = byId.get(id);
    if (c) reordered.push(c);
  }
  // Append any cases not in orderedIds (shouldn't happen, but keep them safe).
  for (const c of studioCopy.cases ?? []) {
    if (!orderedIds.includes(c.id)) reordered.push(c);
  }
  studioCopy.cases = reordered;

  const next = { ...ctx.customization, studioCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/** Filter a case out of the array. Other cases keep their order/ids. */
export async function removeStudioCase(
  caseId: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const cases = (studioCopy.cases ?? []).filter((c) => c.id !== caseId);
  studioCopy.cases = cases;

  const next = { ...ctx.customization, studioCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

/** Update a single field on a single case. Empty value clears the field
 *  (drops the key). Title gets rich-html sanitisation; everything else is
 *  stored as-is. */
export async function updateStudioCaseField(
  caseId: string,
  field: keyof StudioCaseStudy,
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (field === "id") return { error: "Nie można zmienić id." };
  if (!CASE_ALLOWED_FIELDS.has(field)) return { error: "Nieznane pole case study." };

  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const studioCopy: StudioCopy = { ...(ctx.customization.studioCopy ?? {}) };
  const cases = [...(studioCopy.cases ?? [])];
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return { error: "Case study nie istnieje." };

  const current = { ...cases[idx]! };
  const trimmed = value.trim();
  if (trimmed === "") {
    delete (current as Record<string, unknown>)[field];
  } else {
    const stored = CASE_RICH_FIELDS.has(field) ? sanitiseRich(trimmed) : trimmed;
    (current as Record<string, unknown>)[field] = stored;
  }
  cases[idx] = current;
  studioCopy.cases = cases;

  const next = { ...ctx.customization, studioCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}
