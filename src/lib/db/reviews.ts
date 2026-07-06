/**
 * Client-review domain constants + shared types.
 *
 * Pure constants — safe to import from BOTH server actions and client
 * components (which is exactly why they don't live inside the
 * "use server" actions file: those may only export async functions).
 *
 * The four categories mirror migration 029's cat_* columns, which
 * /studio/reviews renders as per-category bars. The client form offers
 * them as chips: a selected chip means "this aspect stood out", stored
 * as the overall rating in that category's column; unselected stays
 * NULL so legacy rows and chip-less reviews render without bars.
 */

export const REVIEW_TEXT_MIN = 20;
export const REVIEW_TEXT_MAX = 2000;

export const REVIEW_CATEGORIES = [
  { key: "wiedza", label: "Wiedza" },
  { key: "atmosfera", label: "Atmosfera" },
  { key: "punktualnosc", label: "Punktualność" },
  { key: "efekty", label: "Efekty" },
] as const;

export type ReviewCategoryKey = (typeof REVIEW_CATEGORIES)[number]["key"];

export function isReviewCategoryKey(v: string): v is ReviewCategoryKey {
  return REVIEW_CATEGORIES.some((c) => c.key === v);
}

export function reviewCategoryLabel(key: ReviewCategoryKey): string {
  return REVIEW_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** The review the signed-in client left for a given booking. */
export type MyReview = {
  rating: number;
  text: string;
  categories: ReviewCategoryKey[];
};
