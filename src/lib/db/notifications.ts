import { createClient } from "@/lib/supabase/server";

export type NotificationKind =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "reschedule_proposed"
  | "reschedule_accepted"
  | "reschedule_declined";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
};

function mapRow(r: Row): Notification {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    link: r.link,
    relatedId: r.related_id,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/** Most recent notifications for the current user. */
export async function getRecentNotifications(userId: string, limit = 10): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, related_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}
