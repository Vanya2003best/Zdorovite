import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFavoriteTrainersBrief } from "@/lib/db/favorites";
import { getGoals } from "@/lib/db/goals";
import { getLatestWeight, getYearStartWeight } from "@/lib/db/weight";
import { getRecentNotifications } from "@/lib/db/notifications";
import { getRecommendedTrainer } from "@/lib/db/recommendations";
import KlientPulpit, {
  type KlientPulpitData,
  type WeekDay,
  type HistoryItem,
  type Notif,
  type RecommendedTrainer,
  type SpotlightTrainer,
} from "./KlientPulpit";

/**
 * Client-side dashboard. Server orchestrator fetches everything the
 * KlientPulpit component needs (next session, packages, weight, goals,
 * recommendations, recent notifications, session history) and passes
 * it through. Layout follows design 35.
 */

const PL_DAYS_SHORT = ["NIE", "PON", "WT", "ŚR", "CZW", "PT", "SOB"];
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

type BookingRow = {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  package_id: string | null;
  service_name: string | null;
  package_name: string | null;
  service: { name: string; duration: number } | null;
  package: { name: string; sessions_total: number | null; price: number } | null;
  trainer: {
    slug: string;
    location: string;
    tagline: string;
    rating: number | null;
    review_count: number | null;
    profile: { display_name: string; avatar_url: string | null } | null;
  } | null;
};

const DONE_STATUSES = ["confirmed", "paid", "completed"];

export default async function AccountDashboardPage() {
  const { user, profile } = await requireClient("/account");
  const supabase = await createClient();

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = mondayOf(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    { data: yearBookingsRaw },
    goals,
    latestWeight,
    yearStartWeight,
    favorites,
    reco,
    notifs,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, trainer_id, start_time, end_time, status, price, package_id,
        service_name, package_name,
        service:services ( name, duration ),
        package:packages ( name, sessions_total, price ),
        trainer:trainers!trainer_id (
          slug, location, tagline, rating, review_count,
          profile:profiles!id ( display_name, avatar_url )
        )
      `)
      .eq("client_id", user.id)
      .gte("start_time", yearStart.toISOString())
      .order("start_time", { ascending: true }),
    getGoals(user.id),
    getLatestWeight(user.id),
    getYearStartWeight(user.id),
    getFavoriteTrainersBrief(user.id),
    getRecommendedTrainer(user.id),
    getRecentNotifications(user.id, 5),
  ]);

  const yearBookings = (yearBookingsRaw ?? []) as unknown as BookingRow[];

  // Year + month session counts (only completed-ish statuses).
  const yearSessionsDone = yearBookings.filter((b) => DONE_STATUSES.includes(b.status)).length;
  const monthSessionsDone = yearBookings.filter(
    (b) => DONE_STATUSES.includes(b.status) && new Date(b.start_time) >= monthStart,
  ).length;

  // Next session — first future booking with confirmed-ish status.
  const upcoming = yearBookings.filter(
    (b) =>
      new Date(b.start_time).getTime() >= now.getTime() &&
      ["confirmed", "paid", "pending"].includes(b.status),
  );
  const nextRow = upcoming[0] ?? null;

  // Active package — group by package_id, pick the one with the most
  // bookings as 'most relevant' (matches what current page did).
  const pkgGroups = new Map<
    string,
    {
      name: string;
      trainerName: string;
      done: number;
      total: number | null;
      pricePerSession: number | null;
      lastBookingDate: string;
    }
  >();
  for (const b of yearBookings) {
    if (!b.package_id || !b.package) continue;
    const existing = pkgGroups.get(b.package_id);
    if (existing) {
      if (DONE_STATUSES.includes(b.status)) existing.done += 1;
      if (b.start_time > existing.lastBookingDate) existing.lastBookingDate = b.start_time;
    } else {
      const total = b.package.sessions_total;
      const perSession = total && total > 0 ? Math.round(b.package.price / total) : null;
      pkgGroups.set(b.package_id, {
        name: b.package.name,
        trainerName: b.trainer?.profile?.display_name ?? "Trener",
        done: DONE_STATUSES.includes(b.status) ? 1 : 0,
        total,
        pricePerSession: perSession,
        lastBookingDate: b.start_time,
      });
    }
  }
  const activePackage = Array.from(pkgGroups.values()).sort((a, b) => b.done - a.done)[0] ?? null;

  // Weight delta vs Jan 1 of current year.
  const weightDelta =
    latestWeight && yearStartWeight && latestWeight.recordedAt !== yearStartWeight.recordedAt
      ? Number((latestWeight.weightKg - yearStartWeight.weightKg).toFixed(1))
      : null;

  // Top goal — first by progress fraction; getGoals returns sorted list.
  const topGoalRaw = goals[0] ?? null;
  const topGoal = topGoalRaw
    ? {
        title: topGoalRaw.title,
        pct: topGoalRaw.pct,
        targetDate: topGoalRaw.targetDate
          ? `${PL_MONTHS[new Date(`${topGoalRaw.targetDate}T12:00:00Z`).getUTCMonth()]} ${new Date(`${topGoalRaw.targetDate}T12:00:00Z`).getUTCFullYear()}`
          : null,
      }
    : null;

  // Streak — consecutive past weeks with at least one completed
  // booking ending in that week. Cap at 12 to avoid scanning forever.
  let streakWeeks = 0;
  for (let i = 0; i < 12; i++) {
    const ws = mondayOf(new Date(weekStart.getTime() - i * 7 * 86_400_000));
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const has = yearBookings.some((b) => {
      if (!DONE_STATUSES.includes(b.status)) return false;
      const t = new Date(b.start_time).getTime();
      return t >= ws.getTime() && t < we.getTime();
    });
    if (has) streakWeeks += 1;
    else break;
  }

  // Week plan — Mon..Sun of the current week, first session per day.
  const weekUpcoming: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const same = (b: BookingRow) => {
      const bd = new Date(b.start_time);
      return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth() && bd.getDate() === d.getDate();
    };
    const session = yearBookings
      .filter(
        (b) =>
          same(b) &&
          (DONE_STATUSES.includes(b.status) || b.status === "pending"),
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    return {
      iso: d.toISOString(),
      dayShort: PL_DAYS_SHORT[d.getDay()],
      dayNum: d.getDate(),
      isToday:
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate(),
      session: session
        ? {
            time: new Date(session.start_time).toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            type: serviceShort(session),
          }
        : null,
    };
  });

  // Spotlight trainer — favorite first; fall back to last-booked.
  let spotlightTrainer: SpotlightTrainer | null = null;
  const fav = favorites[0];
  if (fav) {
    spotlightTrainer = {
      slug: fav.slug,
      name: fav.name,
      avatar: fav.avatar ?? null,
      tagline: fav.mainSpec ?? "",
      rating: fav.rating,
      reviewCount: 0,
      lastMessage: null,
    };
  } else {
    const lastBooked = [...yearBookings]
      .reverse()
      .find((b) => !!b.trainer);
    if (lastBooked?.trainer) {
      const t = lastBooked.trainer;
      spotlightTrainer = {
        slug: t.slug,
        name: t.profile?.display_name ?? "Trener",
        avatar: t.profile?.avatar_url ?? null,
        tagline: t.tagline ?? "",
        rating: Number(t.rating ?? 0),
        reviewCount: Number(t.review_count ?? 0),
        lastMessage: null,
      };
    }
  }

  // Pull the most recent message from this trainer for the spotlight
  // card's quote area. Cheap follow-up query when we have a slug.
  if (spotlightTrainer) {
    const trainerId = nextRow?.trainer_id ?? lastBookedTrainerId(yearBookings);
    if (trainerId) {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("text, created_at")
        .eq("from_id", trainerId)
        .eq("to_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg) {
        spotlightTrainer.lastMessage = { text: lastMsg.text, at: lastMsg.created_at };
      }
    }
  }

  const recommendedTrainers: RecommendedTrainer[] = reco
    ? [
        {
          slug: reco.slug,
          name: reco.name,
          avatar: reco.avatar ?? null,
          pitch: reco.matchedSpec ?? reco.location ?? "Polecany trener",
          pricePerSession: reco.priceFrom,
          paletteIdx: 0,
        },
      ]
    : [];

  const notifications: Notif[] = (notifs ?? []).map((n) => ({
    id: n.id,
    text: n.title,
    whenIso: n.createdAt,
    unread: !n.readAt,
    tone: tone(n.kind),
  }));

  // History — last 5 completed past sessions, plus the next upcoming
  // (rendered as 'future' marker) so the timeline always has at least
  // one forward-looking entry.
  const past = [...yearBookings]
    .filter((b) => new Date(b.start_time) < now && DONE_STATUSES.includes(b.status))
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, 4);
  const history: HistoryItem[] = past.map((b) => ({
    id: b.id,
    whenIso: b.start_time,
    serviceName: serviceShort(b),
    trainerName: b.trainer?.profile?.display_name ?? "Trener",
    detail: b.package_id
      ? "Sesja w ramach pakietu"
      : `${b.service?.duration ?? 60} min · ${b.price} PLN`,
    trainerNote: null,
    future: false,
  }));
  if (nextRow) {
    history.unshift({
      id: nextRow.id,
      whenIso: nextRow.start_time,
      serviceName: serviceShort(nextRow),
      trainerName: nextRow.trainer?.profile?.display_name ?? "Trener",
      detail: "Najbliższa sesja",
      trainerNote: null,
      future: true,
    });
  }

  const data: KlientPulpitData = {
    firstName: profile.display_name.split(" ")[0] || "Klient",
    next: nextRow
      ? {
          id: nextRow.id,
          startTime: nextRow.start_time,
          endTime: nextRow.end_time,
          status: nextRow.status,
          serviceName: serviceShort(nextRow),
          durationMin: nextRow.service?.duration ?? 60,
          location: nextRow.trainer?.location ?? "",
          trainerSlug: nextRow.trainer?.slug ?? "",
          trainerId: nextRow.trainer_id,
          trainerName: nextRow.trainer?.profile?.display_name ?? "Trener",
          trainerAvatar: nextRow.trainer?.profile?.avatar_url ?? null,
          packageProgress:
            nextRow.package_id && activePackage && activePackage.total
              ? { done: activePackage.done, total: activePackage.total }
              : null,
        }
      : null,
    yearSessionsDone,
    monthSessionsDone,
    weekUpcoming,
    activePackage:
      activePackage && activePackage.total
        ? {
            name: activePackage.name,
            trainerName: activePackage.trainerName,
            done: activePackage.done,
            total: activePackage.total,
            validUntil: null,
            pricePerSession: activePackage.pricePerSession,
          }
        : null,
    weight: {
      latestKg: latestWeight?.weightKg ?? null,
      deltaSinceYearStart: weightDelta,
    },
    topGoal,
    spotlightTrainer,
    recommendedTrainers,
    notifications,
    history,
    streakWeeks,
  };

  return <KlientPulpit data={data} />;
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay(); // 0=Sun
  const offset = (dow + 6) % 7;
  r.setDate(r.getDate() - offset);
  return r;
}

function serviceShort(b: BookingRow): string {
  return b.service_name ?? b.package_name ?? b.service?.name ?? b.package?.name ?? "Sesja";
}

function lastBookedTrainerId(rows: BookingRow[]): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].trainer_id) return rows[i].trainer_id;
  }
  return null;
}

function tone(kind: string): "green" | "amber" | "blue" {
  if (kind === "warning") return "amber";
  if (kind === "info") return "blue";
  return "green";
}
