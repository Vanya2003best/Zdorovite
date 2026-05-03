"use server";

import type { ProfileCustomization, SectionId, TemplateName } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";

const TEMPLATES: TemplateName[] = [
  "premium", "cozy",
  "luxury", "studio", "cinematic", "signature",
];
const SECTION_IDS: SectionId[] = [
  "about",
  "cases",
  "services",
  "packages",
  "gallery",
  "certifications",
  "reviews",
];

/**
 * Update the design-level fields (template / accent color / section order).
 * Phase 2: optional `pageId` scopes the write to a specific trainer_pages row
 * (a secondary page) when provided; without it, mutates trainers.customization
 * (the primary page).
 *
 * Spread `prev` (minus _history) FIRST so every existing field carries forward
 * by default — coverImage, cinematicFullbleedImage, cinematicVideoIntroUrl,
 * cinematicCopy, signatureCopy, and any future additions. Then override the
 * three fields this action actually owns.
 */
export async function updateDesign(
  input: {
    template: TemplateName;
    accentColor: string;
    sections: { id: SectionId; visible: boolean }[];
  },
  pageId?: string,
): Promise<void> {
  const tpl = TEMPLATES.includes(input.template) ? input.template : "premium";
  const ac = /^#[0-9a-fA-F]{6}$/.test(input.accentColor) ? input.accentColor : "#10b981";

  // Validate + dedupe section order: keep only known IDs, fill any missing with visible=true at end.
  const seen = new Set<SectionId>();
  const cleaned = input.sections
    .filter((s) => SECTION_IDS.includes(s.id) && !seen.has(s.id) && (seen.add(s.id), true))
    .map((s) => ({ id: s.id, visible: !!s.visible }));
  for (const id of SECTION_IDS) {
    if (!seen.has(id)) cleaned.push({ id, visible: true });
  }

  const ctx = await loadCustomization(pageId);
  if ("error" in ctx) return;

  const prev = ctx.customization;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _history: _prevHistory, ...prevSnapshot } = prev;
  const next: ProfileCustomization = {
    ...prevSnapshot,
    template: tpl,
    accentColor: ac,
    sections: cleaned,
    serviceLayout: prev.serviceLayout ?? "cards",
    galleryLayout: prev.galleryLayout ?? "grid",
  };

  await saveCustomization(ctx.userId, prev, next, pageId);
}
