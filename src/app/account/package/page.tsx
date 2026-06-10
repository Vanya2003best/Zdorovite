import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MojPakiet, {
  type MojPakietData,
  type PackageHero,
  type PackageSessionRow,
  type AlternativePackage,
} from "./MojPakiet";

const DONE_STATUSES = ["completed", "paid"];
const PL_MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/**
 * /account/package — Mój pakiet (design 39).
 *
 * Server orchestrator: looks at this client's bookings, finds the most-
 * active package_id (one with the most sessions), reconstructs the
 * package state from the package row + bookings linked to it, and
 * fetches alternative packages from the same trainer for the upgrade
 * panel. Schema is real for current/usage/upgrade panels; invoices and
 * payment-method panels render honest empty states because we don't
 * have those tables yet.
 */
export default async function PackagePage() {
  const { user } = await requireClient("/account/package");
  const supabase = await createClient();

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      `
      id, trainer_id, start_time, end_time, status, price, package_id,
      service_name, service_duration,
      service:services ( name, duration ),
      package:packages ( id, name, description, price, sessions_total ),
      trainer:trainers ( slug, location, profile:profiles!id ( display_name ) )
    `,
    )
    .eq("client_id", user.id)
    .order("start_time", { ascending: true });

  const bookings = (bookingsRaw ?? []) as unknown as Array<{
    id: string;
    trainer_id: string;
    start_time: string;
    end_time: string;
    status: string;
    price: number;
    package_id: string | null;
    service_name: string | null;
    service_duration: number | null;
    service: { name: string; duration: number } | null;
    package: {
      id: string;
      name: string;
      description: string | null;
      price: number;
      sessions_total: number | null;
    } | null;
    trainer: {
      slug: string;
      location: string;
      profile: { display_name: string | null } | null;
    } | null;
  }>;

  // Pick the most-active package_id.
  const pkgUsage = new Map<string, number>();
  for (const b of bookings) {
    if (b.package_id) pkgUsage.set(b.package_id, (pkgUsage.get(b.package_id) ?? 0) + 1);
  }
  const activePackageId =
    Array.from(pkgUsage.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  let hero: PackageHero | null = null;
  let sessions: PackageSessionRow[] = [];
  let weeklyAvg: number | null = null;
  let daysActive = 0;

  if (activePackageId) {
    const pkgBookings = bookings.filter((b) => b.package_id === activePackageId);
    const firstRow = pkgBookings[0];
    const pkg = firstRow?.package ?? null;

    if (pkg && pkg.sessions_total) {
      const now = new Date();
      const done = pkgBookings.filter((b) => DONE_STATUSES.includes(b.status) || (b.status === "confirmed" && new Date(b.end_time) < now)).length;
      const upcoming = pkgBookings.filter((b) => b.status !== "cancelled" && new Date(b.start_time) > now).length;

      const trainerName = firstRow?.trainer?.profile?.display_name?.split(" ")[0] ?? null;
      const description = pkg.description?.trim()
        ? pkg.description
        : `${pkg.sessions_total} sesji${trainerName ? ` z trenerem ${trainerName}` : ""}. Niewykorzystane sesje wygasają po 30 dniach od pierwszej rezerwacji.`;

      hero = {
        name: pkg.name,
        description,
        total: pkg.sessions_total,
        done,
        scheduled: upcoming,
        firstBookedIso: pkgBookings[0]?.start_time ?? null,
        lastBookedIso: pkgBookings[pkgBookings.length - 1]?.start_time ?? null,
        pricePaid: pkg.price,
        pricePerSession: pkg.price / pkg.sessions_total,
        trainerName: firstRow?.trainer?.profile?.display_name ?? null,
        trainerSlug: firstRow?.trainer?.slug ?? null,
        trainerId: firstRow?.trainer_id ?? null,
      };

      // Build session rows for the usage panel — already ordered by start_time asc.
      let runningLeft = pkg.sessions_total;
      sessions = pkgBookings.map((b) => {
        const d = new Date(b.start_time);
        const wasDone = DONE_STATUSES.includes(b.status) || (b.status === "confirmed" && new Date(b.end_time) < now);
        const isCancelled = b.status === "cancelled";
        const isUpcoming = !isCancelled && !wasDone;
        if (wasDone) runningLeft -= 1;
        // Cancelled refunds the slot — leave runningLeft unchanged
        const state: PackageSessionRow["state"] = isCancelled ? "cancelled" : isUpcoming ? "upcoming" : "done";
        return {
          id: b.id,
          iso: b.start_time,
          monthShort: PL_MONTHS_SHORT[d.getMonth()],
          dayNum: d.getDate(),
          serviceName: b.service_name ?? b.service?.name ?? "Sesja",
          durationMin: b.service_duration ?? b.service?.duration ?? 60,
          location: firstRow?.trainer?.location ?? "",
          state,
          sessionsLeftAfter: Math.max(0, runningLeft),
        };
      });

      // Weekly average — done sessions / weeks active.
      if (pkgBookings.length >= 2 && done > 0) {
        const firstT = new Date(pkgBookings[0].start_time).getTime();
        const lastT = Date.now();
        const weeks = Math.max(1, (lastT - firstT) / (7 * 86_400_000));
        weeklyAvg = done / weeks;
      }
      if (pkgBookings.length > 0) {
        daysActive = Math.round((Date.now() - new Date(pkgBookings[0].start_time).getTime()) / 86_400_000);
      }
    }
  }

  // Alternatives — packages from the same trainer (or fallback to first
  // trainer the client has booked with).
  const primaryTrainerId =
    hero?.trainerId ?? bookings[0]?.trainer_id ?? null;
  let alternatives: AlternativePackage[] = [];
  if (primaryTrainerId) {
    const { data: altRaw } = await supabase
      .from("packages")
      .select("id, name, description, price, sessions_total, trainer:trainers ( slug )")
      .eq("trainer_id", primaryTrainerId)
      .order("price", { ascending: true });
    const alts = (altRaw ?? []) as unknown as Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      sessions_total: number | null;
      trainer: { slug: string } | { slug: string }[] | null;
    }>;
    if (alts.length > 0) {
      const validAlts = alts.filter((a) => a.sessions_total && a.sessions_total > 0);
      // "Save" = how much you save buying this bundle vs. paying the most
      // expensive per-session rate (typical framing: "Oszcz. 100 PLN vs Start").
      // The most-expensive-per-session package shows save = 0.
      const maxPerSession = Math.max(
        ...validAlts.map((a) => a.price / (a.sessions_total ?? 1)),
      );
      const popularId = (() => {
        // Pick highest sessions_total among non-current as "Najlepszy wybór".
        const candidates = validAlts.filter((a) => a.id !== activePackageId);
        if (candidates.length === 0) return null;
        return candidates.sort((a, b) => (b.sessions_total ?? 0) - (a.sessions_total ?? 0))[0].id;
      })();
      alternatives = validAlts.map((a) => {
        const total = a.sessions_total ?? 1;
        const perSession = a.price / total;
        const trainerSlug = Array.isArray(a.trainer) ? a.trainer[0]?.slug ?? "" : a.trainer?.slug ?? "";
        const savePln = Math.max(0, Math.round((maxPerSession - perSession) * total));
        return {
          id: a.id,
          name: a.name,
          description: a.description ?? "",
          price: a.price,
          sessionsTotal: total,
          pricePerSession: perSession,
          savePln,
          isCurrent: a.id === activePackageId,
          isPopular: a.id === popularId,
          trainerSlug,
        };
      });
    }
  }

  const data: MojPakietData = {
    hero,
    sessions,
    alternatives,
    weeklyAvg,
    daysActive,
  };

  return <MojPakiet data={data} />;
}
