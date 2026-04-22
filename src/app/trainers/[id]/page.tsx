import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { trainers } from "@/data/mock-trainers";
import { templates } from "@/data/templates";
import { getSpecLabel, getSpecIcon } from "@/data/specializations";
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
            styles={s}
          />
        );
      case "packages":
        return (
          <PackagesSection
            key="packages"
            packages={trainer.packages}
            styles={s}
          />
        );
      case "gallery":
        return (
          <GallerySection
            key="gallery"
            gallery={trainer.gallery}
            styles={s}
          />
        );
      case "certifications":
        return (
          <CertificationsSection
            key="certifications"
            certifications={trainer.certifications}
            styles={s}
          />
        );
      case "reviews":
        return (
          <ReviewsSection
            key="reviews"
            reviews={trainer.reviews}
            styles={s}
          />
        );
      default:
        return null;
    }
  }

  const isSport = s.name === "sport";
  const isCozy = s.name === "cozy";
  const isPremium = s.name === "premium";

  return (
    <div className={`min-h-screen ${s.pageBg}`}>
      <div className={`mx-auto max-w-2xl ${isPremium ? "px-4 py-8" : ""}`}>
        {/* Back link — outside card for premium, inside for others */}
        {isPremium && (
          <Link
            href="/trainers"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-emerald-600 transition mb-6"
          >
            &larr; Wszyscy trenerzy
          </Link>
        )}

        {/* Profile card */}
        <div
          className={`overflow-hidden ${
            isPremium
              ? "rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 ring-1 ring-black/5 shadow-xl shadow-black/5"
              : ""
          }`}
        >
          {/* Cover */}
          <div className={`${s.coverBg} ${s.coverHeight}`}>
            {isSport && (
              <>
                <img
                  src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=400&fit=crop"
                  alt=""
                  className="w-full h-full object-cover opacity-50"
                />
                <div className={s.coverOverlay} />
                <span className="absolute top-4 left-4 px-2.5 py-1 rounded-sm bg-lime-400 text-[#020617] text-[10px] font-extrabold uppercase tracking-[0.12em]">
                  💪 PERFORMANCE
                </span>
              </>
            )}
            {isCozy && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-8 bg-[#fdf6ec] rounded-t-[32px]" />
            )}
          </div>

          {/* Hero */}
          <div
            className={`${
              isSport ? "px-6 pb-5" : isCozy ? "px-6" : isPremium ? "px-7" : "px-7"
            } -mt-9 relative z-10`}
          >
            <div className={s.avatarStyle + " overflow-hidden"}>
              <Image
                src={trainer.avatar}
                alt={trainer.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>

            <h1 className={`mt-3.5 ${s.nameStyle}`}>
              {isSport ? (
                <>
                  {trainer.name.split(" ")[0]}
                  <br />
                  {trainer.name.split(" ").slice(1).join(" ")}
                </>
              ) : (
                trainer.name
              )}
            </h1>

            <p className={`mt-0.5 ${s.tagStyle}`}>
              {isSport
                ? trainer.specializations
                    .map((sp) => getSpecLabel(sp))
                    .join(" · ")
                : trainer.tagline}
            </p>

            <div className={`mt-3 flex flex-wrap gap-3.5 ${s.metaStyle}`}>
              {isSport ? (
                <>
                  <span className="text-lime-400">
                    ★ {trainer.rating} · {trainer.reviewCount}
                  </span>
                  <span>{trainer.location}</span>
                  <span>{trainer.experience} lat</span>
                </>
              ) : isCozy ? (
                <>
                  <span>
                    ⭐ <strong className="text-[#2d2418] font-semibold">{trainer.rating}</strong> ({trainer.reviewCount})
                  </span>
                  <span>📍 {trainer.location}</span>
                  <span>🌱 {trainer.experience} lat</span>
                </>
              ) : (
                <>
                  <span>★ {trainer.rating} · {trainer.reviewCount}</span>
                  <span>{trainer.location}</span>
                  <span>{trainer.experience} lat</span>
                </>
              )}
            </div>

            {isPremium && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {trainer.specializations.map((spec) => (
                  <span
                    key={spec}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                  >
                    <span>{getSpecIcon(spec)}</span>
                    {getSpecLabel(spec)}
                  </span>
                ))}
              </div>
            )}

            {(s.name === "minimal" || isPremium) && (
              <div
                className={`mt-4 pb-4 ${
                  s.name === "minimal" ? "border-b border-slate-200" : ""
                }`}
              />
            )}
          </div>

          {/* Sections */}
          {visibleSections.map((sec) => renderSection(sec.id))}

          {/* CTA Bar */}
          <div className={s.ctaBarStyle}>
            <div className={s.ctaPriceStyle}>
              {isSport ? "OD " : "od "}
              <strong className={s.ctaPriceBoldStyle}>
                {trainer.priceFrom} {isSport ? "ZŁ" : "zł"}
              </strong>
            </div>
            <button className={s.ctaButtonStyle}>{s.ctaButtonText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
