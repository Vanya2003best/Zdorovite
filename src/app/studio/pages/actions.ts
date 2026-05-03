"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization, TemplateName, SectionId } from "@/types";

/**
 * CRUD for `trainer_pages` — the multi-page model. Each page is a self-
 * contained presentation (template + customization + slug); ONE per trainer
 * is `is_primary` and serves /trainers/{trainer-slug} as the default view.
 *
 * Phase 1 scope: create / delete / set-primary / publish-toggle. Editing of
 * the customization itself reuses the existing /studio/design action surface
 * (updateDesign, updateCinematicCopyField, updateSignatureCopyField, etc.) —
 * those will be extended in a follow-up to scope to a specific page id.
 */

export type ActionResult = { ok: true } | { error: string };

const VALID_TEMPLATES: TemplateName[] = [
  "premium", "cozy",
  "luxury", "studio", "cinematic", "signature",
];
const SECTION_IDS: SectionId[] = ["about", "cases", "services", "packages", "gallery", "certifications", "reviews"];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
/** Reserved slugs that conflict with sub-routes living next to [pageSlug]
 *  under /trainers/[id]/. Adding a page with one of these slugs would shadow
 *  a real route — Next.js prefers static segments over [pageSlug], so the
 *  trainer's secondary page would simply be unreachable.
 *  `main`, `messages`, `preview`, `edit`, `p` are forward-looking guards in
 *  case those become real routes (or used to be — `p` was the legacy multi-
 *  page prefix and is reserved so old links don't accidentally collide). */
const RESERVED_SLUGS = new Set(["main", "p", "book", "gallery", "messages", "preview", "edit"]);

function defaultCustomization(template: TemplateName): ProfileCustomization {
  return {
    template,
    accentColor: "#10b981",
    sections: SECTION_IDS.map((id) => ({ id, visible: true })),
    serviceLayout: "cards",
    galleryLayout: "grid",
  };
}

/**
 * Create a new page for the current trainer. Two seed modes:
 *   - "scratch": fresh customization with the chosen template's defaults
 *   - "copy:{pageId}": deep-copy the customization from another page (most
 *     useful when you want a near-duplicate to A/B with different copy)
 *
 * The new page is never marked is_primary — the trainer must explicitly
 * promote it via setPrimaryPage if they want it as the default.
 */
export async function createTrainerPage(formData: FormData): Promise<ActionResult & { id?: string }> {
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const title = String(formData.get("title") ?? "").trim();
  const template = String(formData.get("template") ?? "") as TemplateName;
  const seed = String(formData.get("seed") ?? "scratch");

  if (!SLUG_RE.test(slug)) {
    return { error: "Slug: 1-40 znaków, małe litery, cyfry, myślnik. Bez spacji." };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { error: `"${slug}" to zarezerwowany URL — wybierz inny.` };
  }
  if (!VALID_TEMPLATES.includes(template)) {
    return { error: "Wybierz prawidłowy szablon." };
  }
  if (title.length > 80) return { error: "Tytuł zbyt długi (max 80)." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  // Resolve seed customization
  let customization: ProfileCustomization = defaultCustomization(template);
  if (seed.startsWith("copy:")) {
    const sourceId = seed.slice("copy:".length);
    const { data: source } = await supabase
      .from("trainer_pages")
      .select("customization")
      .eq("id", sourceId)
      .eq("trainer_id", user.id)
      .maybeSingle();
    if (source?.customization) {
      // Override the template with the chosen one but carry forward all the
      // copy bags / sections / images from the source.
      customization = {
        ...(source.customization as ProfileCustomization),
        template,
      };
      // Drop _history — it's specific to the source page's edit timeline.
      delete (customization as { _history?: unknown })._history;
    }
  }

  const { data, error } = await supabase
    .from("trainer_pages")
    .insert({
      trainer_id: user.id,
      slug,
      template,
      customization,
      is_primary: false,
      status: "draft",
      title: title || null,
    })
    .select("id")
    .single();
  if (error) {
    // Unique-constraint violation on (trainer_id, slug) → trainer already
    // has a page with this slug.
    if ((error as { code?: string }).code === "23505") {
      return { error: `Strona z URL-em "${slug}" już istnieje.` };
    }
    return { error: error.message };
  }

  revalidatePath("/studio/pages");
  revalidatePath("/studio/design");
  return { ok: true, id: data.id };
}

/**
 * Promote a page to primary. Two-step to satisfy the partial unique index
 * `trainer_pages_one_primary_per_trainer`: clear current primary, then set
 * the new one. Wrapped in a transaction-like sequence (best effort — if step
 * 2 fails we re-raise, leaving zero primary pages briefly which the UI tolerates).
 */
export async function setPrimaryPage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error: clearErr } = await supabase
    .from("trainer_pages")
    .update({ is_primary: false })
    .eq("trainer_id", user.id)
    .eq("is_primary", true);
  if (clearErr) return { error: clearErr.message };

  const { error: setErr } = await supabase
    .from("trainer_pages")
    .update({ is_primary: true })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (setErr) return { error: setErr.message };

  revalidatePath("/studio/pages");
  revalidatePath("/studio/design");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

export async function setPageStatus(
  id: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { error } = await supabase
    .from("trainer_pages")
    .update({ status })
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/pages");
  revalidatePath("/trainers/[id]", "page");
  return { ok: true };
}

/**
 * Delete a non-primary page. Primary pages are protected — the trainer must
 * promote another page first. Prevents accidentally orphaning the public URL.
 */
export async function deleteTrainerPage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niezalogowany." };

  const { data: page } = await supabase
    .from("trainer_pages")
    .select("is_primary")
    .eq("id", id)
    .eq("trainer_id", user.id)
    .maybeSingle();
  if (!page) return { error: "Strona nie istnieje." };
  if (page.is_primary) {
    return { error: "Nie można usunąć głównej strony — najpierw wybierz inną jako główną." };
  }

  const { error } = await supabase
    .from("trainer_pages")
    .delete()
    .eq("id", id)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/studio/pages");
  return { ok: true };
}

/**
 * Server-action wrapper for the wizard form: validates + creates + redirects
 * straight to the design editor scoped to the new page. Used as the form's
 * `action` attribute so the wizard is a one-click flow, no client JS needed
 * for the happy path.
 */
export async function createTrainerPageAndOpenEditor(formData: FormData): Promise<void> {
  const res = await createTrainerPage(formData);
  if ("error" in res) {
    // Surface the error via a query param the wizard page reads back.
    redirect(`/studio/pages/new?error=${encodeURIComponent(res.error)}`);
  }
  redirect(`/studio/design?page=${res.id}`);
}
