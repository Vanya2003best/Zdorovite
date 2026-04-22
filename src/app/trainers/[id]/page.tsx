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

function PremiumProfile({ trainer }: { trainer: (typeof trainers)[number] }) {
  const c = trainer.customization;
  const visibleSections = c.sections.filter((sec) => sec.visible);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Cover photo */}
      <div className="relative h-[220px] sm:h-[280px]">
        <img
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=500&fit=crop"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/25" />
        {/* Floating nav buttons */}
        <div className="absolute top-4 left-3.5 right-3.5 flex justify-between sm:hidden">
          <Link
            href="/trainers"
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-900"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-900">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
            </button>
            <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-900">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" /></svg>
            </button>
          </div>
        </div>
        {/* Desktop back */}
        <div className="hidden sm:block absolute top-6 left-6">
          <Link
            href="/trainers"
            className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white transition bg-black/20 backdrop-blur-sm rounded-lg px-3 py-1.5"
          >
            &larr; Wszyscy trenerzy
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3.5 sm:px-6">
        {/* Glass hero card */}
        <div className="-mt-[70px] relative z-10 bg-white/80 backdrop-blur-xl backdrop-saturate-150 border border-white/70 rounded-[22px] p-4.5 sm:p-6 shadow-[0_20px_40px_-16px_rgba(2,6,23,0.16)]">
          <div className="flex gap-3.5">
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden border-[3px] border-white shadow-sm shrink-0">
              <Image
                src={trainer.avatar}
                alt={trainer.name}
                width={72}
                height={72}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
                {trainer.name}
              </h1>
              <p className="text-[13px] text-slate-600 leading-snug">
                {trainer.tagline.split("—")[0].trim()}, {trainer.experience} lat doświadczenia
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              <strong className="text-slate-900">{trainer.rating}</strong> · {trainer.reviewCount}
            </span>
            <span>📍 {trainer.location}</span>
            <span>🌐 {trainer.languages.join(" · ")}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {trainer.specializations.map((spec) => (
              <span
                key={spec}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white/90 border border-emerald-500/25 text-emerald-700 font-medium"
              >
                {getSpecIcon(spec)} {getSpecLabel(spec)}
              </span>
            ))}
          </div>
        </div>

        {/* Sticky tabs — mobile */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-lg border-b border-slate-200 flex gap-1 px-3.5 py-3 overflow-x-auto scrollbar-hide mt-6 -mx-3.5 sm:hidden">
          {visibleSections.map((sec, i) => {
            const labels: Record<SectionId, string> = {
              about: "O mnie",
              services: "Usługi",
              packages: "Pakiety",
              gallery: "Galeria",
              certifications: "Certyfikaty",
              reviews: "Opinie",
            };
            return (
              <span
                key={sec.id}
                className={`shrink-0 px-3.5 py-2 rounded-[9px] text-[13px] font-medium ${
                  i === 0
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                {labels[sec.id]}
              </span>
            );
          })}
        </div>

        {/* About section — premium style */}
        <section className="px-0 py-5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
            O mnie
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 mt-1.5 mb-3.5">
            Filozofia pracy
          </h2>
          <div className="bg-white/75 backdrop-blur-sm border border-white/70 rounded-2xl p-4.5 text-sm text-slate-700 leading-relaxed">
            {trainer.about}
            <div className="grid grid-cols-2 gap-3 mt-3.5 pt-3.5 border-t border-slate-200">
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  {trainer.experience}+
                </div>
                <div className="text-[11px] text-slate-500">
                  Lat doświadczenia
                </div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  {trainer.reviewCount * 7}
                </div>
                <div className="text-[11px] text-slate-500">Klientów</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  {trainer.rating}★
                </div>
                <div className="text-[11px] text-slate-500">
                  {trainer.reviewCount} opinii
                </div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">2h</div>
                <div className="text-[11px] text-slate-500">
                  Średni response
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="py-5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
            Usługi
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 mt-1.5 mb-3.5">
            Pojedyncze sesje
          </h2>
          <div className="space-y-2.5">
            {trainer.services.map((svc) => (
              <div
                key={svc.name}
                className="bg-white border border-slate-200 rounded-[14px] p-4"
              >
                <div className="flex justify-between items-baseline">
                  <div className="text-[15px] font-semibold text-slate-900">
                    {svc.name}
                  </div>
                  <div className="text-[15px] font-semibold text-emerald-700">
                    {svc.price} zł
                  </div>
                </div>
                <div className="text-[13px] text-slate-600 leading-snug mt-1">
                  {svc.description}
                </div>
                <div className="flex gap-2.5 mt-2 text-[11px] text-slate-500">
                  {svc.duration > 0 && <span>⏱ {svc.duration} min</span>}
                  <span>📍 Sala</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Packages — horizontal scroll on mobile */}
        <section className="py-5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
            Pakiety
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 mt-1.5 mb-3.5">
            Zaplanuj transformację
          </h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-3.5 px-3.5 pb-3 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:mx-0 sm:px-0 sm:overflow-visible">
            {trainer.packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`shrink-0 w-[280px] sm:w-auto snap-start flex flex-col gap-3 rounded-[18px] p-5 relative ${
                  pkg.featured
                    ? "border border-emerald-300 bg-gradient-to-b from-white to-emerald-50 shadow-[0_16px_32px_-12px_rgba(16,185,129,0.25)]"
                    : "bg-white/85 backdrop-blur-sm border border-white/70"
                }`}
              >
                {pkg.featured && (
                  <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-[0.06em]">
                    ⭐ Popularne
                  </span>
                )}
                <div className="text-sm text-emerald-700 font-semibold">
                  {pkg.name}
                </div>
                <div className="text-[26px] font-semibold tracking-tight text-slate-900">
                  {pkg.price.toLocaleString("pl-PL")} zł{" "}
                  {pkg.period && (
                    <span className="text-xs text-slate-500 font-normal">
                      / {pkg.period}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1">
                  {pkg.items.map((item) => (
                    <li
                      key={item}
                      className="text-[13px] text-slate-700 flex items-start gap-2"
                    >
                      <span className="text-emerald-600 font-bold shrink-0">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
                    pkg.featured
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:opacity-90"
                      : "bg-white text-slate-900 border border-slate-200 hover:border-slate-400"
                  }`}
                >
                  Wybierz
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Certifications */}
        {trainer.certifications.length > 0 && (
          <section className="py-5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
              Certyfikaty
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 mt-1.5 mb-3.5">
              Kwalifikacje
            </h2>
            <ul className="space-y-2">
              {trainer.certifications.map((cert) => (
                <li
                  key={cert}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  {cert}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reviews */}
        <section className="py-5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
            Opinie
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 mt-1.5 mb-3.5">
            {trainer.rating} ★ · {trainer.reviewCount} opinie
          </h2>
          <div className="space-y-2.5">
            {trainer.reviews.map((review) => {
              const dateFormatted = new Date(review.date).toLocaleDateString(
                "pl-PL",
                { day: "numeric", month: "long" }
              );
              return (
                <div
                  key={review.id}
                  className="bg-white border border-slate-200 rounded-[14px] p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-[34px] h-[34px] rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 overflow-hidden">
                      {review.authorName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">
                        {review.authorName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {dateFormatted}
                      </div>
                    </div>
                  </div>
                  <div className="text-amber-400 text-xs mt-1.5">★★★★★</div>
                  <p className="text-[13px] text-slate-700 leading-relaxed mt-2">
                    {review.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Spacer for sticky CTA */}
        <div className="h-24 sm:hidden" />
      </div>

      {/* Sticky bottom CTA — mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3.5 py-3 pb-5 grid grid-cols-[auto_1fr] gap-3 items-center sm:hidden">
        <div className="text-[13px] text-slate-500">
          od
          <strong className="block text-lg font-semibold text-slate-900">
            {trainer.priceFrom} zł
          </strong>
        </div>
        <button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl py-3.5 px-5 text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
          Zarezerwuj sesję
        </button>
      </div>

      {/* Desktop CTA — bottom of page */}
      <div className="hidden sm:block mx-auto max-w-2xl px-6 pb-8">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-white">
            Chcesz trenować z {trainer.name.split(" ")[0]}?
          </h2>
          <p className="mt-2 text-sm text-emerald-100">
            Napisz wiadomość, żeby umówić się na pierwszy trening
          </p>
          <button className="mt-4 bg-white text-emerald-700 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg hover:bg-emerald-50 transition">
            Napisz wiadomość
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateProfile({ trainer }: { trainer: (typeof trainers)[number] }) {
  const c = trainer.customization;
  const s = templates[c.template];
  const visibleSections = c.sections.filter((sec) => sec.visible);

  const isSport = s.name === "sport";
  const isCozy = s.name === "cozy";

  function renderSection(sectionId: SectionId) {
    switch (sectionId) {
      case "about":
        return <AboutSection key="about" about={trainer.about} styles={s} />;
      case "services":
        return (
          <ServicesSection key="services" services={trainer.services} styles={s} />
        );
      case "packages":
        return (
          <PackagesSection key="packages" packages={trainer.packages} styles={s} />
        );
      case "gallery":
        return (
          <GallerySection key="gallery" gallery={trainer.gallery} styles={s} />
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
          <ReviewsSection key="reviews" reviews={trainer.reviews} styles={s} />
        );
      default:
        return null;
    }
  }

  return (
    <div className={`min-h-screen ${s.pageBg}`}>
      <div className="mx-auto max-w-2xl">
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
        <div className={`${isSport ? "px-6 pb-5" : "px-6"} -mt-9 relative z-10`}>
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
              ? trainer.specializations.map((sp) => getSpecLabel(sp)).join(" · ")
              : trainer.tagline}
          </p>

          <div className={`mt-3 flex flex-wrap gap-3.5 ${s.metaStyle}`}>
            {isSport ? (
              <>
                <span className="text-lime-400">★ {trainer.rating} · {trainer.reviewCount}</span>
                <span>{trainer.location}</span>
                <span>{trainer.experience} lat</span>
              </>
            ) : isCozy ? (
              <>
                <span>⭐ <strong className="text-[#2d2418] font-semibold">{trainer.rating}</strong> ({trainer.reviewCount})</span>
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

          {s.name === "minimal" && (
            <div className="mt-4 pb-4 border-b border-slate-200" />
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
  );
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

  if (trainer.customization.template === "premium") {
    return <PremiumProfile trainer={trainer} />;
  }

  return <TemplateProfile trainer={trainer} />;
}
