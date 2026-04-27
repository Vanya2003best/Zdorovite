"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { Notification, NotificationKind } from "@/lib/db/notifications";

const KIND_ICON: Record<NotificationKind, { emoji: string; tone: string }> = {
  booking_requested: { emoji: "📅", tone: "bg-blue-50 text-blue-700" },
  booking_confirmed: { emoji: "✓", tone: "bg-emerald-50 text-emerald-700" },
  booking_declined: { emoji: "✗", tone: "bg-rose-50 text-rose-700" },
  booking_cancelled: { emoji: "🚫", tone: "bg-rose-50 text-rose-700" },
  reschedule_proposed: { emoji: "📅", tone: "bg-amber-50 text-amber-700" },
  reschedule_accepted: { emoji: "✓", tone: "bg-emerald-50 text-emerald-700" },
  reschedule_declined: { emoji: "✗", tone: "bg-rose-50 text-rose-700" },
};

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffH = Math.round(diffMs / 3_600_000);
  const diffD = Math.round(diffMs / 86_400_000);
  if (diffMin < 1) return "teraz";
  if (diffMin < 60) return `${diffMin} min`;
  if (diffH < 24) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diffD === 1) return "wczoraj";
  if (diffD < 7) return `${diffD} dni temu`;
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export default function NotificationsBell({
  myId,
  initialNotifications,
  initialUnreadCount,
  /** Where the dropdown's footer "Zobacz wszystkie wiadomości →" link goes.
   *  Defaults to /account/messages; trainer studio passes /studio/messages. */
  messagesLink = "/account/messages",
}: {
  myId: string;
  initialNotifications: Notification[];
  initialUnreadCount: number;
  messagesLink?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Re-sync from props after server revalidations.
  useEffect(() => { setItems(initialNotifications); }, [initialNotifications]);
  useEffect(() => { setUnread(initialUnreadCount); }, [initialUnreadCount]);

  // Click-outside dismiss.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Realtime: subscribe to INSERTs for this user. Prepends to local list and bumps unread.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notif:${myId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${myId}` },
        (payload) => {
          const n = payload.new as {
            id: string; kind: NotificationKind; title: string; body: string | null;
            link: string | null; related_id: string | null; read_at: string | null; created_at: string;
          };
          setItems((prev) =>
            prev.some((x) => x.id === n.id)
              ? prev
              : [{
                  id: n.id, kind: n.kind, title: n.title, body: n.body,
                  link: n.link, relatedId: n.related_id, readAt: n.read_at, createdAt: n.created_at,
                }, ...prev].slice(0, 20),
          );
          setUnread((c) => c + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${myId}` },
        (payload) => {
          const n = payload.new as { id: string; read_at: string | null };
          const old = payload.old as { read_at: string | null } | null;
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: n.read_at } : x)));
          if (old?.read_at == null && n.read_at != null) {
            setUnread((c) => Math.max(0, c - 1));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

  const onItemClick = (n: Notification) => {
    setOpen(false);
    if (!n.readAt) {
      // Optimistic local update; server-side action persists it.
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
      startTransition(() => {
        markNotificationRead(n.id);
      });
    }
    if (n.link) router.push(n.link);
  };

  const onMarkAll = () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    setUnread(0);
    startTransition(() => {
      markAllNotificationsRead();
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `${unread} nieprzeczytane powiadomienia` : "Powiadomienia"}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-[11px] md:rounded-[9px] bg-slate-100 md:bg-white md:border md:border-slate-200 inline-flex items-center justify-center text-slate-700 md:hover:border-slate-400 transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9.5px] font-bold border-[1.5px] border-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[360px] max-w-[calc(100vw-24px)] bg-white border border-slate-200 rounded-[14px] shadow-[0_20px_40px_-12px_rgba(2,6,23,0.16)] overflow-hidden z-[60]">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <div className="text-[14px] font-semibold tracking-[-0.01em]">Powiadomienia</div>
            <button
              type="button"
              onClick={onMarkAll}
              disabled={unread === 0}
              className="text-[11.5px] text-emerald-700 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              Oznacz wszystkie
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-slate-500">
                Brak powiadomień. Wszystko spokojnie.
              </div>
            ) : (
              items.map((n) => {
                const ico = KIND_ICON[n.kind];
                const isUnread = !n.readAt;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 flex gap-3 items-start hover:bg-slate-50 transition ${
                      isUnread ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full inline-flex items-center justify-center text-[13px] font-semibold shrink-0 ${ico.tone}`}
                    >
                      {ico.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className={`text-[13px] ${isUnread ? "font-semibold" : "font-medium text-slate-700"} truncate`}>
                          {n.title}
                        </div>
                        <span className="text-[10.5px] text-slate-400 shrink-0">
                          {fmtRelative(n.createdAt)}
                        </span>
                      </div>
                      {n.body && (
                        <div className="text-[12px] text-slate-600 mt-0.5 line-clamp-2">{n.body}</div>
                      )}
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <Link
              href={messagesLink}
              onClick={() => setOpen(false)}
              className="text-[12px] text-slate-600 hover:text-slate-900 transition"
            >
              Zobacz wszystkie wiadomości →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
