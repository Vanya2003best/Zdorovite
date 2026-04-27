import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { getAvailableSlots } from "@/lib/db/availability";
import { isFavorite as queryIsFavorite } from "@/lib/db/favorites";
import { warsawDateOffset } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Trainer, Service } from "@/types";
import { templates } from "@/data/templates";
import { getSpecLabel, getSpecIcon } from "@/data/specializations";
import AboutSection from "@/components/sections/AboutSection";
import ServicesSection from "@/components/sections/ServicesSection";
import PackagesSection from "@/components/sections/PackagesSection";
import CertificationsSection from "@/components/sections/CertificationsSection";
import GallerySection from "@/components/sections/GallerySection";
import ReviewsSection from "@/components/sections/ReviewsSection";
import BookingSidebar from "./BookingSidebar";
import EditableText from "@/components/EditableText";
import EditModeBar from "./EditModeBar";
import EditProfileFab from "./EditProfileFab";
import FavoriteButton from "./FavoriteButton";
import InlineServicesEditor from "./InlineServicesEditor";
import InlinePackagesEditor from "./InlinePackagesEditor";
import CinematicProfile from "./CinematicProfile";
import { SectionId } from "@/types";

/* ================================================================
   PREMIUM TEMPLATE — full desktop + mobile design
   ================================================================ */
async function PremiumProfile({
  trainer,
  trainerDbId,
  editMode,
  isOwner,
  published,
  initialIsFavorite,
  needsLoginToFavorite,
}: {
  trainer: Trainer;
  trainerDbId: string | undefined;
  editMode: boolean;
  isOwner: boolean;
  published: boolean;
  initialIsFavorite: boolean;
  needsLoginToFavorite: boolean;
}) {
  const initialDate = warsawDateOffset(0);
  const initialSlots = trainerDbId && !editMode ? await getAvailableSlots(trainerDbId, initialDate) : [];
  const servicesWithIds = trainer.services.filter((s): s is Service & { id: string } => !!s.id);
  const isEmbed = (await headers()).get("x-embed") === "1";
  const c = trainer.customization;
  const visibleSections = c.sections.filter((sec) => sec.visible);
  const sectionLabels: Record<SectionId, string> = {
    about: "O mnie",
    services: "Usługi",
    packages: "Pakiety",
    gallery: "Galeria",
    certifications: "Certyfikaty",
    reviews: "Opinie",
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(800px_400px_at_10%_-10%,rgba(16,185,129,0.08),transparent_60%),radial-gradient(600px_400px_at_100%_0%,rgba(20,184,166,0.06),transparent_60%),linear-gradient(180deg,#f8fafc_0%,#ffffff_35%)]">
      {editMode && <EditModeBar slug={trainer.id} published={published} />}
      {isOwner && !editMode && <EditProfileFab slug={trainer.id} />}
      <div className="mx-auto max-w-[1200px] px-3.5 sm:px-6">

        {/* Breadcrumbs — desktop only, hidden in iframe preview */}
        {!isEmbed && (
          <nav className="hidden sm:flex items-center gap-1.5 text-[13px] text-slate-500 py-5">
            <Link href="/" className="hover:text-slate-900 transition">Strona główna</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            <Link href="/trainers" className="hover:text-slate-900 transition">Trenerzy</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            <span className="text-slate-900">{trainer.name}</span>
          </nav>
        )}

        {/* Cover — mobile full-width, desktop rounded */}
        <div className="relative h-[220px] sm:h-[280px] sm:rounded-3xl overflow-hidden sm:border sm:border-white/60 sm:shadow-[0_20px_48px_-20px_rgba(2,6,23,0.15)] -mx-3.5 sm:mx-0">
          <img
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=2000&h=600&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35" />
          {/* Floating buttons — visible on mobile, also pinned top-right on desktop for the heart. */}
          <div className="absolute top-4 left-3.5 right-3.5 flex justify-between sm:hidden">
            <Link href="/trainers" className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <div className="flex gap-2">
              <button className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
              </button>
              {!isOwner && (
                <FavoriteButton
                  slug={trainer.id}
                  initialIsFavorite={initialIsFavorite}
                  needsLogin={needsLoginToFavorite}
                />
              )}
            </div>
          </div>
          {/* Desktop heart — top-right of cover */}
          {!isOwner && (
            <div className="hidden sm:block absolute top-5 right-5">
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-11 h-11 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 shadow-[0_4px_14px_rgba(2,6,23,0.06)] hover:bg-white transition disabled:opacity-70"
                size={18}
              />
            </div>
          )}
        </div>

        {/* Hero card — glass, overlapping cover */}
        <div className="-mt-[70px] sm:-mt-20 relative z-10 bg-white/75 backdrop-blur-2xl backdrop-saturate-[1.4] border border-white/70 rounded-[22px] sm:rounded-3xl p-4.5 sm:p-7 shadow-[0_30px_60px_-24px_rgba(2,6,23,0.18)]">
          {/* Mobile: stacked, Desktop: 3-col grid */}
          <div className="sm:grid sm:grid-cols-[180px_1fr_220px] sm:gap-7 sm:items-center">
            {/* Avatar */}
            <div className="flex sm:block gap-3.5">
              <div className="w-[72px] h-[72px] sm:w-[180px] sm:h-[180px] rounded-2xl sm:rounded-3xl overflow-hidden border-[3px] sm:border-4 border-white shadow-lg shrink-0">
                <Image src={trainer.avatar} alt={trainer.name} width={180} height={180} className="w-full h-full object-cover" />
              </div>
              {/* Mobile name — next to avatar */}
              <div className="sm:hidden">
                <h1 className="text-[22px] font-semibold tracking-tight">{trainer.name}</h1>
                <p className="text-[13px] text-slate-600 leading-snug">
                  {editMode ? (
                    <EditableText field="tagline" initial={trainer.tagline} multiline maxLength={200} placeholder="Twój tagline..." />
                  ) : (
                    trainer.tagline.split("—")[0].trim()
                  )}
                </p>
              </div>
            </div>

            {/* Info */}
            <div>
              {/* Desktop name */}
              <h1 className="hidden sm:block text-4xl font-semibold tracking-tight">{trainer.name}</h1>
              <p className="hidden sm:block text-base text-slate-600 leading-relaxed mt-1.5 max-w-[580px]">
                {editMode ? (
                  <EditableText field="tagline" initial={trainer.tagline} multiline maxLength={200} placeholder="Twój tagline..." />
                ) : (
                  trainer.tagline
                )}
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-5 mt-3 sm:mt-3.5 text-[13px] text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  <strong className="text-slate-900">{trainer.rating}</strong> · {trainer.reviewCount} opinii
                </span>
                <span className="inline-flex items-center gap-1.5">
                  📍{" "}
                  {editMode ? (
                    <EditableText field="location" initial={trainer.location} maxLength={100} placeholder="Miasto, dzielnica" />
                  ) : (
                    trainer.location
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">🌐 {trainer.languages.join(" · ")}</span>
                <span className="inline-flex items-center gap-1.5">⚡ &lt;2h</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {trainer.specializations.map((spec) => (
                  <span key={spec} className="text-xs px-2.5 py-1 rounded-full bg-white/90 border border-emerald-500/20 text-emerald-700 font-medium">
                    {getSpecIcon(spec)} {getSpecLabel(spec)}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions — desktop only in hero. In edit mode: price editor instead of booking. */}
            {editMode ? (
              <div className="hidden sm:flex flex-col gap-2.5 min-w-[220px] bg-emerald-50/40 border-2 border-dashed border-emerald-300 rounded-xl p-4">
                <span className="text-[11px] uppercase tracking-[0.06em] text-emerald-800 font-semibold">Ustawienia</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-slate-500">Cena od</span>
                  <span className="text-2xl font-semibold tracking-tight">
                    <EditableText field="price_from" initial={String(trainer.priceFrom)} type="number" min={0} max={10000} className="w-24 text-right" />
                    {" zł"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-slate-500">Lata doświadczenia</span>
                  <span className="text-2xl font-semibold tracking-tight">
                    <EditableText field="experience" initial={String(trainer.experience)} type="number" min={0} max={60} className="w-16 text-right" />
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug mt-1">
                  Tu klient widzi przycisk rezerwacji i kontaktu.
                </p>
              </div>
            ) : (
              <div className="hidden sm:flex flex-col gap-2.5 min-w-[220px]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-slate-500">od</span>
                  <span className="text-2xl font-semibold tracking-tight">{trainer.priceFrom} zł <span className="text-[13px] text-slate-500 font-normal">/ sesja</span></span>
                </div>
                <Link href={`/trainers/${trainer.id}/book`} className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-base font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105 transition inline-flex items-center justify-center">
                  Zarezerwuj sesję
                </Link>
                {trainerDbId && (
                  <Link href={`/account/messages?with=${trainerDbId}`} className="w-full flex items-center justify-center gap-2.5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    Napisz wiadomość
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky section nav */}
      <nav className="sticky top-16 z-20 bg-white/85 backdrop-blur-lg border-b border-slate-200 mt-6 sm:mt-8 overflow-x-auto scrollbar-hide">
        <div className="mx-auto max-w-[1200px] px-3.5 sm:px-6 flex items-center gap-1 h-14">
          {visibleSections.map((sec, i) => (
            <span key={sec.id} className={`shrink-0 px-3.5 py-2 rounded-[9px] text-sm font-medium transition cursor-pointer ${i === 0 ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}>
              {sectionLabels[sec.id]}
            </span>
          ))}
        </div>
      </nav>

      {/* Content: main + sidebar */}
      <div className="mx-auto max-w-[1200px] px-3.5 sm:px-6 sm:grid sm:grid-cols-[1fr_340px] sm:gap-10 py-8 sm:py-10">
        <div>
          {/* About */}
          <section className="mb-12">
            <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">O mnie</span>
            <h2 className="text-[32px] font-semibold tracking-tight mt-2 mb-5">Filozofia pracy</h2>
            <div className="bg-white/75 backdrop-blur-lg border border-white/70 rounded-[20px] p-5 sm:p-7 shadow-sm">
              <p className="text-[15px] text-slate-700 leading-[1.65]">
                {editMode ? (
                  <EditableText field="about" initial={trainer.about} multiline maxLength={3000} placeholder="Opowiedz o sobie, swoim podejściu i wynikach klientów..." />
                ) : (
                  trainer.about
                )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mt-5 pt-5 border-t border-slate-200">
                {[
                  { val: `${trainer.experience}+`, lab: "Lat doświadczenia" },
                  { val: `${trainer.reviewCount * 7}`, lab: "Klientów" },
                  { val: `${trainer.rating}★`, lab: `${trainer.reviewCount} opinii` },
                  { val: "2h", lab: "Średni response" },
                ].map((stat) => (
                  <div key={stat.lab} className="px-0 sm:px-4.5 sm:border-r sm:border-slate-200 sm:last:border-r-0 sm:first:pl-0 py-2 sm:py-0">
                    <div className="text-xl sm:text-2xl font-semibold tracking-tight">{stat.val}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{stat.lab}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Services */}
          <section className="mb-12">
            <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Usługi</span>
            <h2 className="text-[32px] font-semibold tracking-tight mt-2 mb-5">Pojedyncze sesje</h2>
            {editMode ? (
              <InlineServicesEditor
                services={servicesWithIds.map((s) => ({
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  duration: s.duration,
                  price: s.price,
                }))}
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3.5">
                {trainer.services.map((svc) => (
                  <div key={svc.id ?? svc.name} className="bg-white/80 backdrop-blur-sm border border-white/70 rounded-[18px] p-5 sm:p-5.5 shadow-sm flex flex-col gap-2.5">
                    <div className="flex justify-between items-baseline">
                      <div className="text-[17px] font-semibold tracking-tight">{svc.name}</div>
                      <div className="text-base font-semibold text-emerald-700">{svc.price} zł</div>
                    </div>
                    <div className="text-sm text-slate-600 leading-snug">{svc.description}</div>
                    <div className="flex gap-3.5 text-xs text-slate-500 mt-auto pt-2.5 border-t border-slate-200">
                      {svc.duration > 0 && <span className="inline-flex items-center gap-1">⏱ {svc.duration} min</span>}
                      <span className="inline-flex items-center gap-1">📍 Sala</span>
                    </div>
                    <button className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition mt-1">
                      Zarezerwuj →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Packages */}
          <section className="mb-12">
            <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Pakiety</span>
            <h2 className="text-[32px] font-semibold tracking-tight mt-2 mb-1">Zaplanuj transformację</h2>
            <p className="text-[15px] text-slate-600 mb-6">Pakiety długoterminowe z rabatem do 20% względem sesji pojedynczych.</p>
            {editMode ? (
              <InlinePackagesEditor packages={trainer.packages} />
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-3.5 px-3.5 pb-3 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:gap-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:pb-0">
                {trainer.packages.map((pkg) => (
                  <div key={pkg.id} className={`shrink-0 w-[280px] sm:w-auto snap-start flex flex-col gap-4 rounded-[20px] p-5 sm:p-6 relative ${pkg.featured ? "bg-gradient-to-b from-white/95 to-emerald-50/90 border border-emerald-300 shadow-[0_22px_48px_-18px_rgba(16,185,129,0.3)] sm:-translate-y-1" : "bg-white/80 backdrop-blur-sm border border-white/70 shadow-sm"}`}>
                    {pkg.featured && (
                      <span className="absolute -top-2.5 left-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] px-3 py-1 rounded-full font-semibold uppercase tracking-[0.06em] shadow-sm">
                        ⭐ Popularne
                      </span>
                    )}
                    <div>
                      <div className="text-base font-semibold text-emerald-700">{pkg.name}</div>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-[34px] font-semibold tracking-tight">{pkg.price.toLocaleString("pl-PL")} zł</span>
                        {pkg.period && <span className="text-[13px] text-slate-500">/ {pkg.period}</span>}
                      </div>
                      {pkg.description && <div className="text-[13px] text-slate-600 leading-snug mt-2">{pkg.description}</div>}
                    </div>
                    <ul className="space-y-2.5 flex-1">
                      {pkg.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                          <span className="w-[18px] h-[18px] rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full py-3 rounded-xl text-sm font-medium transition mt-auto ${pkg.featured ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:brightness-105" : "bg-white border border-slate-200 text-slate-900 hover:border-slate-400"}`}>
                      Wybierz pakiet
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Gallery */}
          <section className="mb-12">
            <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Galeria</span>
            <h2 className="text-[32px] font-semibold tracking-tight mt-2 mb-5">Praca w obiektywie</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {[
                "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop",
                "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=600&h=400&fit=crop",
              ].map((src, i) => (
                <div key={i} className="aspect-[3/2] rounded-2xl overflow-hidden border border-white/60 shadow-sm relative group">
                  <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  {i === 5 && (
                    <div className="absolute inset-0 bg-slate-950/55 flex items-center justify-center text-white font-semibold">+12 zdjęć</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Certifications */}
          {trainer.certifications.length > 0 && (
            <section className="mb-12">
              <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Certyfikaty</span>
              <h2 className="text-[32px] font-semibold tracking-tight mt-2 mb-5">Wykształcenie i szkolenia</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {trainer.certifications.map((cert) => (
                  <div key={cert} className="bg-white/75 backdrop-blur-sm border border-white/70 rounded-[14px] p-4 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center shrink-0">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="7" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug">{cert.split("—")[0].trim()}</div>
                      {cert.includes("—") && <div className="text-xs text-slate-500 mt-0.5">{cert.split("—")[1]?.trim()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="mb-12">
            <span className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">Opinie</span>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mt-2 mb-6">
              <div>
                <h2 className="text-[32px] font-semibold tracking-tight">Co mówią klienci</h2>
                <p className="text-[15px] text-slate-600">{trainer.reviewCount} opinie w ciągu ostatnich 18 miesięcy</p>
              </div>
              {/* Score block */}
              <div className="flex items-center gap-4 mt-4 sm:mt-0">
                <div>
                  <div className="text-5xl font-semibold tracking-tight">{trainer.rating}</div>
                  <div className="text-amber-400 text-sm">★★★★★</div>
                  <div className="text-[13px] text-slate-500 mt-0.5">{trainer.reviewCount} opinie</div>
                </div>
                <div className="hidden sm:grid gap-1 flex-1 max-w-[280px]">
                  {[
                    { n: 5, w: "88%", c: 64 },
                    { n: 4, w: "10%", c: 7 },
                    { n: 3, w: "3%", c: 2 },
                    { n: 2, w: "0%", c: 0 },
                    { n: 1, w: "0%", c: 0 },
                  ].map((bar) => (
                    <div key={bar.n} className="grid grid-cols-[16px_1fr_32px] gap-2 items-center text-xs text-slate-500">
                      <span>{bar.n}</span>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: bar.w }} />
                      </div>
                      <span>{bar.c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3.5">
              {trainer.reviews.map((review) => {
                const dateFormatted = new Date(review.date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
                return (
                  <div key={review.id} className="bg-white/80 backdrop-blur-sm border border-white/70 rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-sm">{review.authorName.charAt(0)}</div>
                      <div>
                        <div className="text-sm font-semibold">{review.authorName}</div>
                        <div className="text-xs text-slate-500">{dateFormatted}</div>
                      </div>
                    </div>
                    <div className="text-amber-400 text-sm mt-2.5">★★★★★</div>
                    <p className="text-sm text-slate-700 leading-relaxed mt-2">{review.text}</p>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-6">
              <button className="px-5 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white hover:border-slate-400 transition">
                Zobacz wszystkie {trainer.reviewCount} opinie →
              </button>
            </div>
          </section>
        </div>

        {/* Booking sidebar — interactive, desktop only. Hidden in edit mode. */}
        {!editMode && trainerDbId && (
          <BookingSidebar
            trainerSlug={trainer.id}
            trainerId={trainerDbId}
            services={servicesWithIds}
            priceFrom={trainer.priceFrom}
            rating={trainer.rating}
            reviewCount={trainer.reviewCount}
            initialDate={initialDate}
            initialSlots={initialSlots}
          />
        )}
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3.5 py-3 pb-5 grid grid-cols-[auto_1fr] gap-3 items-center sm:hidden">
        <div className="text-[13px] text-slate-500">
          od<strong className="block text-lg font-semibold text-slate-900">{trainer.priceFrom} zł</strong>
        </div>
        <Link href={`/trainers/${trainer.id}/book`} className="text-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl py-3.5 px-5 text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
          Zarezerwuj sesję
        </Link>
      </div>
      <div className="h-24 sm:hidden" />
    </div>
  );
}

/* ================================================================
   OTHER TEMPLATES — Minimal / Sport / Cozy
   ================================================================ */
async function TemplateProfile({
  trainer,
  trainerDbId,
  editMode,
  isOwner,
  published,
  initialIsFavorite,
  needsLoginToFavorite,
}: {
  trainer: Trainer;
  trainerDbId: string | undefined;
  editMode: boolean;
  isOwner: boolean;
  published: boolean;
  initialIsFavorite: boolean;
  needsLoginToFavorite: boolean;
}) {
  const c = trainer.customization;
  const s = templates[c.template];
  const visibleSections = c.sections.filter((sec) => sec.visible);
  const isSport = s.name === "sport";
  const isCozy = s.name === "cozy";

  const servicesWithIds = trainer.services.filter((svc): svc is Service & { id: string } => !!svc.id);
  const initialDate = warsawDateOffset(0);
  const initialSlots = trainerDbId && !editMode ? await getAvailableSlots(trainerDbId, initialDate) : [];

  function renderSection(sectionId: SectionId) {
    // In edit mode, swap template-styled sections with inline editors for tagline/services/packages/about.
    // Gallery + certifications remain template-styled until inline editors are built (see tasks #16, #17).
    if (editMode) {
      switch (sectionId) {
        case "about":
          return (
            <section key="about" className="px-6 py-5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-medium">O mnie</span>
              <p className="text-[14px] text-slate-700 leading-[1.65] mt-2">
                <EditableText field="about" initial={trainer.about} multiline maxLength={3000} placeholder="Opowiedz o sobie..." />
              </p>
            </section>
          );
        case "services":
          return (
            <section key="services" className="px-6 py-5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-medium">Usługi</span>
              <div className="mt-3">
                <InlineServicesEditor
                  services={servicesWithIds.map((sv) => ({
                    id: sv.id,
                    name: sv.name,
                    description: sv.description,
                    duration: sv.duration,
                    price: sv.price,
                  }))}
                />
              </div>
            </section>
          );
        case "packages":
          return (
            <section key="packages" className="px-6 py-5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-medium">Pakiety</span>
              <div className="mt-3">
                <InlinePackagesEditor packages={trainer.packages} />
              </div>
            </section>
          );
      }
    }

    switch (sectionId) {
      case "about": return <AboutSection key="about" about={trainer.about} styles={s} />;
      case "services": return <ServicesSection key="services" services={trainer.services} styles={s} />;
      case "packages": return <PackagesSection key="packages" packages={trainer.packages} styles={s} />;
      case "gallery": return <GallerySection key="gallery" gallery={trainer.gallery} styles={s} />;
      case "certifications": return <CertificationsSection key="certifications" certifications={trainer.certifications} styles={s} />;
      case "reviews": return <ReviewsSection key="reviews" reviews={trainer.reviews} styles={s} />;
      default: return null;
    }
  }

  return (
    <div className={`min-h-screen ${s.pageBg}`}>
      {editMode && <EditModeBar slug={trainer.id} published={published} />}
      {isOwner && !editMode && <EditProfileFab slug={trainer.id} />}

      {/* Cover — full-bleed across 1200px container */}
      <div className="mx-auto max-w-[1200px] px-3.5 sm:px-6">
        <div className={`${s.coverBg} ${s.coverHeight} -mx-3.5 sm:mx-0 sm:rounded-3xl overflow-hidden relative`}>
          {isSport && (
            <>
              <img src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1600&h=400&fit=crop" alt="" className="w-full h-full object-cover opacity-50" />
              <div className={s.coverOverlay} />
              <span className="absolute top-4 left-4 px-2.5 py-1 rounded-sm bg-lime-400 text-[#020617] text-[10px] font-extrabold uppercase tracking-[0.12em]">💪 PERFORMANCE</span>
            </>
          )}
          {isCozy && <div className="absolute bottom-[-1px] left-0 right-0 h-8 bg-[#fdf6ec] rounded-t-[32px]" />}
          {!isOwner && (
            <div className="absolute top-4 right-4">
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 shadow-[0_4px_14px_rgba(2,6,23,0.06)] hover:bg-white transition disabled:opacity-70"
                size={16}
              />
            </div>
          )}
        </div>

        {/* Two-column layout: main content + booking sidebar (desktop). On mobile single column,
            sticky CTA at bottom (rendered below). Sidebar hidden in editMode. */}
        <div className="sm:grid sm:grid-cols-[1fr_340px] sm:gap-10 pb-8 sm:pb-12">
          {/* MAIN COLUMN */}
          <div>
            <div className={`${isSport ? "px-6 pb-5" : "px-6"} -mt-9 relative z-10`}>
              <div className={s.avatarStyle + " overflow-hidden"}>
                <Image src={trainer.avatar} alt={trainer.name} width={80} height={80} className="w-full h-full object-cover" />
              </div>
              <h1 className={`mt-3.5 ${s.nameStyle}`}>
                {isSport ? (<>{trainer.name.split(" ")[0]}<br />{trainer.name.split(" ").slice(1).join(" ")}</>) : trainer.name}
              </h1>
              <p className={`mt-0.5 ${s.tagStyle}`}>
                {isSport ? (
                  trainer.specializations.map((sp) => getSpecLabel(sp)).join(" · ")
                ) : editMode ? (
                  <EditableText field="tagline" initial={trainer.tagline} multiline maxLength={200} placeholder="Twój tagline..." />
                ) : (
                  trainer.tagline
                )}
              </p>
              <div className={`mt-3 flex flex-wrap gap-3.5 ${s.metaStyle}`}>
                {isSport ? (
                  <><span className="text-lime-400">★ {trainer.rating} · {trainer.reviewCount}</span><span>{trainer.location}</span><span>{trainer.experience} lat</span></>
                ) : isCozy ? (
                  <><span>⭐ <strong className="text-[#2d2418] font-semibold">{trainer.rating}</strong> ({trainer.reviewCount})</span><span>📍 {trainer.location}</span><span>🌱 {trainer.experience} lat</span></>
                ) : (
                  <><span>★ {trainer.rating} · {trainer.reviewCount}</span><span>{trainer.location}</span><span>{trainer.experience} lat</span></>
                )}
              </div>
              {s.name === "minimal" && <div className="mt-4 pb-4 border-b border-slate-200" />}
            </div>
            {visibleSections.map((sec) => renderSection(sec.id))}
            {/* CTA bar — mobile only when sidebar is hidden; desktop relies on sidebar booking widget. */}
            {!editMode && (
              <div className={`${s.ctaBarStyle} sm:hidden`}>
                <div className={s.ctaPriceStyle}>{isSport ? "OD " : "od "}<strong className={s.ctaPriceBoldStyle}>{trainer.priceFrom} {isSport ? "ZŁ" : "zł"}</strong></div>
                <Link href={`/trainers/${trainer.id}/book`} className={`${s.ctaButtonStyle} inline-flex items-center justify-center`}>{s.ctaButtonText}</Link>
              </div>
            )}
          </div>

          {/* BOOKING SIDEBAR — desktop only, hidden in edit mode */}
          {!editMode && trainerDbId && (
            <div className="hidden sm:block">
              <BookingSidebar
                trainerSlug={trainer.id}
                trainerId={trainerDbId}
                services={servicesWithIds}
                priceFrom={trainer.priceFrom}
                rating={trainer.rating}
                reviewCount={trainer.reviewCount}
                initialDate={initialDate}
                initialSlots={initialSlots}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky CTA — same pattern as PremiumProfile */}
      {!editMode && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3.5 py-3 pb-5 grid grid-cols-[auto_1fr] gap-3 items-center sm:hidden">
            <div className="text-[13px] text-slate-500">
              od<strong className="block text-lg font-semibold text-slate-900">{trainer.priceFrom} zł</strong>
            </div>
            <Link href={`/trainers/${trainer.id}/book`} className="text-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl py-3.5 px-5 text-sm font-medium shadow-[0_10px_30px_rgba(16,185,129,0.18)]">
              Zarezerwuj sesję
            </Link>
          </div>
          <div className="h-24 sm:hidden" />
        </>
      )}
    </div>
  );
}

export default async function TrainerProfilePage(props: PageProps<"/trainers/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const wantsEdit = sp?.edit === "1";

  const trainer = await getTrainerBySlug(id);
  if (!trainer) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Resolve slug → DB uuid once for: owner detection, BookingSidebar, message link,
  // and the FavoriteButton seed.
  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("id, published")
    .eq("slug", id)
    .maybeSingle();
  const trainerDbId = trainerRow?.id as string | undefined;

  let isOwner = false;
  let editMode = false;
  let published = trainerRow?.published ?? true;
  if (user && trainerDbId === user.id) {
    isOwner = true;
    editMode = wantsEdit;
  }

  // Initial favorite state (for the heart button SSR).
  let initialIsFavorite = false;
  const needsLoginToFavorite = !user;
  if (user && !isOwner && trainerDbId) {
    initialIsFavorite = await queryIsFavorite(user.id, trainerDbId);
  }

  if (trainer.customization.template === "premium") {
    return (
      <PremiumProfile
        trainer={trainer}
        trainerDbId={trainerDbId}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
      />
    );
  }
  if (trainer.customization.template === "cinematic") {
    return (
      <CinematicProfile
        trainer={trainer}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
      />
    );
  }
  return (
    <TemplateProfile
      trainer={trainer}
      trainerDbId={trainerDbId}
      editMode={editMode}
      isOwner={isOwner}
      published={published}
      initialIsFavorite={initialIsFavorite}
      needsLoginToFavorite={needsLoginToFavorite}
    />
  );
}
