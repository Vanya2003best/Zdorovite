import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTrainerBySlug } from "@/lib/db/trainers";
import { getSpecLabel, getSpecIcon } from "@/data/specializations";
import MojTrener, {
  type MojTrenerData,
  type TrainerHero,
  type SpecBadge,
  type CertBadge,
  type ServiceTile,
  type PackageTile,
  type AvailabilityWindow,
  type ReviewItem,
  type ReviewSummary,
  type CollabHistory,
} from "./MojTrener";

const PL_DAYS_FULL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
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

/**
 * /account/trainer — Mój trener (design 40).
 *
 * Server orchestrator. Picks the most-frequent trainer from this client's
 * bookings and pulls the rich Trainer record (bio, specs, certs, services,
 * packages, reviews, availability_rules) plus realtime-ish collab metrics
 * (sessions all-time, attendance %, longest streak, response time from
 * messages).
 */
export default async function TrainerPage() {
  const { user, profile } = await requireClient("/account/trainer");
  const supabase = await createClient();

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      `
      id, trainer_id, start_time, end_time, status, package_id,
      trainer:trainers ( slug )
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
    package_id: string | null;
    trainer: { slug: string } | { slug: string }[] | null;
  }>;

  const trainerCount = new Map<string, number>();
  for (const b of bookings) trainerCount.set(b.trainer_id, (trainerCount.get(b.trainer_id) ?? 0) + 1);
  const primaryTrainerId = Array.from(trainerCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const primaryRow = primaryTrainerId ? bookings.find((b) => b.trainer_id === primaryTrainerId) : null;
  const primarySlug = primaryRow
    ? Array.isArray(primaryRow.trainer)
      ? primaryRow.trainer[0]?.slug ?? null
      : primaryRow.trainer?.slug ?? null
    : null;

  if (!primarySlug || !primaryTrainerId) {
    // Render empty state.
    return <MojTrener data={emptyData()} />;
  }

  const trainer = await getTrainerBySlug(primarySlug);
  if (!trainer) {
    return <MojTrener data={emptyData()} />;
  }

  // Parallel side queries — clients count, availability rules, recent
  // messages between this client and the trainer, certifications, and
  // packages.sessions_total (which isn't in the shared trainers SELECT).
  const [
    { count: clientsCount },
    { data: availRulesRaw },
    { data: messagesRaw },
    { data: certsRaw },
    { data: pkgSessionsRaw },
  ] = await Promise.all([
    supabase
      .from("trainer_clients")
      .select("client_id", { count: "exact", head: true })
      .eq("trainer_id", primaryTrainerId),
    supabase
      .from("availability_rules")
      .select("day_of_week, start_time, end_time")
      .eq("trainer_id", primaryTrainerId),
    supabase
      .from("messages")
      .select("from_id, to_id, created_at")
      .or(`and(from_id.eq.${user.id},to_id.eq.${primaryTrainerId}),and(from_id.eq.${primaryTrainerId},to_id.eq.${user.id})`)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("certifications")
      .select("id, text, position, verification_status")
      .eq("trainer_id", primaryTrainerId)
      .order("position", { ascending: true }),
    supabase
      .from("packages")
      .select("id, sessions_total")
      .eq("trainer_id", primaryTrainerId),
  ]);

  const pkgSessionsTotal = new Map<string, number>();
  for (const p of (pkgSessionsRaw ?? []) as Array<{ id: string; sessions_total: number | null }>) {
    if (p.sessions_total != null) pkgSessionsTotal.set(p.id, p.sessions_total);
  }

  const availabilityRules = (availRulesRaw ?? []) as unknown as Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  const messages = (messagesRaw ?? []) as unknown as Array<{
    from_id: string;
    to_id: string;
    created_at: string;
  }>;
  const certRows = (certsRaw ?? []) as unknown as Array<{
    id: string;
    text: string;
    position: number;
    verification_status: string | null;
  }>;

  // Online status — last incoming message from trainer < 30 min ago.
  const lastFromTrainer = messages.find((m) => m.from_id === primaryTrainerId);
  const onlineNow =
    lastFromTrainer != null && Date.now() - new Date(lastFromTrainer.created_at).getTime() < 30 * 60_000;

  // Response time — for each client message, find the next trainer message
  // and compute the gap. Average of gaps in hours.
  const responseHours = (() => {
    const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const deltas: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].from_id !== user.id) continue;
      // Find next trainer reply after this client message.
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].from_id === primaryTrainerId) {
          const dt = new Date(sorted[j].created_at).getTime() - new Date(sorted[i].created_at).getTime();
          if (dt > 0 && dt < 48 * 3_600_000) deltas.push(dt / 3_600_000);
          break;
        }
      }
    }
    if (deltas.length === 0) return null;
    const median = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
    return Math.max(1, Math.round(median));
  })();

  // Build hero. `trainer` is the MAPPED Trainer type from getTrainerBySlug
  // — slug is on `.id`, profile fields are flattened (name/avatar/avatarFocal),
  // and counts use camelCase (reviewCount, not review_count).
  const hero: TrainerHero = {
    slug: trainer.id,
    trainerId: primaryTrainerId,
    name: trainer.name || "Trener",
    initials:
      (trainer.name || "T")
        .split(" ")
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "T",
    avatarUrl: trainer.avatar ?? null,
    avatarFocal: trainer.avatarFocal ?? null,
    tagline: trainer.tagline,
    location: trainer.location,
    rating: Number(trainer.rating ?? 0),
    reviewCount: Number(trainer.reviewCount ?? 0),
    experienceYears: trainer.experience,
    clientsCount: clientsCount ?? 0,
    onlineNow,
    verified: certRows.some((c) => c.verification_status === "verified"),
    responseHours,
  };

  // Specs. The mapped Trainer already flattens specializations to a
  // string[] (Specialization ids), so we badge each entry directly.
  const specs: SpecBadge[] = (trainer.specializations ?? []).map((id) => ({
    id,
    label: getSpecLabel(id),
    emoji: getSpecIcon(id),
  }));

  // Certs.
  const certs: CertBadge[] = certRows.map((c) => ({
    id: c.id,
    text: c.text,
    verified: c.verification_status === "verified",
  }));

  // Services + packages — packages first, with isCurrent flag for the
  // package this client is most-using.
  const activePackageId = (() => {
    const pkgUsage = new Map<string, number>();
    for (const b of bookings) {
      if (b.trainer_id === primaryTrainerId && b.package_id)
        pkgUsage.set(b.package_id, (pkgUsage.get(b.package_id) ?? 0) + 1);
    }
    return Array.from(pkgUsage.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();

  // Service/Package types have id?: string and isPlaceholder?: boolean
  // (camelCase per mapper). Filter out unset ids so ServiceTile/PackageTile
  // can require id: string.
  const services: ServiceTile[] = (trainer.services ?? [])
    .filter((s) => !s.isPlaceholder && s.id)
    .map((s) => ({
      id: s.id as string,
      name: s.name,
      description: s.description ?? "",
      durationMin: s.duration,
      price: s.price,
    }));

  const packages: PackageTile[] = (trainer.packages ?? [])
    .filter((p) => !p.isPlaceholder && p.id)
    .map((p) => {
      const id = p.id as string;
      const total = pkgSessionsTotal.get(id) ?? null;
      return {
        id,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        sessionsTotal: total,
        pricePerSession: total ? p.price / total : null,
        isCurrent: id === activePackageId,
      };
    });

  // Availability windows — collapse rules into "Pn-Pt", "Sob", "Niedz" labels.
  const availability = buildAvailabilityWindows(availabilityRules);
  const nextSlotLabel = computeNextSlot(availabilityRules);

  // Reviews. Mapped Review type uses camelCase + flat author fields
  // (authorName / authorAvatar) and a pre-sliced `date` string (YYYY-MM-DD).
  const myDisplayName = profile.display_name;
  const reviews: ReviewItem[] = (trainer.reviews ?? []).map((r) => ({
    id: r.id,
    authorName: r.authorName || "Anonim",
    authorInitials: ((r.authorName || "?") + "  ")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    authorAvatarUrl: r.authorAvatar ?? null,
    isMe: r.authorName === myDisplayName,
    rating: r.rating,
    text: r.text,
    createdAtLabel: relativeLabel(r.date),
    reply: r.replyText
      ? { text: r.replyText, atLabel: r.replyAt ? relativeLabel(r.replyAt) : "" }
      : null,
  }));

  // Pull review category averages directly when migration 029 columns
  // exist. Falls back gracefully on 42703 (column doesn't exist).
  const reviewSummary: ReviewSummary = (() => {
    const reviewsList = trainer.reviews ?? [];
    const total = reviewsList.length;
    const bucket: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of reviewsList) {
      const idx = Math.max(0, Math.min(4, Math.round(r.rating) - 1));
      bucket[idx] += 1;
    }
    return {
      rating: hero.rating,
      total: hero.reviewCount > 0 ? hero.reviewCount : total,
      bucket,
      catAvg: { wiedza: null, atmosfera: null, punktualnosc: null, efekty: null },
    };
  })();

  // Try the rich SELECT for category averages (only relevant when
  // migration 029 has been applied). Falls back silently on 42703.
  const { data: catRows, error: catErr } = await supabase
    .from("reviews")
    .select("cat_wiedza, cat_atmosfera, cat_punktualnosc, cat_efekty")
    .eq("trainer_id", primaryTrainerId);
  if (!catErr && catRows && catRows.length > 0) {
    const rows = catRows as unknown as Array<{
      cat_wiedza: number | null;
      cat_atmosfera: number | null;
      cat_punktualnosc: number | null;
      cat_efekty: number | null;
    }>;
    reviewSummary.catAvg = {
      wiedza: avgNonNull(rows.map((r) => r.cat_wiedza)),
      atmosfera: avgNonNull(rows.map((r) => r.cat_atmosfera)),
      punktualnosc: avgNonNull(rows.map((r) => r.cat_punktualnosc)),
      efekty: avgNonNull(rows.map((r) => r.cat_efekty)),
    };
  }

  // Pending reviews this client owes — sessions completed without a review.
  const { data: myReviewsRaw } = await supabase
    .from("reviews")
    .select("booking_id")
    .eq("author_id", user.id);
  const reviewedBookingIds = new Set(
    ((myReviewsRaw ?? []) as Array<{ booking_id: string | null }>)
      .map((r) => r.booking_id)
      .filter((id): id is string => !!id),
  );
  const completedWithThisTrainer = bookings.filter(
    (b) =>
      b.trainer_id === primaryTrainerId &&
      (DONE_STATUSES.includes(b.status) || (b.status === "confirmed" && new Date(b.end_time) < new Date())),
  );
  const pendingReviews = completedWithThisTrainer.filter((b) => !reviewedBookingIds.has(b.id)).length;

  // Collab history.
  const collab: CollabHistory | null = (() => {
    const sessionsThisTrainer = bookings.filter((b) => b.trainer_id === primaryTrainerId);
    if (sessionsThisTrainer.length === 0) return null;
    const first = sessionsThisTrainer[0];
    const startDate = new Date(first.start_time);
    const monthsCoaching = Math.max(0, Math.round((Date.now() - startDate.getTime()) / 86_400_000 / 30));
    const total = completedWithThisTrainer.length;
    const cancelled = sessionsThisTrainer.filter((b) => b.status === "cancelled").length;
    const attended = total;
    const attendancePct = sessionsThisTrainer.length > 0
      ? Math.round((attended / Math.max(1, attended + cancelled)) * 100)
      : 0;
    // Best month — count completed by yyyy-mm.
    const monthCount = new Map<string, number>();
    for (const b of completedWithThisTrainer) {
      const d = new Date(b.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthCount.set(key, (monthCount.get(key) ?? 0) + 1);
    }
    const best = Array.from(monthCount.entries()).sort((a, b) => b[1] - a[1])[0];
    let bestMonthLabel: string | null = null;
    let bestMonthCount = 0;
    if (best) {
      const [y, m] = best[0].split("-").map(Number);
      bestMonthLabel = `${PL_MONTHS_NOM[m]} ${y}`;
      bestMonthCount = best[1];
    }
    // Streak — consecutive past weeks with at least one completed session.
    const weekStart = mondayOf(new Date());
    let currentStreakWeeks = 0;
    for (let i = 0; i < 26; i++) {
      const ws = mondayOf(new Date(weekStart.getTime() - i * 7 * 86_400_000));
      const we = new Date(ws.getTime() + 7 * 86_400_000);
      const has = completedWithThisTrainer.some((b) => {
        const t = new Date(b.start_time).getTime();
        return t >= ws.getTime() && t < we.getTime();
      });
      if (has) currentStreakWeeks += 1;
      else break;
    }
    return {
      startIso: first.start_time,
      startLabel: `${startDate.getDate()} ${PL_MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`,
      monthsCoaching,
      totalSessions: total,
      attendancePct,
      bestMonthLabel,
      bestMonthCount,
      currentStreakWeeks,
    };
  })();

  const data: MojTrenerData = {
    hero,
    about: trainer.about,
    specs,
    certs,
    services,
    packages,
    availability,
    nextSlotLabel,
    reviews,
    reviewSummary,
    collab,
    pendingReviews,
  };

  return <MojTrener data={data} />;
}

/* ====================== HELPERS ====================== */

function emptyData(): MojTrenerData {
  return {
    hero: null,
    about: "",
    specs: [],
    certs: [],
    services: [],
    packages: [],
    availability: [],
    nextSlotLabel: null,
    reviews: [],
    reviewSummary: null,
    collab: null,
    pendingReviews: 0,
  };
}

function buildAvailabilityWindows(rules: { day_of_week: number; start_time: string; end_time: string }[]): AvailabilityWindow[] {
  if (rules.length === 0) return [];
  // Group by day_of_week → earliest start, latest end.
  const byDay = new Map<number, { start: string; end: string }>();
  for (const r of rules) {
    const existing = byDay.get(r.day_of_week);
    if (!existing) byDay.set(r.day_of_week, { start: r.start_time, end: r.end_time });
    else {
      if (r.start_time < existing.start) existing.start = r.start_time;
      if (r.end_time > existing.end) existing.end = r.end_time;
    }
  }
  // Compose simple labels: "Pn-Pt" if 1..5 share hours, else per-day.
  const weekdayKeys = [1, 2, 3, 4, 5];
  const weekdayHours = weekdayKeys.map((d) => byDay.get(d));
  const allWeekdaysSame =
    weekdayHours.every((h) => h != null) &&
    weekdayHours.every(
      (h) => h?.start === weekdayHours[0]?.start && h?.end === weekdayHours[0]?.end,
    );

  const windows: AvailabilityWindow[] = [];
  if (allWeekdaysSame && weekdayHours[0]) {
    windows.push({
      range: "Pn-Pt",
      hours: `${trimSec(weekdayHours[0].start)} – ${trimSec(weekdayHours[0].end)}`,
    });
  } else {
    const PL_DAY_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
    for (const d of weekdayKeys) {
      const h = byDay.get(d);
      if (h) windows.push({ range: PL_DAY_SHORT[d], hours: `${trimSec(h.start)} – ${trimSec(h.end)}` });
    }
  }
  const sat = byDay.get(6);
  windows.push({ range: "Sob", hours: sat ? `${trimSec(sat.start)} – ${trimSec(sat.end)}` : "nieczynne" });
  const sun = byDay.get(0);
  windows.push({ range: "Niedz", hours: sun ? `${trimSec(sun.start)} – ${trimSec(sun.end)}` : "nieczynne" });
  return windows;
}

function trimSec(t: string): string {
  // "09:00:00" → "09:00"
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function computeNextSlot(rules: { day_of_week: number; start_time: string; end_time: string }[]): string | null {
  if (rules.length === 0) return null;
  // Find next weekday with a rule, return its first hour.
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const rulesForDay = rules.filter((r) => r.day_of_week === dow);
    if (rulesForDay.length === 0) continue;
    const earliest = rulesForDay.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    return `${PL_DAYS_FULL[dow]} ${d.getDate()} ${PL_MONTHS[d.getMonth()]}, ${trimSec(earliest.start_time)}`;
  }
  return null;
}

function avgNonNull(xs: (number | null)[]): number | null {
  const clean = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function relativeLabel(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.round(diffMs / 3_600_000);
  const diffD = Math.round(diffMs / 86_400_000);
  if (diffH < 1) return "przed chwilą";
  if (diffH < 24) return `${diffH} ${plural(diffH, "godz.", "godz.", "godz.")} temu`;
  if (diffD === 1) return "wczoraj";
  if (diffD < 7) return `${diffD} dni temu`;
  if (diffD < 30) return `${Math.round(diffD / 7)} tyg. temu`;
  return `${d.getDate()} ${PL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  const offset = (dow + 6) % 7;
  r.setDate(r.getDate() - offset);
  return r;
}
