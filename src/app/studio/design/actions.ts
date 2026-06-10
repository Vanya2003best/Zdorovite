"use server";

import type { ProfileCustomization, SectionId, TemplateName } from "@/types";
import { loadCustomization, saveCustomization } from "@/lib/db/page-customization";

type ActionResult = { ok: true; data?: unknown } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

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

type DesignInput = {
  template: TemplateName;
  accentColor: string;
  sections: { id: SectionId; visible: boolean }[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDesignInput(input: unknown): DesignInput | { error: string } {
  if (!isObject(input)) return { error: "Nieprawidłowe dane projektu." };

  const template = input.template;
  if (typeof template !== "string" || !TEMPLATES.includes(template as TemplateName)) {
    return { error: "Nieprawidłowy szablon." };
  }

  const accentColor = input.accentColor;
  if (typeof accentColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    return { error: "Nieprawidłowy kolor akcentu." };
  }

  const sections = input.sections;
  if (!Array.isArray(sections)) return { error: "Nieprawidłowa lista sekcji." };

  const seen = new Set<SectionId>();
  const cleaned: DesignInput["sections"] = [];
  for (const section of sections) {
    if (!isObject(section)) return { error: "Nieprawidłowa sekcja." };
    const id = section.id;
    if (typeof id !== "string" || !SECTION_IDS.includes(id as SectionId)) {
      return { error: "Nieprawidłowa sekcja." };
    }
    const sectionId = id as SectionId;
    if (seen.has(sectionId)) return { error: "Sekcje nie mogą się powtarzać." };
    if (typeof section.visible !== "boolean") {
      return { error: "Nieprawidłowa widoczność sekcji." };
    }

    seen.add(sectionId);
    cleaned.push({ id: sectionId, visible: section.visible });
  }

  return { template: template as TemplateName, accentColor, sections: cleaned };
}

/**
 * Update the design-level fields (template / accent color / section order).
 * Phase 2: optional `pageId` scopes the write to a specific trainer_pages row
 * (a secondary page) when provided; without it, mutates trainers.customization
 * (the primary page).
 *
 * Spread `prev` (minus _history) FIRST so every existing field carries forward
 * by default - coverImage, cinematicFullbleedImage, cinematicVideoIntroUrl,
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
): Promise<ActionResult> {
  try {
    const parsed = parseDesignInput(input);
    if ("error" in parsed) return parsed;
    if (pageId !== undefined && (typeof pageId !== "string" || pageId.trim().length === 0)) {
      return { error: "Nieprawidłowe id strony." };
    }

    // Keep only known IDs, fill any missing with visible=true at end.
    const seen = new Set<SectionId>();
    const cleaned = parsed.sections
      .filter((s) => SECTION_IDS.includes(s.id) && !seen.has(s.id) && (seen.add(s.id), true))
      .map((s) => ({ id: s.id, visible: s.visible }));
    for (const id of SECTION_IDS) {
      if (!seen.has(id)) cleaned.push({ id, visible: true });
    }

    const ctx = await loadCustomization(pageId);
    if ("error" in ctx) return { error: ctx.error };

    const prev = ctx.customization;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _history: _prevHistory, ...prevSnapshot } = prev;
    const next: ProfileCustomization = {
      ...prevSnapshot,
      template: parsed.template,
      accentColor: parsed.accentColor,
      sections: cleaned,
      serviceLayout: prev.serviceLayout ?? "cards",
      galleryLayout: prev.galleryLayout ?? "grid",
    };

    const result = await saveCustomization(ctx.userId, prev, next, pageId);
    if ("error" in result) return { error: result.error };
    return { ok: true };
  } catch (err) {
    console.error("updateDesign failed", err);
    return { error: DEFAULT_ERROR };
  }
}
