"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RescheduleCard from "@/components/RescheduleCard";
import { sendMessage } from "./actions";
import type { ConversationMessage } from "./page";

type Other = { id: string; name: string; avatar: string | null };

const QUICK_REPLIES = [
  "👍 Jasne",
  "📅 Sprawdzam terminy",
  "💪 Dam znać po treningu",
  "❓ Pytanie",
];

const PL_DAY_LONG = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

const TYPING_HEARTBEAT_MS = 1500; // throttle outgoing pings
const TYPING_LINGER_MS = 4000;    // how long to show "pisze…" after the last ping

function fmtDaySep(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const dayMs = 86_400_000;
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startN = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = (startN - startD) / dayMs;
  if (diff === 0) return "Dziś";
  if (diff === 1) return "Wczoraj";
  if (diff < 7) return PL_DAY_LONG[d.getDay()];
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

/** Per-thread channel name agreed by both sides regardless of who's sender. */
function threadChannelName(a: string, b: string) {
  return `thread:${[a, b].sort().join(":")}`;
}

export default function MessagesClient({
  myId,
  other,
  initialMessages,
}: {
  myId: string;
  other: Other;
  initialMessages: ConversationMessage[];
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Refs for typing throttle + linger timers (so they don't churn between renders)
  const lastPingSentRef = useRef<number>(0);
  const typingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, otherTyping]);

  // ---------- Postgres-changes subscriptions ----------
  // 1) INSERT on incoming messages → append + mark this side read on the next openThread mount.
  // 2) UPDATE on messages I sent to this user → propagate read_at into local state so my ✓✓ turn green
  //    when the other side opens the thread. This is the "live read receipt" path.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${myId}-${other.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `to_id=eq.${myId}` },
        (payload) => {
          const m = payload.new as {
            from_id: string;
            to_id: string;
            id: string;
            text: string;
            created_at: string;
            read_at: string | null;
          };
          if (m.from_id !== other.id) return;
          // We don't have the joined reschedule data on a realtime payload —
          // for proposal/response messages, append a stub and rely on the
          // router.refresh below to re-fetch with the join.
          setMessages((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: m.id,
                    fromMe: false,
                    text: m.text,
                    createdAt: m.created_at,
                    readAt: m.read_at,
                    messageType: "text",
                    reschedule: null,
                  },
                ],
          );
          setOtherTyping(false);
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `from_id=eq.${myId}` },
        (payload) => {
          const m = payload.new as { id: string; to_id: string; read_at: string | null };
          // Only care about updates on this thread.
          if (m.to_id !== other.id) return;
          setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, readAt: m.read_at } : x)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, other.id, router]);

  // ---------- Typing presence (broadcast, no DB writes) ----------
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(threadChannelName(myId, other.id), {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload.payload as { from?: string } | undefined)?.from;
        if (from !== other.id) return;
        setOtherTyping(true);
        if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
        typingClearTimerRef.current = setTimeout(() => setOtherTyping(false), TYPING_LINGER_MS);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [myId, other.id]);

  const pingTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastPingSentRef.current < TYPING_HEARTBEAT_MS) return;
    lastPingSentRef.current = now;
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { from: myId },
    });
  }, [myId]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setText("");
    setError(null);
    const optimistic: ConversationMessage = {
      id: `tmp-${Date.now()}`,
      fromMe: true,
      text: v,
      createdAt: new Date().toISOString(),
      readAt: null,
      messageType: "text",
      reschedule: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("to_id", other.id);
      fd.set("text", v);
      const res = await sendMessage(fd);
      if ("error" in res) {
        setError(res.error);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setText(v);
        return;
      }
      router.refresh();
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    send(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = (e.currentTarget as HTMLTextAreaElement).form;
      if (form) form.requestSubmit();
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <header className="px-3 md:px-4 py-2.5 border-b border-slate-100 bg-white flex items-center gap-2.5">
        <Link
          href="/account/messages"
          aria-label="Wróć do listy"
          className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
            {(other.name || "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate">{other.name || "Klient"}</div>
          <div className="text-[11px] text-emerald-600 inline-flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-emerald-500" />
            {otherTyping ? "pisze…" : "aktywna teraz"}
          </div>
        </div>
        <div className="flex gap-1">
          {/* Decorative call buttons — see project_chat_followups for the WebRTC follow-up */}
          <button
            aria-label="Połączenie głosowe"
            className="w-9 h-9 rounded-[11px] bg-slate-100 inline-flex items-center justify-center text-slate-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
          <button
            aria-label="Wideo"
            className="w-9 h-9 rounded-[11px] bg-slate-100 inline-flex items-center justify-center text-slate-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </button>
        </div>
      </header>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 md:px-5 py-4">
        {messages.length === 0 && !otherTyping ? (
          <div className="text-center text-[13px] text-slate-500 mt-12">
            Brak wiadomości. Napisz coś jako pierwszy/pierwsza.
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay =
              !prev ||
              new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const groupedWithPrev =
              prev && prev.fromMe === m.fromMe && !showDay && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
            const next = messages[i + 1];
            const isLastInGroup =
              !next || next.fromMe !== m.fromMe || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() >= 5 * 60 * 1000;
            const isPending = m.id.startsWith("tmp-");

            // Reschedule proposal — render as a booking-card with accept/decline.
            if (m.messageType === "reschedule_proposal" && m.reschedule) {
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="text-center text-[10.5px] text-slate-400 my-3 uppercase tracking-wider font-semibold">
                      {fmtDaySep(m.createdAt)}
                    </div>
                  )}
                  <RescheduleCard
                    request={m.reschedule}
                    isRequester={m.fromMe}
                    side={m.fromMe ? "me" : "them"}
                  />
                </div>
              );
            }

            // Reschedule response — center-aligned status pill.
            if (m.messageType === "reschedule_response") {
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="text-center text-[10.5px] text-slate-400 my-3 uppercase tracking-wider font-semibold">
                      {fmtDaySep(m.createdAt)}
                    </div>
                  )}
                  <div className="flex justify-center my-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] text-slate-600 font-medium">
                      {m.text}
                      <span className="text-slate-400">· {fmtTime(m.createdAt)}</span>
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="text-center text-[10.5px] text-slate-400 my-3 uppercase tracking-wider font-semibold">
                    {fmtDaySep(m.createdAt)}
                  </div>
                )}
                <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-[2px]" : "mt-2"}`}>
                  <div className="flex flex-col max-w-[78%]">
                    <div
                      className={`px-3 py-2 text-[14px] leading-[1.45] ${
                        m.fromMe
                          ? "bg-slate-900 text-white rounded-[18px] rounded-br-[6px]"
                          : "bg-white border border-slate-200 text-slate-900 rounded-[18px] rounded-bl-[6px]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                    {isLastInGroup && (
                      <div
                        className={`text-[10px] text-slate-400 mt-1 px-2 inline-flex items-center gap-1 ${
                          m.fromMe ? "self-end" : "self-start"
                        }`}
                      >
                        <span>{fmtTime(m.createdAt)}</span>
                        {m.fromMe && <ReadCheck pending={isPending} read={!!m.readAt} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {otherTyping && (
          <div className="flex justify-start mt-2">
            <div className="px-3.5 py-3 bg-white border border-slate-200 rounded-[18px] rounded-bl-[6px] inline-flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-[typing-bounce_1.2s_infinite]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-[typing-bounce_1.2s_0.2s_infinite]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-[typing-bounce_1.2s_0.4s_infinite]" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 bg-white px-2.5 md:px-3 py-2.5 pb-5 md:pb-3">
        {/* Quick replies */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={pending}
              className="whitespace-nowrap px-2.5 py-1.5 rounded-full border border-slate-200 bg-white text-[11.5px] text-slate-700 hover:border-slate-400 transition disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {error && <p className="text-[12px] text-red-600 mb-1.5 px-1">{error}</p>}

        <form onSubmit={onSubmit} className="flex gap-2 items-end">
          <button
            type="button"
            aria-label="Załącz plik"
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="flex-1 flex items-end gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full min-h-[38px]">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.length > 0) pingTyping();
              }}
              onKeyDown={onKeyDown}
              placeholder="Napisz wiadomość…"
              rows={1}
              maxLength={4000}
              className="flex-1 bg-transparent text-[13.5px] py-[6px] outline-none resize-none max-h-32 placeholder:text-slate-400"
            />
            <button
              type="button"
              aria-label="Emoji"
              className="text-slate-500 hover:text-slate-700 transition shrink-0 self-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
              </svg>
            </button>
          </div>
          <button
            type="submit"
            disabled={pending || !hasText}
            aria-label="Wyślij"
            className={`w-9 h-9 rounded-full inline-flex items-center justify-center transition shrink-0 disabled:opacity-50 ${
              hasText
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.4)]"
                : "bg-slate-900 text-white"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Three states:
 *  - pending  → single hollow check (still in flight to the server)
 *  - sent     → double check, slate-400 (delivered, not yet read)
 *  - read     → double check, emerald-500 (other side opened the thread)
 */
function ReadCheck({ pending, read }: { pending: boolean; read: boolean }) {
  if (pending) {
    return (
      <svg
        aria-label="Wysyłanie"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-slate-400"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }
  return (
    <svg
      aria-label={read ? "Przeczytane" : "Dostarczone"}
      width="14"
      height="11"
      viewBox="0 0 24 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={read ? "text-emerald-500" : "text-slate-400"}
    >
      <path d="M2 9l4 4 8-10" />
      <path d="M9 13l1.5 1.5L20 3" />
    </svg>
  );
}
