"use server";

import type { ProfileCustomization, LuxuryCopy } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";

/**
 * Server actions for LuxuryProfile editable copy. Mirrors signature-copy-actions:
 * every text field on the page is editable inline; this module owns the
 * round-trip through customization.luxuryCopy JSONB.
 *
 * Page-scoped via optional pageId — omit to write to trainers.customization
 * (primary page); pass to write to a specific trainer_pages row (secondary).
 *
 * RICH_FIELDS get HTML allowlist sanitisation (em + strong + br); plain fields
 * are stored verbatim. Voice in Luxury is editorial-italic so most H2s and
 * pull-quotes are rich.
 */

// Mark casesH2 as rich so the Akcent toolbar can wrap "drogi." in a serif
// italic accent same way other H2s do.
const RICH_FIELDS: ReadonlySet<string> = new Set([
  "casesH2",
  "aboutH2", "aboutQuote",
  "servicesH2",
  "packagesH2",
  "galleryH2",
  "certificationsH2",
  "reviewsH2",
  "finalH2",
]);

const ALLOWED_KEYS: ReadonlySet<keyof LuxuryCopy> = new Set<keyof LuxuryCopy>([
  "brandName",
  "heroEyebrow", "heroTag", "heroStampNum", "heroStampLabel",
  "navAbout", "navServices", "navPackages", "navGallery", "navCertifications", "navReviews",
  "aboutH2", "aboutSub", "aboutQuote", "aboutBody",
  "servicesH2", "servicesSub",
  "packagesH2", "packagesSub",
  "galleryH2", "gallerySub",
  "certificationsH2", "certificationsSub",
  "reviewsH2", "reviewsSub",
  "finalEyebrow", "finalH2", "finalSub", "finalCta",
  "videoIntroLabel",
  "heroPhotoFocal",
  "casesLabel", "casesH2", "casesSub",
]);

function sanitiseRich(input: string): string {
  let s = input.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  // Allow <em>, <strong>, <br>; strip all other tags.
  s = s.replace(/<(?!\/?(em|strong|br)\b)[^>]*>/gi, "");
  return s.trim();
}

export async function updateLuxuryCopyField(
  field: string,
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ALLOWED_KEYS.has(field as keyof LuxuryCopy)) return { error: "Nieznane pole" };

  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const luxuryCopy: LuxuryCopy = { ...(ctx.customization.luxuryCopy ?? {}) };
  const trimmed = value.trim();
  if (trimmed === "") {
    delete luxuryCopy[field as keyof LuxuryCopy];
  } else {
    const stored = RICH_FIELDS.has(field) ? sanitiseRich(trimmed) : trimmed;
    (luxuryCopy as Record<string, string>)[field] = stored;
  }

  const next = { ...ctx.customization, luxuryCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

export async function resetLuxuryCopy(pageId?: string): Promise<
  { ok: true } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { luxuryCopy, ...rest } = ctx.customization;
  return saveCustomization(ctx.userId, ctx.customization, rest as ProfileCustomization, pageId);
}
