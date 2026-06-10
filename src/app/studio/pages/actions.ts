"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization, TemplateName, SectionId } from "@/types";

export type ActionResult = { ok: true; data?: unknown } | { error: string };

const DEFAULT_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

const VALID_TEMPLATES: TemplateName[] = [
  "premium", "cozy",
  "luxury", "studio", "cinematic", "signature",
];
const SECTION_IDS: SectionId[] = ["about", "cases", "services", "packages", "gallery", "certifications", "reviews"];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
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

function isTemplate(value: string): value is TemplateName {
  return VALID_TEMPLATES.includes(value as TemplateName);
}

function validateId(id: string): string | { error: string } {
  if (typeof id !== "string" || !id.trim()) return { error: "Brak ID." };
  return id.trim();
}

export async function createTrainerPage(formData: FormData): Promise<ActionResult & { id?: string }> {
  try {
    if (!(formData instanceof FormData)) return { error: "Nieprawidłowe dane formularza." };

    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    const title = String(formData.get("title") ?? "").trim();
    const templateRaw = String(formData.get("template") ?? "");
    const seed = String(formData.get("seed") ?? "scratch");

    if (!SLUG_RE.test(slug)) {
      return { error: "Slug: 1-40 znaków, małe litery, cyfry, myślnik. Bez spacji." };
    }
    if (RESERVED_SLUGS.has(slug)) {
      return { error: `"${slug}" to zarezerwowany URL - wybierz inny.` };
    }
    if (!isTemplate(templateRaw)) {
      return { error: "Wybierz prawidłowy szablon." };
    }
    if (title.length > 80) return { error: "Tytuł zbyt długi (max 80)." };
    if (seed !== "scratch" && !seed.startsWith("copy:")) {
      return { error: "Nieprawidłowy tryb startowy strony." };
    }

    const template = templateRaw;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    let customization: ProfileCustomization = defaultCustomization(template);
    if (seed.startsWith("copy:")) {
      const sourceId = seed.slice("copy:".length).trim();
      if (!sourceId) return { error: "Brak ID strony źródłowej." };

      const { data: source, error: sourceErr } = await supabase
        .from("trainer_pages")
        .select("customization")
        .eq("id", sourceId)
        .eq("trainer_id", user.id)
        .maybeSingle();
      if (sourceErr) return { error: sourceErr.message };
      if (source?.customization) {
        customization = {
          ...(source.customization as ProfileCustomization),
          template,
        };
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
      if ((error as { code?: string }).code === "23505") {
        return { error: `Strona z URL-em "${slug}" już istnieje.` };
      }
      return { error: error.message };
    }
    if (!data?.id) return { error: "Nie udało się utworzyć strony." };

    revalidatePath("/studio/pages");
    revalidatePath("/studio/design");
    return { ok: true, data: { id: data.id }, id: data.id };
  } catch (err) {
    console.error("createTrainerPage", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function setPrimaryPage(id: string): Promise<ActionResult> {
  try {
    const pageId = validateId(id);
    if (typeof pageId !== "string") return pageId;

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
      .eq("id", pageId)
      .eq("trainer_id", user.id);
    if (setErr) return { error: setErr.message };

    revalidatePath("/studio/pages");
    revalidatePath("/studio/design");
    revalidatePath("/trainers/[id]", "page");
    return { ok: true };
  } catch (err) {
    console.error("setPrimaryPage", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function setPageStatus(
  id: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  try {
    const pageId = validateId(id);
    if (typeof pageId !== "string") return pageId;
    if (status !== "draft" && status !== "published") return { error: "Nieprawidłowy status strony." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    const { error } = await supabase
      .from("trainer_pages")
      .update({ status })
      .eq("id", pageId)
      .eq("trainer_id", user.id);
    if (error) return { error: error.message };

    revalidatePath("/studio/pages");
    revalidatePath("/trainers/[id]", "page");
    return { ok: true };
  } catch (err) {
    console.error("setPageStatus", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function deleteTrainerPage(id: string): Promise<ActionResult> {
  try {
    const pageId = validateId(id);
    if (typeof pageId !== "string") return pageId;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    const { data: page, error: readErr } = await supabase
      .from("trainer_pages")
      .select("is_primary")
      .eq("id", pageId)
      .eq("trainer_id", user.id)
      .maybeSingle();
    if (readErr) return { error: readErr.message };
    if (!page) return { error: "Strona nie istnieje." };
    if (page.is_primary) {
      return { error: "Nie można usunąć głównej strony - najpierw wybierz inną jako główną." };
    }

    const { error } = await supabase
      .from("trainer_pages")
      .delete()
      .eq("id", pageId)
      .eq("trainer_id", user.id);
    if (error) return { error: error.message };

    revalidatePath("/studio/pages");
    return { ok: true };
  } catch (err) {
    console.error("deleteTrainerPage", err);
    return { error: DEFAULT_ERROR };
  }
}

export async function createTrainerPageAndOpenEditor(formData: FormData): Promise<void> {
  let redirectTo: string;

  try {
    if (!(formData instanceof FormData)) {
      redirectTo = `/studio/pages/new?error=${encodeURIComponent("Nieprawidłowe dane formularza.")}`;
    } else {
      const res = await createTrainerPage(formData);
      if ("error" in res) {
        redirectTo = `/studio/pages/new?error=${encodeURIComponent(res.error)}`;
      } else {
        const dataId =
          typeof res.data === "object" && res.data !== null && "id" in res.data
            ? (res.data as { id?: unknown }).id
            : undefined;
        const id = typeof res.id === "string" ? res.id : dataId;
        if (typeof id !== "string" || !id) {
          redirectTo = `/studio/pages/new?error=${encodeURIComponent("Nie udało się utworzyć strony.")}`;
        } else {
          redirectTo = `/studio/design?page=${encodeURIComponent(id)}`;
        }
      }
    }
  } catch (err) {
    console.error("createTrainerPageAndOpenEditor", err);
    redirectTo = `/studio/pages/new?error=${encodeURIComponent(DEFAULT_ERROR)}`;
  }

  redirect(redirectTo);
}
