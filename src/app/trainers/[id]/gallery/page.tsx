import { notFound } from "next/navigation";
import { getTrainerBySlug } from "@/lib/db/trainers";
import FullGalleryCinematic from "./FullGalleryCinematic";
import FullGalleryStudio from "./FullGalleryStudio";
import FullGalleryLuxury from "./FullGalleryLuxury";
import FullGallerySignature from "./FullGallerySignature";
import FullGalleryPremium from "./FullGalleryPremium";

/**
 * Full-gallery page reachable via "Zobacz wszystkie" links from each profile.
 * Editing happens inline on the profile via the per-template gallery editors;
 * this view is read-only and dispatches to a template-specific full-gallery
 * component so each trainer's gallery matches the chrome of their profile
 * (dark Cinematic vs ivory Luxury vs cream Signature vs off-white Studio vs
 * soft-slate Premium).
 *
 * Per-page galleryHidden filters out soft-deleted photos, and per-photo
 * galleryFocal threads through to each tile's object-position.
 */
export default async function GalleryPage(props: PageProps<"/trainers/[id]/gallery">) {
  const { id } = await props.params;
  const trainer = await getTrainerBySlug(id);
  if (!trainer) notFound();

  const galleryHiddenSet = new Set(trainer.customization.galleryHidden ?? []);
  const items = (trainer.galleryItems ?? []).filter((g) => !galleryHiddenSet.has(g.id));
  const focalMap = trainer.customization.galleryFocal;
  const tpl = trainer.customization.template;

  if (tpl === "studio") return <FullGalleryStudio trainer={trainer} items={items} focalMap={focalMap} />;
  if (tpl === "luxury") return <FullGalleryLuxury trainer={trainer} items={items} focalMap={focalMap} />;
  if (tpl === "signature") return <FullGallerySignature trainer={trainer} items={items} focalMap={focalMap} />;
  if (tpl === "premium" || tpl === "cozy") return <FullGalleryPremium trainer={trainer} items={items} focalMap={focalMap} />;
  return <FullGalleryCinematic trainer={trainer} items={items} focalMap={focalMap} />;
}
