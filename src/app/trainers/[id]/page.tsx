import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { trainers } from "@/data/mock-trainers";
import { templates } from "@/data/templates";
import { getSpecLabel, getSpecIcon } from "@/data/specializations";
import StarRating from "@/components/StarRating";
import AboutSection from "@/components/sections/AboutSection";
import ServicesSection from "@/components/sections/ServicesSection";
import PackagesSection from "@/components/sections/PackagesSection";
import CertificationsSection from "@/components/sections/CertificationsSection";
import GallerySection from "@/components/sections/GallerySection";
import ReviewsSection from "@/components/sections/ReviewsSection";
import { SectionId } from "@/types";

export function generateStaticParams() {
  return trainers.map((t) => ({ id: t.id }));
}

export default async function TrainerProfilePage(
  props: PageProps<"/trainers/[id]">
) {
  const { id } = await props.params;
  const found = trainers.find((t) => t.id === id);

  if (!found) {
    notFound();
  }

  const trainer = found;
  const c = trainer.customization;
  const s = templates[c.template];
  const accent = c.accentColor;

  const visibleSections = c.sections.filter((sec) => sec.visible);

  function renderSection(sectionId: SectionId) {
    switch (sectionId) {
      case "about":
        return <AboutSection key="about" about={trainer.about} styles={s} />;
      case "services":
        return (
          <ServicesSection
            key="services"
            services={trainer.services}
            layout={c.serviceLayout}
            styles={s}
            accentColor={accent}
          />
        );
      case "packages":
        return (
          <PackagesSection
            key="packages"
            packages={trainer.packages}
            styles={s}
            accentColor={accent}
          />
        );
      case "gallery":
        return (
          <GallerySection
            key="gallery"
            gallery={trainer.gallery}
            layout={c.galleryLayout}
            styles={s}
          />
        );
      case "certifications":
        return (
          <CertificationsSection
            key="certifications"
            certifications={trainer.certifications}
            styles={s}
            accentColor={accent}
          />
        );
      case "reviews":
        return (
          <ReviewsSection
            key="reviews"
            reviews={trainer.reviews}
            styles={s}
            accentColor={accent}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className={`min-h-screen ${s.pageBg}`}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Back */}
        <Link
          href="/trainers"
          className={`inline-flex items-center gap-1 text-sm ${s.mutedColor} hover:opacity-80 transition mb-6`}
        >
          &larr; Wszyscy trenerzy
        </Link>

        {/* Cover */}
        {c.coverImage && (
          <div
            className={`relative mb-6 h-48 overflow-hidden ${s.rounded} sm:h-64`}
          >
            <Image
              src={c.coverImage}
              alt="Cover"
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Profile header */}
        <div
          className={`${s.rounded} ${s.headerBg} ${s.headerBorder} ${s.headerShadow} p-6 sm:p-8`}
        >
          <div className="flex flex-col gap-6 sm:flex-row">
            <div
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-200"
              style={{ borderColor: accent, boxShadow: `0 0 0 3px ${accent}33` }}
            >
              <Image
                src={trainer.avatar}
                alt={trainer.name}
                fill
                className="object-cover"
              />
            </div>

            <div className="flex-1">
              <h1
                className={`text-2xl font-bold sm:text-3xl ${s.headingColor}`}
              >
                {trainer.name}
              </h1>
              <p className={`mt-1 ${s.textColor}`}>{trainer.tagline}</p>

              <div
                className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${s.mutedColor}`}
              >
                <span className="flex items-center gap-1">
                  <StarRating rating={trainer.rating} size="sm" />
                  <span className={`font-medium ${s.headingColor}`}>
                    {trainer.rating}
                  </span>
                  <span>({trainer.reviewCount} opinii)</span>
                </span>
                <span>{trainer.location}</span>
                <span>{trainer.experience} lat doświadczenia</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {trainer.specializations.map((spec) => (
                  <span
                    key={spec}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badgeBg} ${s.badgeText}`}
                  >
                    <span>{getSpecIcon(spec)}</span>
                    {getSpecLabel(spec)}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {trainer.languages.map((lang) => (
                  <span
                    key={lang}
                    className={`rounded-md px-2 py-0.5 text-xs ${s.badgeBg} ${s.mutedColor}`}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="mt-8 space-y-10">
          {visibleSections.map((sec) => renderSection(sec.id))}
        </div>

        {/* CTA */}
        <section
          className={`mt-10 ${s.rounded} ${s.ctaBg} ${s.ctaBorder} p-6 text-center`}
        >
          <h2 className={`text-lg font-bold ${s.ctaText}`}>
            Chcesz trenować z {trainer.name.split(" ")[0]}?
          </h2>
          <p className={`mt-2 text-sm ${s.textColor}`}>
            Napisz wiadomość, żeby umówić się na pierwszy trening
          </p>
          <button
            className={`mt-4 ${s.rounded} px-6 py-3 text-sm font-semibold transition hover:opacity-90`}
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            Napisz wiadomość
          </button>
        </section>
      </div>
    </div>
  );
}
