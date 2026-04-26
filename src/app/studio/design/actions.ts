"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization, SectionId, TemplateName } from "@/types";

const TEMPLATES: TemplateName[] = [
  "minimal", "sport", "premium", "cozy",
  "luxury", "studio", "cinematic", "signature",
];
const SECTION_IDS: SectionId[] = [
  "about",
  "services",
  "packages",
  "gallery",
  "certifications",
  "reviews",
];

export async function updateDesign(input: {
  template: TemplateName;
  accentColor: string;
  sections: { id: SectionId; visible: boolean }[];
}): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tpl = TEMPLATES.includes(input.template) ? input.template : "minimal";
  const ac = /^#[0-9a-fA-F]{6}$/.test(input.accentColor) ? input.accentColor : "#10b981";

  // Validate + dedupe section order: keep only known IDs, fill any missing with visible=true at end.
  const seen = new Set<SectionId>();
  const cleaned = input.sections
    .filter((s) => SECTION_IDS.includes(s.id) && !seen.has(s.id) && (seen.add(s.id), true))
    .map((s) => ({ id: s.id, visible: !!s.visible }));
  for (const id of SECTION_IDS) {
    if (!seen.has(id)) cleaned.push({ id, visible: true });
  }

  const { data: existing } = await supabase
    .from("trainers")
    .select("customization, slug")
    .eq("id", user.id)
    .single();

  const prev = (existing?.customization ?? {}) as Partial<ProfileCustomization>;
  const next: ProfileCustomization = {
    template: tpl,
    accentColor: ac,
    sections: cleaned,
    serviceLayout: prev.serviceLayout ?? "cards",
    galleryLayout: prev.galleryLayout ?? "grid",
    coverImage: prev.coverImage,
  };

  await supabase.from("trainers").update({ customization: next }).eq("id", user.id);

  revalidatePath("/studio/design");
  if (existing?.slug) revalidatePath(`/trainers/${existing.slug}`);
}
