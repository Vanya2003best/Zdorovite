"use server";

import type { ProfileCustomization, SignatureCopy } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";

/**
 * Server actions for SignatureProfile editable copy. Mirrors the cinematic-copy
 * pattern: every text field on the page is editable inline; this module owns
 * the round-trip through customization.signatureCopy JSONB.
 *
 * Uses the SAME _history capping rules as cinematic-copy-actions so undo works
 * uniformly across templates. RICH_FIELDS get HTML sanitisation; everything
 * else is stored as plain text.
 *
 * Phase 2: every action takes optional `pageId`. When provided, mutations
 * scope to that specific trainer_pages row (a secondary page); when omitted,
 * the legacy path mutates trainers.customization (= the primary page).
 */

const RICH_FIELDS: ReadonlySet<string> = new Set([
  "manifestoText", "manifestoSignature",
  "letterTitle", "letterSignName",
  "servicesH2", "servicesSubcopy",
  "membershipH2", "membershipSubcopy",
  "pressH2",
  "certificationsH2",
  "galleryH2",
  "contactH2", "contactSubcopy",
  "aiInsightText", "aiInsightTitle",
  "casesH2",
  "reviewsH2",
]);

const ALLOWED_KEYS: ReadonlySet<keyof SignatureCopy> = new Set<keyof SignatureCopy>([
  "domainBar", "domainBarLabel",
  "monogramOverride", "monogramTagline",
  "heroVolLabel", "heroIssueLabel", "heroSubtitle",
  "manifestoLabel", "manifestoText", "manifestoSignature",
  "letterLabel", "letterTitle", "letterSignName", "letterSignMeta",
  "aiInsightTitle", "aiInsightText",
  "servicesLabel", "servicesH2", "servicesSubcopy",
  "membershipLabel", "membershipH2", "membershipSubcopy",
  "pressLabel", "pressH2",
  "certificationsLabel", "certificationsH2",
  "galleryLabel", "galleryH2",
  "contactLabel", "contactH2", "contactSubcopy",
  "contactPhone", "contactEmail", "contactStudio",
  "tier1Label", "tier2Label", "tier3Label",
  "videoIntroLabel",
  "heroPhotoFocal",
  "casesLabel", "casesH2", "casesSub",
  "reviewsLabel", "reviewsH2", "reviewsSub",
]);

/** Trivial HTML-escape sanitiser for rich fields. We allow only <em> + <strong>
 *  (italic accent + bold) — the visual language of Signature is restrained, no
 *  need for the full Cinematic toolbar. Everything else is stripped on save. */
function sanitiseRich(input: string): string {
  // Strip script/style tags entirely.
  let s = input.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  // Allow <em>, <strong>, <br>; strip everything else by removing all tags
  // not in the allowlist.
  s = s.replace(/<(?!\/?(em|strong|br)\b)[^>]*>/gi, "");
  return s.trim();
}

export async function updateSignatureCopyField(
  field: string,
  value: string,
  pageId?: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ALLOWED_KEYS.has(field as keyof SignatureCopy)) return { error: "Nieznane pole" };

  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  const signatureCopy: SignatureCopy = { ...(ctx.customization.signatureCopy ?? {}) };
  const trimmed = value.trim();
  if (trimmed === "") {
    delete signatureCopy[field as keyof SignatureCopy];
  } else {
    const stored = RICH_FIELDS.has(field) ? sanitiseRich(trimmed) : trimmed;
    // TS can't narrow string-keyed assignment to a union — safe by ALLOWED_KEYS check above.
    (signatureCopy as Record<string, string>)[field] = stored;
  }

  const next = { ...ctx.customization, signatureCopy };
  return saveCustomization(ctx.userId, ctx.customization, next, pageId);
}

export async function resetSignatureCopy(pageId?: string): Promise<
  { ok: true } | { error: string }
> {
  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return ctx;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signatureCopy, ...rest } = ctx.customization;
  return saveCustomization(ctx.userId, ctx.customization, rest as ProfileCustomization, pageId);
}
