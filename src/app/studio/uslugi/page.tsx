import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UslugiClient, { type Pkg, type Service } from "./UslugiClient";

/**
 * /studio/uslugi — unified offer page (design 33). One screen, three
 * modes via tabs at the top:
 *   Usługi    — single sessions (services table)
 *   Pakiety   — bundled sessions (packages table)
 *   Promocje  — discount codes / vouchers (placeholder; needs schema)
 *
 * Replaces the older split /studio/services + /studio/packages
 * pages, both of which now redirect here. Reuses the same actions
 * (createService / updateService / deleteService and the package
 * equivalents) so the underlying CRUD doesn't change — only the
 * presentation.
 */
export default async function UslugiPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/uslugi");

  const params = (await searchParams) ?? {};
  const allowed = ["uslugi", "pakiety", "promocje"] as const;
  type Mode = (typeof allowed)[number];
  const mode: Mode = (allowed as readonly string[]).includes(params.mode ?? "")
    ? (params.mode as Mode)
    : "uslugi";

  const [{ data: services }, { data: packages }, { count: monthBookingsCount }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration, price, position")
      .eq("trainer_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("packages")
      .select("id, name, description, items, price, period, featured, position, sessions_total")
      .eq("trainer_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .gte("start_time", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  return (
    <UslugiClient
      mode={mode}
      services={(services ?? []) as Service[]}
      packages={(packages ?? []) as Pkg[]}
      monthBookings={monthBookingsCount ?? 0}
    />
  );
}
