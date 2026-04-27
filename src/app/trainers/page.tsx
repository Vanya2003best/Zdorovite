import { redirect } from "next/navigation";
import { getTrainers } from "@/lib/db/trainers";
import { getFavoriteTrainerIds } from "@/lib/db/favorites";
import { createClient } from "@/lib/supabase/server";
import CatalogClient from "./CatalogClient";

type SP = Promise<{ fav?: string }>;

export default async function TrainersPage(props: { searchParams: SP }) {
  const sp = await props.searchParams;
  const wantsFavOnly = sp?.fav === "1";

  // Need the current user to (a) gate the favorites filter behind login and
  // (b) fetch the right set of trainer ids when the filter is on.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (wantsFavOnly && !user) {
    redirect("/login?next=/trainers?fav=1");
  }

  // Fetch the full catalog. Trainers tables aren't huge — filtering after
  // the fetch keeps the favorites query independent of trainers RLS.
  let trainers = await getTrainers();

  if (wantsFavOnly && user) {
    const favIds = new Set(await getFavoriteTrainerIds(user.id));
    // trainer.id from the mapper is the slug; we need to compare DB uuids.
    // Re-query the DB id alongside the slug for the trainers we have, so we
    // can filter without changing the existing mapping shape.
    const { data: idRows } = await supabase
      .from("trainers")
      .select("id, slug")
      .in("slug", trainers.map((t) => t.id));
    const slugToDbId = new Map((idRows ?? []).map((r) => [r.slug as string, r.id as string]));
    trainers = trainers.filter((t) => {
      const dbId = slugToDbId.get(t.id);
      return dbId !== undefined && favIds.has(dbId);
    });
  }

  return (
    <CatalogClient
      trainers={trainers}
      isLoggedIn={!!user}
      favActive={wantsFavOnly}
    />
  );
}
