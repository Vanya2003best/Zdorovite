import { createClient } from "@/lib/supabase/server";
import { packageUsage } from "@/lib/db/package-usage";

/**
 * /studio/klienci data layer — real roster from trainer_clients (023)
 * enriched with bookings (sessions, LTV) and packages (saldo).
 *
 * Status is DERIVED, not stored — the single source of truth is what
 * actually happened (bookings) plus the trainer's own roster row:
 *   ended  — archived_at set (trainer closed the relationship)
 *   active — upcoming booking OR completed session in the last 21 days
 *   new    — first completed session within the last 21 days (≤3 total)
 *   pause  — has session history, but nothing in 21+ days and no upcoming
 *   lead   — roster row without a single completed/upcoming booking
 */

export type ClientStatus = "lead" | "new" | "active" | "pause" | "ended";

export type RosterClient = {
  id: string;
  profileId: string | null;
  name: string;
  initials: string;
  /** 1–9, stable per client — drives the avatar gradient */
  avatarTone: number;
  status: ClientStatus;
  /** Days in the current status (leads/new/pause) — pill suffix */
  statusDays: number | null;
  email: string | null;
  phone: string | null;
  /** "Klient od stycznia 2026" — from first completed session or roster row */
  sinceLabel: string | null;
  tags: string[];
  /** Package saldo — null when the client never bought a package */
  pkg: { used: number; total: number } | null;
  /** Last completed session / next upcoming one */
  lastSession: {
    label: "Ostatnia sesja" | "Najbliższa sesja" | "Brak sesji";
    primary: string | null;
    daysAgo: number | null;
  };
  /** Sum of completed-session prices in the last 12 months; null for leads */
  ltv12m: number | null;
};

const PL_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

const DAY_MS = 86_400_000;
const ACTIVE_WINDOW_DAYS = 21;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toneOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 9) + 1;
}

function daysAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

function sinceLabelOf(iso: string): string {
  const d = new Date(iso);
  return `Klient od ${PL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function sessionDateLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const days = Math.floor((now - d.getTime()) / DAY_MS);
  const hm = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (days === 0 && now >= d.getTime()) return `Dziś · ${hm}`;
  if (days === 1) return `Wczoraj · ${hm}`;
  if (days < 0) {
    const ahead = Math.ceil(-days);
    if (ahead <= 1) return `Jutro · ${hm}`;
    return `${d.getDate()} ${PL_MONTHS[d.getMonth()]} · ${hm}`;
  }
  return `${d.getDate()} ${PL_MONTHS[d.getMonth()]}`;
}

type BookingRow = {
  client_id: string;
  start_time: string;
  status: string;
  price: number;
  package_id: string | null;
};

/** Single source of truth for the status rules (see header comment). */
export function deriveStatus(input: {
  archived: boolean;
  firstCompletedIso: string | null;
  lastCompletedIso: string | null;
  completedCount: number;
  hasUpcoming: boolean;
  rosterCreatedIso: string;
  now: number;
}): { status: ClientStatus; statusDays: number | null } {
  const { archived, firstCompletedIso, lastCompletedIso, completedCount, hasUpcoming, rosterCreatedIso, now } = input;
  if (archived) return { status: "ended", statusDays: null };
  if (!firstCompletedIso && !hasUpcoming) {
    return { status: "lead", statusDays: daysAgo(rosterCreatedIso, now) };
  }
  if (
    hasUpcoming ||
    (lastCompletedIso && daysAgo(lastCompletedIso, now) <= ACTIVE_WINDOW_DAYS)
  ) {
    if (
      firstCompletedIso &&
      daysAgo(firstCompletedIso, now) <= ACTIVE_WINDOW_DAYS &&
      completedCount <= 3
    ) {
      return { status: "new", statusDays: daysAgo(firstCompletedIso, now) };
    }
    return { status: "active", statusDays: null };
  }
  return {
    status: "pause",
    statusDays: lastCompletedIso ? daysAgo(lastCompletedIso, now) : null,
  };
}

export async function getClientsForTrainer(trainerId: string): Promise<RosterClient[]> {
  const supabase = await createClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const [{ data: roster, error: rosterErr }, { data: bookings, error: bookErr }] =
    await Promise.all([
      supabase
        .from("trainer_clients")
        .select("id, profile_id, display_name, email, phone, tags, archived_at, created_at")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("client_id, start_time, status, price, package_id")
        .eq("trainer_id", trainerId)
        .neq("status", "cancelled"),
    ]);
  if (rosterErr) throw rosterErr;
  if (bookErr) throw bookErr;

  // Index bookings per client profile
  const byClient = new Map<string, BookingRow[]>();
  for (const b of bookings ?? []) {
    const list = byClient.get(b.client_id) ?? [];
    list.push(b as BookingRow);
    byClient.set(b.client_id, list);
  }

  // Package totals for every package referenced by these bookings
  const pkgIds = Array.from(
    new Set((bookings ?? []).map((b) => b.package_id).filter((x): x is string => !!x))
  );
  const pkgTotals = new Map<string, number>();
  if (pkgIds.length > 0) {
    const { data: pkgs } = await supabase
      .from("packages")
      .select("id, sessions_total")
      .in("id", pkgIds);
    for (const p of pkgs ?? []) {
      if (p.sessions_total) pkgTotals.set(p.id, p.sessions_total);
    }
  }

  return (roster ?? []).map((row) => {
    const list = row.profile_id ? byClient.get(row.profile_id) ?? [] : [];
    const completed = list
      .filter((b) => b.status === "completed")
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const upcoming = list
      .filter(
        (b) =>
          ["pending", "paid", "confirmed"].includes(b.status) && b.start_time > nowIso
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const first = completed[0] ?? null;
    const last = completed[completed.length - 1] ?? null;
    const next = upcoming[0] ?? null;

    const { status, statusDays } = deriveStatus({
      archived: !!row.archived_at,
      firstCompletedIso: first?.start_time ?? null,
      lastCompletedIso: last?.start_time ?? null,
      completedCount: completed.length,
      hasUpcoming: !!next,
      rosterCreatedIso: row.created_at,
      now,
    });

    // ----- package saldo: most recent package the client booked under -----
    let pkg: RosterClient["pkg"] = null;
    const lastPkgBooking = [...list]
      .filter((b) => b.package_id && pkgTotals.has(b.package_id))
      .sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
    if (lastPkgBooking?.package_id) {
      const total = pkgTotals.get(lastPkgBooking.package_id)!;
      // Shared derivation (lib/db/package-usage) — "used" = completed only.
      const usage = packageUsage(
        list.filter((b) => b.package_id === lastPkgBooking.package_id),
        total,
        now,
      );
      pkg = { used: Math.min(usage.used, total), total };
    }

    // ----- LTV: completed sessions in the last 12 months -----
    const yearAgo = new Date(now - 365 * DAY_MS).toISOString();
    const ltv12m = first
      ? completed
          .filter((b) => b.start_time >= yearAgo)
          .reduce((s, b) => s + (b.price ?? 0), 0)
      : null;

    const lastSession: RosterClient["lastSession"] = next
      ? { label: "Najbliższa sesja", primary: sessionDateLabel(next.start_time, now), daysAgo: null }
      : last
        ? {
            label: "Ostatnia sesja",
            primary: sessionDateLabel(last.start_time, now),
            daysAgo: daysAgo(last.start_time, now),
          }
        : { label: "Brak sesji", primary: null, daysAgo: null };

    return {
      id: row.id,
      profileId: row.profile_id,
      name: row.display_name,
      initials: initialsOf(row.display_name),
      avatarTone: toneOf(row.id),
      status,
      statusDays,
      email: row.email,
      phone: row.phone,
      sinceLabel: first ? sinceLabelOf(first.start_time) : null,
      tags: row.tags ?? [],
      pkg,
      lastSession,
      ltv12m,
    };
  });
}
