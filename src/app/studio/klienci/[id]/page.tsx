import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveStatus, type ClientStatus } from "@/lib/db/clients";
import ClientDetail, { type DetailSession, type DetailExtras } from "./ClientDetail";

/**
 * /studio/klienci/[id] — client detail. IDs are trainer_clients UUIDs.
 * The page assembles everything the detail view shows from LIVE tables:
 * roster row + bookings (sessions, KPIs, package saldo) + messages (chat
 * preview). Sections without backing tables were removed from the view.
 */
export default async function KlientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/studio/klienci/${id}`);

  const { data } = await supabase
    .from("trainer_clients")
    .select("id, profile_id, display_name, email, phone, goal, notes, tags, archived_at, created_at")
    .eq("id", id)
    .eq("trainer_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let sessions: DetailSession[] = [];
  let chat: DetailExtras["chat"] = [];

  if (data.profile_id) {
    const [{ data: bookings }, { data: msgs }] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, start_time, end_time, status, price, session_notes, package_id, services(name), packages(name, sessions_total)"
        )
        .eq("trainer_id", user.id)
        .eq("client_id", data.profile_id)
        .order("start_time", { ascending: false })
        .limit(200),
      supabase
        .from("messages")
        .select("from_id, text, created_at")
        .or(
          `and(from_id.eq.${user.id},to_id.eq.${data.profile_id}),and(from_id.eq.${data.profile_id},to_id.eq.${user.id})`
        )
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    sessions = (bookings ?? []).map((b) => {
      const service = Array.isArray(b.services) ? b.services[0] : b.services;
      const pkg = Array.isArray(b.packages) ? b.packages[0] : b.packages;
      return {
        id: b.id,
        startIso: b.start_time,
        status: b.status,
        title: service?.name ?? pkg?.name ?? "Sesja",
        price: b.price,
        notes: b.session_notes,
        packageId: b.package_id,
        packageName: pkg?.name ?? null,
        packageTotal: pkg?.sessions_total ?? null,
      };
    });

    chat = (msgs ?? [])
      .reverse()
      .map((m) => ({ fromMe: m.from_id === user.id, body: m.text, atIso: m.created_at }));
  }

  // ---- derived stats (same rules as the roster list) ----
  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
  const upcoming = sessions
    .filter((s) => ["pending", "paid", "confirmed"].includes(s.status) && s.startIso > nowIso)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
  const cancelled = sessions.filter((s) => s.status === "cancelled" || s.status === "no_show");

  const first = completed[0] ?? null;
  const last = completed[completed.length - 1] ?? null;

  const { status, statusDays } = deriveStatus({
    archived: !!data.archived_at,
    firstCompletedIso: first?.startIso ?? null,
    lastCompletedIso: last?.startIso ?? null,
    completedCount: completed.length,
    hasUpcoming: upcoming.length > 0,
    rosterCreatedIso: data.created_at,
    now,
  });

  const yearAgo = new Date(now - 365 * 86_400_000).toISOString();
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).toISOString();

  // Package saldo: the package of the most recent package booking
  const lastPkgSession = sessions.find((s) => s.packageId && s.packageTotal);
  const pkg = lastPkgSession
    ? {
        name: lastPkgSession.packageName ?? "Pakiet",
        total: lastPkgSession.packageTotal!,
        used: Math.min(
          completed.filter((s) => s.packageId === lastPkgSession.packageId).length,
          lastPkgSession.packageTotal!
        ),
      }
    : null;

  const extras: DetailExtras = {
    profileId: data.profile_id,
    archived: !!data.archived_at,
    status: status as ClientStatus,
    statusDays,
    firstSessionIso: first?.startIso ?? null,
    next: upcoming[0]
      ? { startIso: upcoming[0].startIso, title: upcoming[0].title }
      : null,
    sessions,
    kpi: {
      total: completed.length,
      thisMonth: completed.filter((s) => s.startIso >= monthStart).length,
      cancelled: cancelled.length,
      ltv12m: data.profile_id
        ? completed.filter((s) => s.startIso >= yearAgo).reduce((sum, s) => sum + (s.price ?? 0), 0)
        : null,
      attendancePct:
        completed.length + cancelled.length > 0
          ? Math.round((completed.length / (completed.length + cancelled.length)) * 100)
          : null,
    },
    pkg,
    chat,
  };

  return (
    <ClientDetail
      client={{
        id: data.id,
        display_name: data.display_name,
        email: data.email,
        phone: data.phone,
        goal: data.goal,
        notes: data.notes,
        tags: data.tags ?? [],
        created_at: data.created_at,
      }}
      extras={extras}
    />
  );
}
