import { SpecializationInfo } from "@/types";

// Photos serve two layouts: mobile (small ~36px square thumb) and desktop
// (full-width banner ~218×150px on lg). 600×400 covers both — DPR headroom
// for the desktop banner, plenty for the mobile thumb. All photos pulled
// from Unsplash IDs already in this codebase (mock-trainers / TrainerCard /
// homepage hero) or known fitness/food iconic shots, so we don't introduce
// new external image sources.
export const specializations: SpecializationInfo[] = [
  { id: "weight-loss",    label: "Odchudzanie",    icon: "🔥",    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop" },
  { id: "muscle-gain",    label: "Masa mięśniowa", icon: "💪",    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop" },
  { id: "rehabilitation", label: "Rehabilitacja",  icon: "🩺",    image: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&h=400&fit=crop" },
  { id: "flexibility",    label: "Rozciąganie",    icon: "🧘",    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop" },
  { id: "cardio",         label: "Cardio",         icon: "❤️",    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop" },
  { id: "strength",       label: "Siła",           icon: "🏋️",    image: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=400&fit=crop" },
  { id: "crossfit",       label: "CrossFit",       icon: "⚡",     image: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=600&h=400&fit=crop" },
  { id: "yoga",           label: "Joga",           icon: "🧘‍♀️",  image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=400&fit=crop" },
  { id: "martial-arts",   label: "Sztuki walki",   icon: "🥊",    image: "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=600&h=400&fit=crop" },
  { id: "nutrition",      label: "Dietetyka",      icon: "🥗",    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&h=400&fit=crop" },
];

export function getSpecLabel(id: string): string {
  return specializations.find((s) => s.id === id)?.label ?? id;
}

export function getSpecIcon(id: string): string {
  return specializations.find((s) => s.id === id)?.icon ?? "📌";
}
