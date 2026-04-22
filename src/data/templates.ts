import { TemplateName } from "@/types";

export interface TemplateStyles {
  name: TemplateName;
  label: string;
  description: string;
  // Page
  pageBg: string;
  // Header card
  headerBg: string;
  headerBorder: string;
  headerShadow: string;
  // Text
  headingColor: string;
  textColor: string;
  mutedColor: string;
  // Cards
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  cardHover: string;
  // Badges
  badgeBg: string;
  badgeText: string;
  // Sections
  sectionBg: string;
  // CTA
  ctaBg: string;
  ctaBorder: string;
  ctaText: string;
  ctaButtonBg: string;
  ctaButtonText: string;
  // Misc
  divider: string;
  rounded: string;
}

export const templates: Record<TemplateName, TemplateStyles> = {
  minimal: {
    name: "minimal",
    label: "Minimalizm",
    description: "Czysto, biało, z fokusem na treść",
    pageBg: "bg-white",
    headerBg: "bg-white",
    headerBorder: "border border-gray-200",
    headerShadow: "",
    headingColor: "text-gray-900",
    textColor: "text-gray-700",
    mutedColor: "text-gray-400",
    cardBg: "bg-white",
    cardBorder: "border border-gray-200",
    cardShadow: "",
    cardHover: "hover:border-gray-300",
    badgeBg: "bg-gray-100",
    badgeText: "text-gray-700",
    sectionBg: "",
    ctaBg: "bg-gray-50",
    ctaBorder: "border border-gray-200",
    ctaText: "text-gray-900",
    ctaButtonBg: "bg-gray-900",
    ctaButtonText: "text-white",
    divider: "border-gray-200",
    rounded: "rounded-lg",
  },
  sport: {
    name: "sport",
    label: "Sportowy",
    description: "Ciemny, energiczny, z mocnymi akcentami",
    pageBg: "bg-slate-950",
    headerBg: "bg-slate-900",
    headerBorder: "border border-slate-700",
    headerShadow: "shadow-xl shadow-black/30",
    headingColor: "text-white",
    textColor: "text-slate-300",
    mutedColor: "text-slate-500",
    cardBg: "bg-slate-900",
    cardBorder: "border border-slate-700",
    cardShadow: "shadow-lg shadow-black/20",
    cardHover: "hover:border-slate-500",
    badgeBg: "bg-slate-800",
    badgeText: "text-slate-200",
    sectionBg: "",
    ctaBg: "bg-slate-900",
    ctaBorder: "border border-slate-700",
    ctaText: "text-white",
    ctaButtonBg: "bg-white",
    ctaButtonText: "text-slate-900",
    divider: "border-slate-800",
    rounded: "rounded-xl",
  },
  premium: {
    name: "premium",
    label: "Premium",
    description: "Elegancki, z efektami szkła i gradientami",
    pageBg: "bg-gradient-to-b from-slate-50 to-white",
    headerBg: "bg-white/70 backdrop-blur-xl",
    headerBorder: "border border-white/50 ring-1 ring-black/5",
    headerShadow: "shadow-xl shadow-black/5",
    headingColor: "text-gray-900",
    textColor: "text-gray-600",
    mutedColor: "text-gray-400",
    cardBg: "bg-white/70 backdrop-blur-sm",
    cardBorder: "border border-white/50 ring-1 ring-black/5",
    cardShadow: "shadow-lg shadow-black/5",
    cardHover: "hover:shadow-xl hover:shadow-black/10",
    badgeBg: "bg-white/80",
    badgeText: "text-gray-700",
    sectionBg: "",
    ctaBg: "bg-gradient-to-r from-violet-500 to-purple-600",
    ctaBorder: "",
    ctaText: "text-white",
    ctaButtonBg: "bg-white",
    ctaButtonText: "text-violet-700",
    divider: "border-gray-200/50",
    rounded: "rounded-2xl",
  },
  cozy: {
    name: "cozy",
    label: "Przytulny",
    description: "Ciepłe kolory, delikatne kształty",
    pageBg: "bg-amber-50/50",
    headerBg: "bg-white",
    headerBorder: "border border-orange-200/60",
    headerShadow: "shadow-sm",
    headingColor: "text-stone-800",
    textColor: "text-stone-600",
    mutedColor: "text-stone-400",
    cardBg: "bg-white",
    cardBorder: "border border-orange-200/60",
    cardShadow: "shadow-sm",
    cardHover: "hover:shadow-md",
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-700",
    sectionBg: "",
    ctaBg: "bg-orange-50",
    ctaBorder: "border border-orange-200",
    ctaText: "text-stone-800",
    ctaButtonBg: "bg-orange-500",
    ctaButtonText: "text-white",
    divider: "border-orange-200/60",
    rounded: "rounded-2xl",
  },
};
