export type Specialization =
  | "weight-loss"
  | "muscle-gain"
  | "rehabilitation"
  | "flexibility"
  | "cardio"
  | "strength"
  | "crossfit"
  | "yoga"
  | "martial-arts"
  | "nutrition";

export interface SpecializationInfo {
  id: Specialization;
  label: string;
  icon: string;
}

export interface Service {
  name: string;
  description: string;
  duration: number;
  price: number;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period?: string;
  featured?: boolean;
}

export interface Review {
  id: string;
  trainerId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  text: string;
  date: string;
}

export type TemplateName = "minimal" | "sport" | "premium" | "cozy";

export type SectionId =
  | "about"
  | "services"
  | "packages"
  | "gallery"
  | "certifications"
  | "reviews";

export interface SectionConfig {
  id: SectionId;
  visible: boolean;
}

export type ServiceLayout = "cards" | "list" | "table";
export type GalleryLayout = "grid" | "carousel" | "before-after";

export interface ProfileCustomization {
  template: TemplateName;
  accentColor: string;
  sections: SectionConfig[];
  serviceLayout: ServiceLayout;
  galleryLayout: GalleryLayout;
  coverImage?: string;
}

export interface Trainer {
  id: string;
  name: string;
  avatar: string;
  specializations: Specialization[];
  tagline: string;
  about: string;
  experience: number;
  rating: number;
  reviewCount: number;
  priceFrom: number;
  location: string;
  languages: string[];
  certifications: string[];
  gallery: string[];
  services: Service[];
  packages: Package[];
  reviews: Review[];
  customization: ProfileCustomization;
}
