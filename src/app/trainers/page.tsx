import { getTrainers } from "@/lib/db/trainers";
import CatalogClient from "./CatalogClient";

export default async function TrainersPage() {
  const trainers = await getTrainers();
  return <CatalogClient trainers={trainers} />;
}
