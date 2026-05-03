import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { getTrainerPageByPath } from "@/lib/db/trainer-pages";
import { isFavorite as queryIsFavorite } from "@/lib/db/favorites";
import { createClient } from "@/lib/supabase/server";
import CinematicProfile from "../CinematicProfile";
import PremiumProfile from "../PremiumProfile";
import SignatureProfile from "../SignatureProfile";
import LuxuryProfile from "../LuxuryProfile";
import StudioProfile from "../StudioProfile";
import TemplateProfile from "../TemplateProfile";

/**
 * Secondary trainer page route — /trainers/{trainerSlug}/{pageSlug}.
 *
 * Same render path as the primary route at /trainers/[id]/page.tsx, but
 * sources `customization` (template + copy + sections + colors) from the
 * specific `trainer_pages` row matching pageSlug instead of the primary one.
 * All shared data (services, packages, certifications, gallery, reviews,
 * profile, identity) comes from the same master tables, so a price edit on
 * the primary page propagates here too.
 *
 * Static sibling routes (/book, /gallery) win over [pageSlug] via Next.js
 * routing precedence; RESERVED_SLUGS in studio/pages/actions.ts mirrors that
 * list so trainers can't create a page-slug that would shadow a real route.
 *
 * Drafts (status='draft') are visible only to the owner — RLS in the page
 * fetcher already enforces this.
 */
export default async function SecondaryTrainerPage(props: PageProps<"/trainers/[id]/[pageSlug]">) {
  const { id, pageSlug } = await props.params;

  const trainer = await getTrainerBySlug(id);
  if (!trainer) notFound();

  const pageHit = await getTrainerPageByPath(id, pageSlug);
  if (!pageHit) notFound();

  // Override the trainer's customization with the secondary page's. The
  // template switch below dispatches based on this override, so the same
  // trainer can present completely different visuals at /trainers/{slug}/b2b
  // vs /trainers/{slug}/retreats.
  trainer.customization = pageHit.page.customization;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // In-page editing was removed; all edits live in /studio/design. See
  // /trainers/[id]/page.tsx for the same comment.
  const trainerDbId = pageHit.trainerId;
  const isOwner = !!(user && trainerDbId === user.id);
  const editMode = false;
  const published = pageHit.page.status === "published";

  // Drafts are 404 for non-owners (RLS already filters but we want a clean
  // notFound rather than an empty render in case the read sneaks through).
  if (!published && !isOwner) notFound();

  let initialIsFavorite = false;
  const needsLoginToFavorite = !user;
  if (user && !isOwner) {
    initialIsFavorite = await queryIsFavorite(user.id, trainerDbId);
  }

  const isEmbed = (await headers()).get("x-embed") === "1";

  const tpl = trainer.customization.template;
  if (tpl === "premium") {
    return (
      <PremiumProfile
        trainer={trainer}
        trainerDbId={trainerDbId}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
        isEmbed={isEmbed}
      />
    );
  }
  if (tpl === "cinematic") {
    return (
      <CinematicProfile
        trainer={trainer}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
        isEmbed={isEmbed}
      />
    );
  }
  if (tpl === "signature") {
    return (
      <SignatureProfile
        trainer={trainer}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
        isEmbed={isEmbed}
      />
    );
  }
  if (tpl === "luxury") {
    return (
      <LuxuryProfile
        trainer={trainer}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
        isEmbed={isEmbed}
      />
    );
  }
  if (tpl === "studio") {
    return (
      <StudioProfile
        trainer={trainer}
        trainerDbId={trainerDbId}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
        isEmbed={isEmbed}
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
      isEmbed={isEmbed}
    />
  );
}
