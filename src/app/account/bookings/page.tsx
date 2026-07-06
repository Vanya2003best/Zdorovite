import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/auth";
import { getPendingRescheduleMap } from "@/lib/db/reschedule";
import type { ReviewCategoryKey } from "@/lib/db/reviews";
import MojeTreningi, {
  type Booking,
  type ActivePackage,
  type ServiceOption,
  type MojeTreningiData,
} from "./MojeTreningi";

/**
 * /account/bookings — Moje treningi (design 36).
 *
 * Server orchestrator: bundles upcoming/history/cancelled bookings,
 * the active package, the primary trainer's services for the Book
 * panel, and a few aggregate metrics (hours, longest streak, avg
 * rating given by this client, pending reviews).
 */

const PL_MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];
const PL_MONTHS_NOM = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

const DONE_STATUSES = ["completed", "paid"];

type RawBooking = {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  package_id: string | null;
  service_name: string | null;
  service_duration: number | null;
  package_name: string | null;
  service: { id: string; name: string; duration: number } | null;
  package: {
    name: string;
    sessions_total: number | null;
  } | null;
  trainer: {
    slug: string;
    location: string;
    profile: { display_name: string | null } | null;
  } | null;
};

export default async function BookingsPage() {
  const { user } = await requireClient("/account/bookings");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, trainer_id, start_time, end_time, status, price, package_id,
      service_name, service_duration, package_name,
      service:services ( id, name, duration ),
      package:packages ( name, sessions_total ),
      trainer:trainers (
        slug, location,
        profile:profiles!id ( display_name )
      )
    `,
    )
    .eq("client_id", user.id)
    .order("start_time", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawBooking[];
  const now = new Date();

  // Reschedule pending → drives the "Czeka na zmianę" tag on each card.
  const pendingResMap = await getPendingRescheduleMap(rows.map((r) => r.id));

  // Buckets — upcoming = future + not cancelled, history = past completed,
  // cancelled = anything cancelled (regardless of date).
  const upcoming: Booking[] = [];
  const history: Booking[] = [];
  const cancelled: Booking[] = [];

  for (const r of rows) {
    const b = mapBooking(r, pendingResMap.has(r.id));
    if (r.status === "cancelled") {
      cancelled.push(b);
    } else if (new Date(r.start_time) > now) {
      upcoming.push(b);
    } else if (DONE_STATUSES.includes(r.status)) {
      history.push(b);
    } else if (r.status === "confirmed" && new Date(r.end_time) < now) {
      // Past confirmed sessions never explicitly marked completed —
      // treat them as completed for display purposes.
      history.push(b);
    }
  }
  history.reverse(); // newest first

  // Active package — pick the one with most bookings (mirrors /account dashboard).
  const pkgGroups = new Map<
    string,
    { name: string; done: number; total: number | null }
  >();
  for (const r of rows) {
    if (!r.package_id || !r.package) continue;
    const existing = pkgGroups.get(r.package_id);
    if (existing) {
      if (DONE_STATUSES.includes(r.status)) existing.done += 1;
    } else {
      pkgGroups.set(r.package_id, {
        name: r.package.name,
        done: DONE_STATUSES.includes(r.status) ? 1 : 0,
        total: r.package.sessions_total,
      });
    }
  }
  const activePackageRaw = Array.from(pkgGroups.values()).sort((a, b) => b.done - a.done)[0] ?? null;

  // Compute pace: how many sessions per week the client has been doing
  // in the last 4 weeks of the package (rough heuristic).
  let perWeek: number | null = null;
  let finishEtaLabel: string | null = null;
  if (activePackageRaw && activePackageRaw.total) {
    const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);
    const recentDone = history.filter((h) => new Date(h.startIso) >= fourWeeksAgo).length;
    if (recentDone > 0) {
      perWeek = recentDone / 4;
      const remaining = Math.max(0, activePackageRaw.total - activePackageRaw.done);
      const weeks = perWeek > 0 ? Math.ceil(remaining / perWeek) : 0;
      const eta = new Date(now.getTime() + weeks * 7 * 86_400_000);
      finishEtaLabel = `${eta.getDate()}.${String(eta.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const activePackage: ActivePackage | null =
    activePackageRaw && activePackageRaw.total
      ? {
          name: activePackageRaw.name,
          done: activePackageRaw.done,
          total: activePackageRaw.total,
          // packages.valid_until column doesn't exist yet — once added,
          // surface it here as `formatPLDate(activePackageRaw.validUntil)`.
          validUntilLabel: null,
          perWeek,
          finishEtaLabel,
        }
      : null;

  // Category counts — used by the filter chips.
  const catCount = new Map<string, number>();
  for (const b of [...upcoming, ...history]) {
    catCount.set(b.category, (catCount.get(b.category) ?? 0) + 1);
  }
  const categoryCounts = Array.from(catCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // History hours + longest streak + first booking date.
  const historyHours = Math.round(
    history.reduce((acc, h) => acc + h.durationMin / 60, 0),
  );
  const firstBookingDateLabel =
    history.length > 0
      ? formatPLDate(history[history.length - 1].startIso.slice(0, 10))
      : null;

  let longestStreakWeeks = 0;
  if (history.length > 0) {
    const weekKeys = new Set(history.map((h) => weekKey(new Date(h.startIso))));
    let cur = 0,
      best = 0;
    let cursor = mondayOf(new Date(history[history.length - 1].startIso));
    const lastMonday = mondayOf(now);
    while (cursor.getTime() <= lastMonday.getTime()) {
      if (weekKeys.has(weekKey(cursor))) {
        cur += 1;
        best = Math.max(best, cur);
      } else {
        cur = 0;
      }
      cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    }
    longestStreakWeeks = best;
  }

  // Reviews this client wrote — drives the avg-rating-given card, the
  // pending-reviews count and the per-card review state (thank-you block
  // vs. "Wystaw opinię" form vs. already-reviewed-elsewhere).
  const { data: reviewsRaw } = await supabase
    .from("reviews")
    .select(
      "trainer_id, rating, text, booking_id, cat_wiedza, cat_atmosfera, cat_punktualnosc, cat_efekty",
    )
    .eq("author_id", user.id);
  const myReviews = reviewsRaw ?? [];
  const avgRatingGiven =
    myReviews.length > 0
      ? Number(
          (myReviews.reduce((a, r) => a + (r.rating ?? 0), 0) / myReviews.length).toFixed(2),
        )
      : null;
  const reviewByBookingId = new Map(
    myReviews.filter((r) => r.booking_id).map((r) => [r.booking_id as string, r]),
  );
  const reviewedTrainerIds = new Set(myReviews.map((r) => r.trainer_id));
  for (const h of history) {
    const r = reviewByBookingId.get(h.id);
    h.myReview = r
      ? { rating: r.rating, text: r.text, categories: reviewCategories(r) }
      : null;
    h.trainerReviewed = reviewedTrainerIds.has(h.trainerId);
  }
  // One review per client per trainer (schema unique constraint) — so
  // "opinii do napisania" = distinct trainers with a finished session and
  // no review from this client yet, not raw unreviewed-booking count.
  const pendingReviews = new Set(
    history.filter((h) => !h.trainerReviewed).map((h) => h.trainerId),
  ).size;

  // Bookable services from the most-frequent trainer this client books with.
  const trainerCount = new Map<string, number>();
  for (const r of rows) {
    if (!r.trainer_id) continue;
    trainerCount.set(r.trainer_id, (trainerCount.get(r.trainer_id) ?? 0) + 1);
  }
  const primaryTrainerId = Array.from(trainerCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  let primaryTrainerName: string | null = null;
  let bookableServices: ServiceOption[] = [];
  if (primaryTrainerId) {
    const primaryRow = rows.find((r) => r.trainer_id === primaryTrainerId);
    primaryTrainerName = primaryRow?.trainer?.profile?.display_name ?? null;
    const slug = primaryRow?.trainer?.slug ?? "";
    const { data: svcRaw } = await supabase
      .from("services")
      .select("id, name, description, duration, price")
      .eq("trainer_id", primaryTrainerId)
      .order("price", { ascending: true });
    bookableServices = (svcRaw ?? []).map((s) => ({
      id: s.id,
      trainerSlug: slug,
      name: s.name,
      description: s.description ?? "",
      durationMin: s.duration,
      price: s.price,
      emoji: pickEmoji(s.name),
      // Treat the matching service as "from package" if its name appears
      // in the active package's bookings — covers the design's "Z pakietu"
      // visual without a dedicated services<->packages join table.
      fromPackage: !!activePackage && rows.some((r) => r.package_id && r.service?.id === s.id),
    }));
  }

  // Mini-cal — current month, count per day.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthSessions: { day: number; count: number }[] = [];
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    monthSessions.push({ day: d, count: 0 });
  }
  for (const r of rows) {
    const t = new Date(r.start_time);
    if (t >= monthStart && t <= monthEnd && r.status !== "cancelled") {
      monthSessions[t.getDate() - 1].count += 1;
    }
  }
  const monthTotal = monthSessions.reduce((a, s) => a + s.count, 0);
  const monthLabel = `${PL_MONTHS_NOM[now.getMonth()]} ${now.getFullYear()}`;

  // Cancellations this month.
  const cancelsThisMonth = cancelled.filter((c) => {
    const t = new Date(c.startIso);
    return t >= monthStart && t <= monthEnd;
  }).length;

  const dataOut: MojeTreningiData = {
    upcoming,
    history,
    cancelled,
    activePackage,
    categoryCounts,
    historyHours,
    longestStreakWeeks,
    avgRatingGiven,
    pendingReviews,
    firstBookingDateLabel,
    bookableServices,
    primaryTrainerName,
    monthSessions,
    monthLabel,
    monthTotal,
    today: now.getDate(),
    cancelsThisMonth,
    cancelLimit: 3,
  };

  return <MojeTreningi data={dataOut} />;
}

function mapBooking(r: RawBooking, pendingReschedule: boolean): Booking {
  const serviceName =
    r.service_name ?? r.service?.name ?? r.package_name ?? r.package?.name ?? "Sesja";
  const trainerName = r.trainer?.profile?.display_name ?? "Trener";
  const initials = trainerName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const nameLower = serviceName.toLowerCase();
  let category = "Inne";
  if (/siłow/i.test(nameLower)) category = "1:1 siłowy";
  else if (/cardio|outdoor|bieg|rower/i.test(nameLower)) category = "Cardio outdoor";
  else if (/online|zoom|konsultac/i.test(nameLower)) category = "Online";
  else if (/diagnost|fms/i.test(nameLower)) category = "Diagnostyka";
  else if (/grupow|funkcjon/i.test(nameLower)) category = "Grupowy";

  let variant: "studio" | "outdoor" | "online" = "studio";
  if (/online|zoom|konsultac/i.test(nameLower)) variant = "online";
  else if (/cardio|outdoor|bieg|park/i.test(nameLower)) variant = "outdoor";

  const fromPackage = !!r.package_id;
  const total = r.package?.sessions_total ?? null;

  return {
    id: r.id,
    trainerId: r.trainer_id,
    trainerSlug: r.trainer?.slug ?? "",
    trainerName,
    trainerInitials: initials || "T",
    trainerLocation: r.trainer?.location ?? "",
    startIso: r.start_time,
    endIso: r.end_time,
    status: r.status,
    price: r.price,
    serviceName,
    durationMin: r.service_duration ?? r.service?.duration ?? 60,
    fromPackage,
    packageProgress: fromPackage && total ? { done: 0, total } : null,
    category,
    variant,
    pendingReschedule,
    // Filled in after the client's reviews are fetched (history only).
    myReview: null,
    trainerReviewed: false,
  };
}

/** cat_* columns (migration 029) → chip keys for the client-side card. */
function reviewCategories(r: {
  cat_wiedza: number | null;
  cat_atmosfera: number | null;
  cat_punktualnosc: number | null;
  cat_efekty: number | null;
}): ReviewCategoryKey[] {
  const out: ReviewCategoryKey[] = [];
  if (r.cat_wiedza != null) out.push("wiedza");
  if (r.cat_atmosfera != null) out.push("atmosfera");
  if (r.cat_punktualnosc != null) out.push("punktualnosc");
  if (r.cat_efekty != null) out.push("efekty");
  return out;
}

function pickEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/siłow|gym|hantl|sztang/.test(n)) return "💪";
  if (/online|zoom|konsultac/.test(n)) return "💻";
  if (/cardio|outdoor|bieg|rower/.test(n)) return "🌳";
  if (/diagnost|fms|test/.test(n)) return "🎯";
  if (/grupow|funkcjon/.test(n)) return "👥";
  if (/joga|stretch|mobil/.test(n)) return "🧘";
  return "🏋️";
}

function formatPLDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return `${d.getUTCDate()} ${PL_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  const offset = (dow + 6) % 7;
  r.setDate(r.getDate() - offset);
  return r;
}

function weekKey(d: Date): string {
  const m = mondayOf(d);
  return `${m.getFullYear()}-${m.getMonth() + 1}-${m.getDate()}`;
}
