import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { isFavorite as queryIsFavorite } from "@/lib/db/favorites";
import { createClient } from "@/lib/supabase/server";
import CinematicProfile from "./CinematicProfile";
import PremiumProfile from "./PremiumProfile";
import SignatureProfile from "./SignatureProfile";
import LuxuryProfile from "./LuxuryProfile";
import StudioProfile from "./StudioProfile";
import TemplateProfile from "./TemplateProfile";

export default async function TrainerProfilePage(props: PageProps<"/trainers/[id]">) {
  const { id } = await props.params;

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

  // In-page editing on /trainers/[id]?edit=1 was removed in favour of a single
  // editor at /studio/design. Owner FAB/HeaderButton on the public profile now
  // link to that editor instead. Profile components still accept `editMode` —
  // /studio/design renders them with editMode=true directly into its canvas.
  const isOwner = !!(user && trainerDbId === user.id);
  const editMode = false;
  const published = trainerRow?.published ?? true;

  // Initial favorite state (for the heart button SSR).
  let initialIsFavorite = false;
  const needsLoginToFavorite = !user;
  if (user && !isOwner && trainerDbId) {
    initialIsFavorite = await queryIsFavorite(user.id, trainerDbId);
  }

  // x-embed=1 (set by middleware when ?embed=1 is in the URL) hides site
  // chrome — header, footer, breadcrumbs, mobile CTA — so the profile renders
  // cleanly inside an external embed. /studio/design itself does NOT use
  // x-embed; it renders profile components directly with isEmbed=true.
  const isEmbed = (await headers()).get("x-embed") === "1";

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
        isEmbed={isEmbed}
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
        isEmbed={isEmbed}
      />
    );
  }
  if (trainer.customization.template === "signature") {
    // Fetch the trainer's working day-of-week set so the hero booking widget
    // can highlight bookable days. Only Signature uses this (yet) — kept
    // inside the branch to avoid an extra round-trip on other templates.
    let availabilityDows: number[] = [];
    if (trainerDbId) {
      const { data: rules } = await supabase
        .from("availability_rules")
        .select("day_of_week")
        .eq("trainer_id", trainerDbId);
      availabilityDows = Array.from(new Set((rules ?? []).map((r) => r.day_of_week as number)));
    }
    return (
      <SignatureProfile
        trainer={trainer}
        trainerDbId={trainerDbId}
        availabilityDows={availabilityDows}
        editMode={editMode}
        isOwner={isOwner}
        published={published}
        initialIsFavorite={initialIsFavorite}
        needsLoginToFavorite={needsLoginToFavorite}
        isEmbed={isEmbed}
      />
    );
  }
  if (trainer.customization.template === "luxury") {
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
  if (trainer.customization.template === "studio") {
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
