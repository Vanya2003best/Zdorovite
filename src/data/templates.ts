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

  // ============================================================
  // Luxury — editorial, ivory + Fraunces serif + gold accent
  // ============================================================
  luxury: {
    name: "luxury",
    label: "Luxury",
    description: "Editorial, ivory, serif Fraunces, gold accent — slow luxury",
    pageBg: "bg-[#f6f1e8]",
    coverBg: "bg-gradient-to-b from-[#efe7d7] to-[#fbf8f1] border-b border-[#d9cfb8]",
    coverHeight: "h-[120px]",
    coverOverlay: "",
    avatarStyle: "w-[78px] h-[78px] rounded-full border-[3px] border-[#fbf8f1] shadow-sm bg-[#efe7d7]",
    nameStyle: "font-serif text-[28px] tracking-[-0.01em] text-[#1c1a15] leading-tight",
    tagStyle: "font-serif italic text-[14px] text-[#7a7365]",
    metaStyle: "text-[11px] uppercase tracking-[0.2em] text-[#8a7346] font-medium",
    sectionBorder: "border-b border-[#d9cfb8]",
    sectionTitleStyle: "text-[10px] uppercase tracking-[0.24em] text-[#8a7346] font-medium mb-3",
    sectionPadding: "px-7 py-6",
    bodyText: "font-serif text-[14px] text-[#3a3730] leading-[1.7]",
    svcContainerStyle: "divide-y divide-[#d9cfb8]",
    svcItemStyle: "flex justify-between items-baseline py-4",
    svcNameStyle: "font-serif text-[15px] text-[#1c1a15]",
    svcDescStyle: "text-[12px] text-[#7a7365] mt-0.5",
    svcPriceStyle: "font-serif text-[15px] text-[#8a7346]",
    pkgContainerStyle: "grid grid-cols-3 gap-px bg-[#d9cfb8] border border-[#d9cfb8]",
    pkgCardStyle: "p-5 bg-[#fbf8f1]",
    pkgFeaturedStyle: "p-5 bg-[#f6f1e8] relative",
    pkgFeaturedBadge: "absolute top-3 right-3 text-[9px] uppercase tracking-[0.2em] text-[#8a7346] font-medium",
    pkgNameStyle: "text-[10px] uppercase tracking-[0.2em] text-[#8a7346] font-medium",
    pkgPriceStyle: "font-serif text-[22px] text-[#1c1a15] tracking-tight",
    pkgItemStyle: "font-serif text-[12px] text-[#3a3730] leading-relaxed",
    pkgItemPrefix: "text-[#b39668]",
    pkgButtonStyle: "hidden",
    revCardStyle: "py-5 border-b border-[#d9cfb8] last:border-b-0",
    revNameStyle: "font-serif text-[13px] text-[#1c1a15] italic",
    revDateStyle: "text-[11px] text-[#7a7365]",
    revTextStyle: "font-serif text-[14px] text-[#3a3730] leading-relaxed italic",
    revStarsStyle: "text-[12px] text-[#8a7346] tracking-wider",
    ctaBarStyle: "px-7 py-5 bg-[#fbf8f1] border-t border-[#d9cfb8] flex justify-between items-center",
    ctaPriceStyle: "text-[13px] text-[#7a7365]",
    ctaPriceBoldStyle: "font-serif text-lg text-[#1c1a15]",
    ctaButtonStyle: "px-5 py-3 bg-[#1c1a15] text-[#f6f1e8] text-[12px] uppercase tracking-[0.2em] font-medium hover:bg-black transition",
    ctaButtonText: "Zarezerwuj",
    certCheckColor: "text-[#8a7346]",
    certTextStyle: "font-serif text-[13px] text-[#3a3730]",
  },

  // ============================================================
  // Studio — bento grid vibe, ink + burnt orange + lime accents
  // ============================================================
  studio: {
    name: "studio",
    label: "Studio",
    description: "Design-forward — siatka, mocny accent, off-white",
    pageBg: "bg-[#fafaf7]",
    coverBg: "bg-[#141413] border-b border-[#e8e6df]",
    coverHeight: "h-[140px]",
    coverOverlay: "",
    avatarStyle: "w-20 h-20 rounded-md border-2 border-[#fafaf7] bg-[#dbff3c] shadow-md",
    nameStyle: "text-[26px] font-semibold tracking-tight text-[#141413]",
    tagStyle: "text-[13px] text-[#77756f] font-medium",
    metaStyle: "text-[11px] text-[#3d3d3a] font-mono uppercase",
    sectionBorder: "border-b border-[#e8e6df]",
    sectionTitleStyle: "text-[11px] uppercase tracking-[0.16em] text-[#ff5722] font-bold mb-3",
    sectionPadding: "px-6 py-5",
    bodyText: "text-[14px] text-[#3d3d3a] leading-relaxed",
    svcContainerStyle: "grid sm:grid-cols-2 gap-3",
    svcItemStyle: "border border-[#e8e6df] rounded-xl p-4 bg-white relative hover:border-[#ff5722] transition",
    svcNameStyle: "text-[15px] font-semibold text-[#141413]",
    svcDescStyle: "text-[12px] text-[#77756f] mt-1",
    svcPriceStyle: "text-[16px] font-mono font-semibold text-[#ff5722]",
    pkgContainerStyle: "grid sm:grid-cols-3 gap-3",
    pkgCardStyle: "border border-[#e8e6df] rounded-2xl p-4 bg-white",
    pkgFeaturedStyle: "border-2 border-[#ff5722] rounded-2xl p-4 bg-[#ffeadb] relative",
    pkgFeaturedBadge: "absolute -top-2.5 left-3 bg-[#ff5722] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold",
    pkgNameStyle: "text-[10px] font-mono uppercase tracking-[0.1em] text-[#77756f]",
    pkgPriceStyle: "text-[22px] font-bold text-[#141413] tracking-tight",
    pkgItemStyle: "text-[11px] text-[#3d3d3a]",
    pkgItemPrefix: "text-[#ff5722]",
    pkgButtonStyle: "mt-3 w-full py-2 bg-[#141413] text-[#dbff3c] text-[11px] uppercase tracking-[0.1em] font-bold rounded-lg hover:bg-black transition",
    revCardStyle: "border border-[#e8e6df] rounded-xl p-4 bg-white mb-2",
    revNameStyle: "text-[12px] font-semibold text-[#141413]",
    revDateStyle: "text-[11px] font-mono text-[#77756f]",
    revTextStyle: "text-[13px] text-[#3d3d3a] leading-relaxed",
    revStarsStyle: "text-[11px] text-[#ff5722] tracking-wider",
    ctaBarStyle: "px-6 py-4 bg-[#141413] text-white flex justify-between items-center rounded-2xl mt-6",
    ctaPriceStyle: "text-[13px] text-[#dbff3c] font-mono",
    ctaPriceBoldStyle: "text-[20px] font-bold text-white tracking-tight",
    ctaButtonStyle: "px-5 py-2.5 bg-[#dbff3c] text-[#141413] text-[12px] uppercase tracking-[0.1em] font-bold rounded-full hover:brightness-110 transition",
    ctaButtonText: "Zarezerwuj →",
    certCheckColor: "text-[#ff5722]",
    certTextStyle: "text-[13px] text-[#3d3d3a]",
  },

  // ============================================================
  // Cinematic — dark, big type, acid-lime + cyan accents
  // ============================================================
  cinematic: {
    name: "cinematic",
    label: "Cinematic",
    description: "Full-bleed dark, big type, neon akcent — viewable as movie",
    pageBg: "bg-[#0a0a0c] text-[#f5f5f4]",
    coverBg: "bg-[#111114] relative overflow-hidden border-b border-white/10",
    coverHeight: "h-[180px]",
    coverOverlay: "absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0c]",
    avatarStyle: "w-20 h-20 rounded-full border-2 border-[#d4ff00]/50 bg-[#111114]",
    nameStyle: "text-[34px] font-bold tracking-tight text-[#f5f5f4] leading-none",
    tagStyle: "text-[13px] text-[#f5f5f4]/72 font-medium uppercase tracking-[0.08em]",
    metaStyle: "text-[11px] text-[#f5f5f4]/48 uppercase tracking-[0.08em] font-medium",
    sectionBorder: "border-t border-white/10",
    sectionTitleStyle: "text-[10px] text-[#d4ff00] uppercase tracking-[0.18em] font-bold mb-3 flex items-center gap-2 before:content-[''] before:w-6 before:h-px before:bg-[#d4ff00]",
    sectionPadding: "px-6 py-6",
    bodyText: "text-[14px] text-[#f5f5f4]/72 leading-[1.7]",
    svcContainerStyle: "divide-y divide-white/10",
    svcItemStyle: "grid grid-cols-[1fr_auto] gap-3 py-4",
    svcNameStyle: "text-[15px] font-bold text-[#f5f5f4]",
    svcDescStyle: "text-[12px] text-[#f5f5f4]/48 mt-0.5",
    svcPriceStyle: "text-[16px] font-mono font-bold text-[#d4ff00]",
    pkgContainerStyle: "grid sm:grid-cols-3 gap-2",
    pkgCardStyle: "border border-white/15 p-5 bg-[#111114]",
    pkgFeaturedStyle: "border border-[#d4ff00] p-5 bg-gradient-to-b from-[#d4ff00]/[0.06] to-transparent relative",
    pkgFeaturedBadge: "absolute -top-2.5 right-3 bg-[#d4ff00] text-[#0a0a0c] text-[10px] px-2 py-0.5 font-bold tracking-[0.06em]",
    pkgNameStyle: "text-[10px] text-[#f5f5f4]/48 uppercase tracking-[0.1em] font-bold",
    pkgPriceStyle: "text-[24px] font-mono font-bold text-[#f5f5f4]",
    pkgItemStyle: "text-[11px] text-[#f5f5f4]/72",
    pkgItemPrefix: "text-[#d4ff00]",
    pkgButtonStyle: "hidden",
    revCardStyle: "py-4 border-b border-white/10 last:border-b-0",
    revNameStyle: "text-[12px] uppercase tracking-[0.06em] font-bold text-[#f5f5f4]",
    revDateStyle: "text-[11px] text-[#f5f5f4]/48",
    revTextStyle: "text-[13px] text-[#f5f5f4]/72 leading-relaxed",
    revStarsStyle: "text-[11px] text-[#d4ff00] tracking-wider",
    ctaBarStyle: "px-6 py-5 bg-[#d4ff00] text-[#0a0a0c] flex justify-between items-center",
    ctaPriceStyle: "text-[13px] font-medium",
    ctaPriceBoldStyle: "font-mono text-[20px] font-bold",
    ctaButtonStyle: "px-5 py-2.5 bg-[#0a0a0c] text-[#d4ff00] text-[12px] uppercase tracking-[0.1em] font-bold hover:bg-black transition",
    ctaButtonText: "Zarezerwuj →",
    certCheckColor: "text-[#d4ff00]",
    certTextStyle: "text-[13px] text-[#f5f5f4]/72",
  },

  // ============================================================
  // Signature — personal brand, burgundy + cream + gold
  // ============================================================
  signature: {
    name: "signature",
    label: "Signature",
    description: "Personal brand — burgundy, kremowy, gold akcent",
    pageBg: "bg-[#f6f1ea]",
    coverBg: "bg-[#1a1613]",
    coverHeight: "h-[140px]",
    coverOverlay: "",
    avatarStyle: "w-[84px] h-[84px] rounded-full border-[3px] border-[#f6f1ea] bg-[#ede4d6] shadow-[0_8px_24px_rgba(125,31,31,0.18)]",
    nameStyle: "text-[28px] font-semibold tracking-tight text-[#1a1613]",
    tagStyle: "text-[14px] text-[#3d362f] leading-relaxed",
    metaStyle: "text-[11px] uppercase tracking-[0.16em] text-[#a68b5b] font-semibold",
    sectionBorder: "border-b border-[#e4dccf]",
    sectionTitleStyle: "text-[11px] uppercase tracking-[0.16em] text-[#7d1f1f] font-bold mb-3",
    sectionPadding: "px-7 py-6",
    bodyText: "text-[14px] text-[#3d362f] leading-[1.7]",
    svcContainerStyle: "divide-y divide-[#e4dccf]",
    svcItemStyle: "grid grid-cols-[1fr_auto] gap-3 py-4",
    svcNameStyle: "text-[15px] font-semibold text-[#1a1613]",
    svcDescStyle: "text-[12px] text-[#7d7268] mt-0.5",
    svcPriceStyle: "text-[16px] font-semibold text-[#7d1f1f]",
    pkgContainerStyle: "grid sm:grid-cols-3 gap-3",
    pkgCardStyle: "bg-white rounded-2xl p-5 border border-[#e4dccf]",
    pkgFeaturedStyle: "bg-gradient-to-b from-[#f1e3e3] to-white rounded-2xl p-5 border-2 border-[#7d1f1f] relative",
    pkgFeaturedBadge: "absolute -top-2.5 left-4 bg-[#7d1f1f] text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-[0.06em] uppercase",
    pkgNameStyle: "text-[10px] uppercase tracking-[0.16em] text-[#a68b5b] font-bold",
    pkgPriceStyle: "text-[22px] font-semibold text-[#1a1613] tracking-tight",
    pkgItemStyle: "text-[12px] text-[#3d362f]",
    pkgItemPrefix: "text-[#a68b5b]",
    pkgButtonStyle: "mt-3 w-full py-2.5 bg-[#7d1f1f] text-white text-[12px] uppercase tracking-[0.1em] font-semibold rounded-full hover:bg-[#9a2a2a] transition",
    revCardStyle: "bg-white rounded-2xl p-4 border border-[#e4dccf] mb-2",
    revNameStyle: "text-[13px] font-semibold text-[#1a1613]",
    revDateStyle: "text-[11px] text-[#7d7268]",
    revTextStyle: "text-[13px] text-[#3d362f] leading-relaxed",
    revStarsStyle: "text-[12px] text-[#a68b5b] tracking-wider",
    ctaBarStyle: "px-7 py-5 bg-[#1a1613] text-[#f6f1ea] flex justify-between items-center",
    ctaPriceStyle: "text-[13px] text-[#a68b5b]",
    ctaPriceBoldStyle: "text-[20px] font-semibold text-white",
    ctaButtonStyle: "px-5 py-2.5 bg-[#7d1f1f] text-white text-[12px] uppercase tracking-[0.12em] font-semibold rounded-full hover:bg-[#9a2a2a] transition",
    ctaButtonText: "Zarezerwuj sesję",
    certCheckColor: "text-[#7d1f1f]",
    certTextStyle: "text-[13px] text-[#3d362f]",
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
