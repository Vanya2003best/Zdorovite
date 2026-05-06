import { createClient } from "@/lib/supabase/server";

export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  /** "required" = blocks publishing; "recommended" = visible polish; "optional" = nice-to-have */
  tier: "required" | "recommended" | "optional";
};

export type ChecklistState = {
  items: ChecklistItem[];
  doneCount: number;
  totalCount: number;
  percent: number;
  /** True only when EVERY required item is done — drives the publish gate
   *  + lets us hide the onboarding banner once the floor is met. */
  readyToPublish: boolean;
  trainerSlug: string | null;
};

/**
 * Derives the trainer's onboarding completion state from existing tables —
 * no separate `onboarding_state` column needed. Each item resolves from a
 * targeted COUNT/SELECT, so the page renders against the same source of
 * truth as the editors that fill it. Idempotent — running twice gives the
 * same answer; safe to call from page server-render every request.
 */
export async function computeOnboarding(userId: string): Promise<ChecklistState> {
  const supabase = await createClient();

  // Bundle all reads into Promise.all — page already pays the connection
  // cost once per render, no need to serialise these.
  const [
    profileRes,
    trainerRes,
    servicesCount,
    realServicesCount,
    packagesCount,
    certsCount,
    galleryCount,
    specsCount,
    availabilityCount,
    branchesCount,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("trainers")
      .select("slug, tagline, about, location, customization")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", userId),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", userId)
      .eq("is_placeholder", false),
    supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", userId),
    supabase
      .from("certifications")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", userId),
    supabase
      .from("gallery_photos")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", userId),
    supabase
      .from("trainer_specializations")
      .select("specialization_id", { count: "exact", head: true })
      .eq("trainer_id", userId),
    supabase
      .from("availability_rules")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", userId),
    // Tolerant to migration 021 not being applied — null/error is fine.
    supabase
      .from("trainer_branches")
      .select("trainer_id", { count: "exact", head: true })
      .eq("trainer_id", userId),
  ]);

  const profile = profileRes.data;
  const trainer = trainerRes.data;
  const customization = (trainer?.customization ?? {}) as { template?: string; ai_context?: Record<string, unknown> };
  const aiCtx = (trainer && (trainer as { ai_context?: Record<string, unknown> }).ai_context) || {};
  const aiCtxFilled = Object.values(aiCtx).filter((v) => typeof v === "string" && v.trim().length > 0).length;

  const tagline = trainer?.tagline?.trim() ?? "";
  const about = trainer?.about?.trim() ?? "";

  const items: ChecklistItem[] = [
    {
      id: "tagline",
      label: "Krótki opis (tagline)",
      description: "Jedno zdanie, które klient zobaczy pierwszą rzecz na profilu. Min. 10 znaków.",
      href: "/studio/design",
      done: tagline.length >= 10,
      tier: "required",
    },
    {
      id: "about",
      label: 'Sekcja „O mnie"',
      description: "Min. 80 znaków. Możesz wygenerować z AI po wypełnieniu kontekstu poniżej.",
      href: "/studio/design",
      done: about.length >= 80,
      tier: "required",
    },
    {
      id: "service",
      label: "Pierwsza usługa",
      description: "Co najmniej jedna usługa z prawdziwą nazwą i ceną (nie placeholder).",
      href: "/studio/design",
      done: (realServicesCount.count ?? 0) >= 1,
      tier: "required",
    },
    {
      id: "certification",
      label: "Certyfikat lub dyplom",
      description: "Wymagane do publikacji. Dodaj tytuł + opcjonalnie link weryfikacyjny.",
      href: "/studio/profile",
      done: (certsCount.count ?? 0) >= 1,
      tier: "required",
    },
    {
      id: "avatar",
      label: "Zdjęcie profilowe",
      description: "Klient widzi je na liście trenerów + w hero. Drag-pan do dopasowania kadru.",
      href: "/studio/profile",
      done: !!profile?.avatar_url,
      tier: "recommended",
    },
    {
      id: "ai_context",
      label: "Kontekst dla AI",
      description: "5 pól (background, target audience, methodology…) — używane przez każdy generator AI na profilu.",
      href: "/studio/profile",
      done: aiCtxFilled >= 3,
      tier: "recommended",
    },
    {
      id: "specializations",
      label: "Specjalizacje",
      description: "Min. 2 specjalizacje. Bez nich profil nie pojawia się w filtrach katalogu.",
      href: "/studio/design",
      done: (specsCount.count ?? 0) >= 2,
      tier: "recommended",
    },
    {
      id: "availability",
      label: "Godziny pracy",
      description: "Bez harmonogramu klient nie zobaczy wolnych terminów do bookingu.",
      href: "/studio/availability",
      done: (availabilityCount.count ?? 0) >= 1,
      tier: "recommended",
    },
    {
      id: "package",
      label: "Pierwszy pakiet",
      description: "Pakiety są ważniejsze finansowo niż pojedyncze sesje — większy LTV klienta.",
      href: "/studio/design",
      done: (packagesCount.count ?? 0) >= 1,
      tier: "recommended",
    },
    {
      id: "gallery",
      label: "Galeria zdjęć",
      description: "Min. 3 zdjęcia z treningów / studia. Dramatycznie zwiększa konwersję.",
      href: "/studio/design",
      done: (galleryCount.count ?? 0) >= 3,
      tier: "recommended",
    },
    {
      id: "template",
      label: "Wybrany szablon profilu",
      description: "6 szablonów do wyboru — Premium, Cozy, Cinematic, Luxury, Studio, Signature.",
      href: "/studio/design",
      done: !!customization.template && customization.template !== "premium",
      tier: "optional",
    },
    {
      id: "branch",
      label: "Klub / sieć",
      description: "Zgłoś afiliację z klubem (Zdrofit, Calypso…) — klub potwierdza i pojawiasz się w jego rosterze.",
      href: "/sieci",
      done: (branchesCount.count ?? 0) >= 1,
      tier: "optional",
    },
  ];

  // For "service" we count services >=1 but the description says non-placeholder.
  // Adjust: if there are services but none real, mark as undone.
  const serviceItem = items.find((i) => i.id === "service");
  if (serviceItem && (servicesCount.count ?? 0) > 0 && (realServicesCount.count ?? 0) === 0) {
    serviceItem.description += " Edytuj któryś placeholder — zmień nazwę i cenę na własne.";
  }

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const percent = Math.round((doneCount / totalCount) * 100);
  const requiredItems = items.filter((i) => i.tier === "required");
  const readyToPublish = requiredItems.every((i) => i.done);

  return {
    items,
    doneCount,
    totalCount,
    percent,
    readyToPublish,
    trainerSlug: trainer?.slug ?? null,
  };
}
