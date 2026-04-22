import { TemplateName } from "@/types";

export interface TemplateStyles {
  name: TemplateName;
  label: string;
  description: string;
  // Page
  pageBg: string;
  // Cover
  coverBg: string;
  coverHeight: string;
  coverOverlay: string;
  // Hero
  avatarStyle: string;
  nameStyle: string;
  tagStyle: string;
  metaStyle: string;
  // Section
  sectionBorder: string;
  sectionTitleStyle: string;
  sectionPadding: string;
  bodyText: string;
  // Services
  svcContainerStyle: string;
  svcItemStyle: string;
  svcNameStyle: string;
  svcDescStyle: string;
  svcPriceStyle: string;
  // Packages
  pkgContainerStyle: string;
  pkgCardStyle: string;
  pkgFeaturedStyle: string;
  pkgFeaturedBadge: string;
  pkgNameStyle: string;
  pkgPriceStyle: string;
  pkgItemStyle: string;
  pkgItemPrefix: string;
  pkgButtonStyle: string;
  // Reviews
  revCardStyle: string;
  revNameStyle: string;
  revDateStyle: string;
  revTextStyle: string;
  revStarsStyle: string;
  // CTA bar
  ctaBarStyle: string;
  ctaPriceStyle: string;
  ctaPriceBoldStyle: string;
  ctaButtonStyle: string;
  ctaButtonText: string;
  // Certs
  certCheckColor: string;
  certTextStyle: string;
}

export const templates: Record<TemplateName, TemplateStyles> = {
  minimal: {
    name: "minimal",
    label: "Minimalizm",
    description: "Czysto, biało, Notion / Apple vibe",
    pageBg: "bg-white",
    coverBg: "bg-slate-50 border-b border-slate-200",
    coverHeight: "h-[100px]",
    coverOverlay: "",
    avatarStyle: "w-[72px] h-[72px] rounded-full border-[3px] border-white shadow-sm bg-slate-100",
    nameStyle: "text-2xl font-semibold tracking-tight text-slate-900",
    tagStyle: "text-[13px] text-slate-500",
    metaStyle: "text-xs text-slate-600",
    sectionBorder: "border-b border-slate-200",
    sectionTitleStyle: "text-[11px] uppercase tracking-[0.08em] text-slate-400 font-medium mb-2.5",
    sectionPadding: "px-7 py-5",
    bodyText: "text-[13px] text-slate-700 leading-relaxed",
    // Services — table-like list
    svcContainerStyle: "grid gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden",
    svcItemStyle: "flex justify-between items-center px-3.5 py-2.5 bg-white",
    svcNameStyle: "text-[13px] font-medium text-slate-900",
    svcDescStyle: "hidden",
    svcPriceStyle: "text-xs text-slate-500 font-mono",
    // Packages — bordered columns
    pkgContainerStyle: "grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden",
    pkgCardStyle: "p-3.5 border-r border-slate-200 last:border-r-0",
    pkgFeaturedStyle: "p-3.5 border-r border-slate-200 last:border-r-0 bg-slate-50 relative",
    pkgFeaturedBadge: "absolute top-2.5 right-2.5 text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded bg-slate-900 text-white font-semibold",
    pkgNameStyle: "text-[11px] text-slate-500",
    pkgPriceStyle: "text-lg font-semibold tracking-tight",
    pkgItemStyle: "text-[11px] text-slate-600",
    pkgItemPrefix: "",
    pkgButtonStyle: "hidden",
    // Reviews
    revCardStyle: "py-3.5 border-b border-slate-200 last:border-b-0",
    revNameStyle: "text-xs font-semibold text-slate-900",
    revDateStyle: "text-[11px] text-slate-400",
    revTextStyle: "text-xs text-slate-700 leading-relaxed",
    revStarsStyle: "text-[11px] text-slate-900 tracking-wider",
    // CTA bar
    ctaBarStyle: "px-7 py-4.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center",
    ctaPriceStyle: "text-[13px] text-slate-500",
    ctaPriceBoldStyle: "text-base font-semibold text-slate-900",
    ctaButtonStyle: "px-4 py-2.5 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-black transition",
    ctaButtonText: "Napisz wiadomość",
    // Certs
    certCheckColor: "text-slate-900",
    certTextStyle: "text-[13px] text-slate-700",
  },

  sport: {
    name: "sport",
    label: "Sportowy",
    description: "Ciemny, energiczny, Nike / Under Armour vibe",
    pageBg: "bg-[#020617]",
    coverBg: "relative overflow-hidden h-[140px]",
    coverHeight: "h-[140px]",
    coverOverlay: "absolute inset-0 bg-gradient-to-b from-transparent to-[#020617]/95",
    avatarStyle: "w-20 h-20 rounded-md border-[3px] border-lime-400 shadow-[0_0_0_1px_#020617] overflow-hidden",
    nameStyle: "text-[28px] font-black tracking-tight uppercase leading-none text-white",
    tagStyle: "text-xs text-slate-400 uppercase tracking-[0.1em] font-semibold",
    metaStyle: "text-[11px] text-slate-300 uppercase tracking-[0.08em] font-semibold",
    sectionBorder: "border-t border-slate-800",
    sectionTitleStyle: "text-[10px] text-lime-400 font-extrabold uppercase tracking-[0.16em] mb-3 flex items-center gap-2 before:content-[''] before:w-5 before:h-0.5 before:bg-lime-400",
    sectionPadding: "px-6 py-4.5",
    bodyText: "text-[13px] text-slate-300 leading-relaxed",
    // Services — rows with big monospace price
    svcContainerStyle: "divide-y divide-slate-800",
    svcItemStyle: "grid grid-cols-[1fr_auto] gap-2 py-3.5",
    svcNameStyle: "text-sm font-bold uppercase tracking-[0.04em] text-white",
    svcDescStyle: "text-xs text-slate-400 mt-0.5",
    svcPriceStyle: "text-base font-black text-lime-400 font-mono",
    // Packages
    pkgContainerStyle: "grid grid-cols-3 gap-2",
    pkgCardStyle: "border border-slate-800 p-3.5 bg-[#0f172a]",
    pkgFeaturedStyle: "border border-lime-400 p-3.5 bg-gradient-to-b from-lime-400/[0.08] to-transparent relative",
    pkgFeaturedBadge: "absolute -top-2 right-2 bg-lime-400 text-[#020617] text-[9px] px-1.5 py-0.5 font-black tracking-[0.08em]",
    pkgNameStyle: "text-[10px] text-slate-400 uppercase tracking-[0.1em] font-bold",
    pkgPriceStyle: "text-xl font-black font-mono text-white",
    pkgItemStyle: "text-[10px] text-slate-300",
    pkgItemPrefix: "text-lime-400",
    pkgButtonStyle: "hidden",
    // Reviews
    revCardStyle: "py-3.5 border-b border-slate-800 last:border-b-0",
    revNameStyle: "text-xs uppercase tracking-[0.06em] font-bold text-white",
    revDateStyle: "text-xs text-slate-500",
    revTextStyle: "text-xs text-slate-300 leading-relaxed",
    revStarsStyle: "text-[11px] text-lime-400 tracking-wider",
    // CTA bar
    ctaBarStyle: "px-6 py-4 bg-lime-400 text-[#020617] flex justify-between items-center",
    ctaPriceStyle: "text-[13px]",
    ctaPriceBoldStyle: "font-mono font-black text-lg",
    ctaButtonStyle: "px-4.5 py-2.5 bg-[#020617] text-lime-400 text-xs font-black uppercase tracking-[0.1em] hover:bg-black transition",
    ctaButtonText: "Rezerwuj sesję →",
    // Certs
    certCheckColor: "text-lime-400",
    certTextStyle: "text-[13px] text-slate-300",
  },

  premium: {
    name: "premium",
    label: "Premium",
    description: "Elegancki, glassmorphism, Linear vibe",
    pageBg: "bg-gradient-to-b from-slate-50 to-white",
    coverBg: "bg-gradient-to-br from-emerald-100 via-teal-50 to-white",
    coverHeight: "h-[120px]",
    coverOverlay: "",
    avatarStyle: "w-20 h-20 rounded-2xl border-[3px] border-white shadow-lg bg-gray-200 ring-1 ring-black/5",
    nameStyle: "text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl",
    tagStyle: "text-[13px] text-gray-500",
    metaStyle: "text-sm text-gray-400",
    sectionBorder: "border-b border-gray-200/50",
    sectionTitleStyle: "text-[13px] uppercase tracking-[0.06em] text-emerald-600 font-semibold mb-3",
    sectionPadding: "px-7 py-5",
    bodyText: "text-sm text-gray-600 leading-relaxed",
    // Services
    svcContainerStyle: "grid gap-3 sm:grid-cols-2",
    svcItemStyle: "bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 ring-1 ring-black/5 shadow-lg shadow-black/5 p-4",
    svcNameStyle: "font-semibold text-gray-900",
    svcDescStyle: "text-sm text-gray-500 mt-1",
    svcPriceStyle: "text-lg font-bold text-emerald-600",
    // Packages
    pkgContainerStyle: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
    pkgCardStyle: "bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 ring-1 ring-black/5 shadow-lg shadow-black/5 p-5 flex flex-col",
    pkgFeaturedStyle: "bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 ring-1 ring-black/5 shadow-xl shadow-black/10 p-5 flex flex-col relative",
    pkgFeaturedBadge: "absolute -top-3 left-4 bg-emerald-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold",
    pkgNameStyle: "text-[11px] text-gray-400 uppercase tracking-[0.06em] font-medium",
    pkgPriceStyle: "text-2xl font-bold text-gray-900",
    pkgItemStyle: "text-xs text-gray-600",
    pkgItemPrefix: "text-emerald-500",
    pkgButtonStyle: "mt-4 w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition",
    // Reviews
    revCardStyle: "bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 ring-1 ring-black/5 shadow-lg shadow-black/5 p-5 mb-3",
    revNameStyle: "text-sm font-semibold text-gray-900",
    revDateStyle: "text-xs text-gray-400",
    revTextStyle: "text-sm text-gray-600 leading-relaxed",
    revStarsStyle: "text-amber-400 text-sm",
    // CTA bar
    ctaBarStyle: "px-7 py-5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-center mt-6",
    ctaPriceStyle: "text-emerald-100 text-sm",
    ctaPriceBoldStyle: "text-xl font-bold text-white",
    ctaButtonStyle: "px-6 py-3 bg-white text-emerald-700 rounded-xl text-sm font-semibold shadow-lg hover:bg-emerald-50 transition",
    ctaButtonText: "Napisz wiadomość",
    // Certs
    certCheckColor: "text-emerald-500",
    certTextStyle: "text-sm text-gray-600",
  },

  cozy: {
    name: "cozy",
    label: "Przytulny",
    description: "Ciepły, opiekuńczy, Headspace / Calm vibe",
    pageBg: "bg-[#fdf6ec]",
    coverBg: "bg-gradient-to-br from-[#fce3c7] via-[#f5d0a9] to-[#fbbf77] relative",
    coverHeight: "h-[110px]",
    coverOverlay: "",
    avatarStyle: "w-[76px] h-[76px] rounded-full border-4 border-[#fdf6ec] bg-[#fbbf77] shadow-[0_6px_20px_rgba(164,95,30,0.18)]",
    nameStyle: "text-[26px] font-semibold tracking-tight text-[#2d2418]",
    tagStyle: "text-[13px] text-[#8a7559] leading-relaxed",
    metaStyle: "text-xs text-[#6b5a41]",
    sectionBorder: "",
    sectionTitleStyle: "text-[11px] uppercase tracking-[0.1em] text-orange-600 font-semibold mb-2.5",
    sectionPadding: "px-6 py-4.5",
    bodyText: "text-[13px] text-[#44372b] leading-[1.65]",
    // Services — rounded white cards
    svcContainerStyle: "grid gap-2",
    svcItemStyle: "bg-white rounded-2xl p-3 px-4 flex justify-between items-center shadow-[0_2px_8px_rgba(164,95,30,0.06)]",
    svcNameStyle: "text-[13px] font-medium text-[#2d2418]",
    svcDescStyle: "text-[11px] text-[#8a7559] mt-0.5",
    svcPriceStyle: "bg-[#fef3e0] text-orange-700 px-2.5 py-1.5 rounded-full text-xs font-semibold",
    // Packages
    pkgContainerStyle: "grid grid-cols-3 gap-2",
    pkgCardStyle: "bg-white rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(164,95,30,0.06)] relative",
    pkgFeaturedStyle: "bg-gradient-to-br from-[#fef3e0] to-[#fbbf77] rounded-2xl p-3.5 shadow-[0_8px_20px_rgba(249,115,22,0.25)] relative text-[#2d2418]",
    pkgFeaturedBadge: "absolute -top-2 left-3 bg-orange-600 text-white text-[9px] px-2 py-0.5 rounded-full font-semibold",
    pkgNameStyle: "text-[10px] uppercase tracking-[0.06em] text-[#8a7559] font-semibold",
    pkgPriceStyle: "text-lg font-semibold tracking-tight text-[#2d2418]",
    pkgItemStyle: "text-[10px] text-[#6b5a41]",
    pkgItemPrefix: "",
    pkgButtonStyle: "hidden",
    // Reviews — rounded white cards
    revCardStyle: "bg-white rounded-2xl p-3.5 px-4 mb-2",
    revNameStyle: "text-xs font-semibold text-[#2d2418]",
    revDateStyle: "text-[11px] text-[#a08668]",
    revTextStyle: "text-xs text-[#44372b] leading-relaxed",
    revStarsStyle: "text-[11px] text-orange-600 tracking-wider",
    // CTA bar
    ctaBarStyle: "px-6 py-4 bg-white border-t border-[#fef3e0] flex justify-between items-center",
    ctaPriceStyle: "text-[13px] text-[#6b5a41]",
    ctaPriceBoldStyle: "text-base font-semibold text-[#2d2418]",
    ctaButtonStyle: "px-4.5 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full text-[13px] font-medium shadow-[0_6px_16px_rgba(234,88,12,0.3)] hover:opacity-90 transition",
    ctaButtonText: "Napisz wiadomość 🌿",
    // Certs
    certCheckColor: "text-orange-500",
    certTextStyle: "text-[13px] text-[#44372b]",
  },
};
