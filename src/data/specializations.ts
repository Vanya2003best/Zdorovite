import { SpecializationInfo } from "@/types";

export const specializations: SpecializationInfo[] = [
  { id: "weight-loss", label: "Odchudzanie", icon: "🔥" },
  { id: "muscle-gain", label: "Masa mięśniowa", icon: "💪" },
  { id: "rehabilitation", label: "Rehabilitacja", icon: "🩺" },
  { id: "flexibility", label: "Rozciąganie", icon: "🧘" },
  { id: "cardio", label: "Cardio", icon: "❤️" },
  { id: "strength", label: "Siła", icon: "🏋️" },
  { id: "crossfit", label: "CrossFit", icon: "⚡" },
  { id: "yoga", label: "Joga", icon: "🧘‍♀️" },
  { id: "martial-arts", label: "Sztuki walki", icon: "🥊" },
  { id: "nutrition", label: "Dietetyka", icon: "🥗" },
];

export function getSpecLabel(id: string): string {
  return specializations.find((s) => s.id === id)?.label ?? id;
}

export function getSpecIcon(id: string): string {
  return specializations.find((s) => s.id === id)?.icon ?? "📌";
}
