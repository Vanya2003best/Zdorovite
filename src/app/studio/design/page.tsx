import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProfileCustomization, SectionId, TemplateName } from "@/types";
import EditorClient from "./EditorClient";

const SECTION_IDS: SectionId[] = ["about", "services", "packages", "gallery", "certifications", "reviews"];

const DEFAULT_CUSTOMIZATION: ProfileCustomization = {
  template: "premium",
  accentColor: "#10b981",
  sections: SECTION_IDS.map((id) => ({ id, visible: true })),
  serviceLayout: "cards",
  galleryLayout: "grid",
};

function computeCompletion(t: {
  tagline: string | null;
  about: string | null;
  avatar_url: string | null;
  specs: number;
  services: number;
  packages: number;
  certifications: number;
  gallery: number;
}) {
  const checks = [
    { ok: !!t.tagline && t.tagline.trim().length >= 10, weight: 15, miss: "Dodaj tagline (min. 10 znaków)" },
    { ok: !!t.about && t.about.trim().length >= 80, weight: 20, miss: "Rozbuduj sekcję „O mnie” (min. 80 znaków)" },
    { ok: !!t.avatar_url, weight: 10, miss: "Dodaj zdjęcie profilowe" },
    { ok: t.specs >= 2, weight: 10, miss: "Wybierz min. 2 specjalizacje" },
    { ok: t.services >= 1, weight: 15, miss: "Dodaj pierwszą usługę" },
    { ok: t.packages >= 1, weight: 10, miss: "Dodaj pakiet długoterminowy" },
    { ok: t.gallery >= 3, weight: 10, miss: "Dodaj min. 3 zdjęcia do galerii" },
    { ok: t.certifications >= 1, weight: 10, miss: "Dodaj certyfikat" },
  ];
  const pct = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const firstMiss = checks.find((c) => !c.ok);
  const tip = pct >= 100 ? "Świetnie — profil jest kompletny!" : (firstMiss?.miss ?? "Uzupełnij brakujące pola.");
  return { pct, tip };
}

export default async function DesignDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/design");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug, published, tagline, about, location, rating, review_count, cover_image, customization")
    .eq("id", user.id)
    .maybeSingle();

  if (!trainer?.slug) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
        <p className="text-slate-500">Najpierw dokończ rejestrację jako trener.</p>
        <Link
          href="/register/trainer"
          className="inline-flex mt-4 h-10 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
        >
          Stań się trenerem →
        </Link>
      </div>
    );
  }

  const [
    { count: servicesCount },
    { count: packagesCount },
    { count: reviewsCount },
    { count: specsCount },
    { count: galleryCountRaw },
    { count: certificationsCountRaw },
    { data: services },
    { data: packages },
  ] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("trainer_specializations").select("specialization_id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("gallery_photos").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("certifications").select("id", { count: "exact", head: true }).eq("trainer_id", user.id),
    supabase.from("services").select("id, name, description, price, duration, position").eq("trainer_id", user.id).order("position"),
    supabase.from("packages").select("id, name, description, items, price, period, featured, position").eq("trainer_id", user.id).order("position"),
  ]);

  const galleryCount = galleryCountRaw ?? 0;
  const certificationsCount = certificationsCountRaw ?? 0;

  const completion = computeCompletion({
    tagline: trainer.tagline,
    about: trainer.about,
    avatar_url: profile?.avatar_url ?? null,
    specs: specsCount ?? 0,
    services: servicesCount ?? 0,
    packages: packagesCount ?? 0,
    certifications: certificationsCount,
    gallery: galleryCount,
  });

  // Hydrate customization with defaults + ensure all known sections present in saved order.
  const saved = (trainer.customization ?? {}) as Partial<ProfileCustomization>;
  const seen = new Set<SectionId>();
  const orderedSections = (saved.sections ?? [])
    .filter((s) => SECTION_IDS.includes(s.id) && !seen.has(s.id) && (seen.add(s.id), true))
    .map((s) => ({ id: s.id, visible: !!s.visible }));
  for (const id of SECTION_IDS) {
    if (!seen.has(id)) orderedSections.push({ id, visible: true });
  }
  const initial: ProfileCustomization = {
    template: (saved.template ?? DEFAULT_CUSTOMIZATION.template) as TemplateName,
    accentColor: saved.accentColor ?? DEFAULT_CUSTOMIZATION.accentColor,
    sections: orderedSections,
    serviceLayout: saved.serviceLayout ?? "cards",
    galleryLayout: saved.galleryLayout ?? "grid",
    coverImage: saved.coverImage,
  };

  const counts: Partial<Record<SectionId, number>> = {
    services: servicesCount ?? 0,
    packages: packagesCount ?? 0,
    gallery: galleryCount,
    certifications: certificationsCount,
    reviews: reviewsCount ?? 0,
  };

  return (
    <EditorClient
      slug={trainer.slug}
      trainerName={profile?.display_name ?? "Twój profil"}
      published={!!trainer.published}
      initial={initial}
      completion={completion}
      counts={counts}
      preview={{
        avatarUrl: profile?.avatar_url ?? null,
        coverImage: trainer.cover_image ?? null,
        tagline: trainer.tagline ?? null,
        about: trainer.about ?? null,
        location: trainer.location ?? null,
        rating: trainer.rating ?? null,
        reviewCount: trainer.review_count ?? null,
        services: (services ?? []).map((s) => ({
          id: s.id, name: s.name, description: s.description ?? "", price: s.price, duration: s.duration,
        })),
        packages: (packages ?? []).map((p) => ({
          id: p.id, name: p.name, description: p.description ?? "", items: p.items ?? [],
          price: p.price, period: p.period ?? undefined, featured: !!p.featured,
        })),
      }}
    />
  );
}
