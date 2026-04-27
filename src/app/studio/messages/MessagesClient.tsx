"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RescheduleCard from "@/components/RescheduleCard";
import { sendMessage } from "./actions";
import type { ConversationMessage } from "./page";

type Other = { id: string; name: string; avatar: string | null };

const TYPING_HEARTBEAT_MS = 1500;
const TYPING_LINGER_MS = 4000;

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

  const lastPingSentRef = useRef<number>(0);
  const typingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Sync messages when prop changes (server re-render)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, otherTyping]);

  // Postgres-changes: incoming messages + read-receipt updates on my outgoing messages
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
          // We don't get the joined reschedule data from a realtime payload — add a stub
          // and let router.refresh below re-fetch with the full join.
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

  // Typing presence — broadcast on shared per-thread channel
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    setError(null);
    const optimistic: ConversationMessage = {
      id: `tmp-${Date.now()}`,
      fromMe: true,
      text: value,
      createdAt: new Date().toISOString(),
      readAt: null,
      messageType: "text",
      reschedule: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("to_id", other.id);
      fd.set("text", value);
      const res = await sendMessage(fd);
      if ("error" in res) {
        setError(res.error);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setText(value);
        return;
      }
      router.refresh();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = (e.currentTarget as HTMLTextAreaElement).form;
      if (form) form.requestSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center gap-3">
        {/* Mobile back to thread list */}
        <Link
          href="/studio/messages"
          className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <div className="text-[14px] font-semibold text-slate-900 truncate">{other.name || "Klient"}</div>
          <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {otherTyping ? "pisze…" : "aktywny"}
          </div>
        </div>
      </header>

      {/* Messages scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {messages.length === 0 ? (
          <div className="text-center text-[13px] text-slate-500 mt-12">
            Brak wiadomości. Napisz coś jako pierwszy/pierwsza.
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const groupedWithPrev = prev && prev.fromMe === m.fromMe && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000);
            const showDaySep = !prev || !sameDay(prev.createdAt, m.createdAt);
            const next = messages[i + 1];
            const isLastInGroup =
              !next || next.fromMe !== m.fromMe || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() >= 5 * 60 * 1000;
            const isPending = m.id.startsWith("tmp-");

            if (m.messageType === "reschedule_proposal" && m.reschedule) {
              return (
                <div key={m.id}>
                  {showDaySep && <DaySeparator iso={m.createdAt} />}
                  <RescheduleCard
                    request={m.reschedule}
                    isRequester={m.fromMe}
                    side={m.fromMe ? "me" : "them"}
                  />
                </div>
              );
            }

            if (m.messageType === "reschedule_response") {
              return (
                <div key={m.id}>
                  {showDaySep && <DaySeparator iso={m.createdAt} />}
                  <div className="flex justify-center my-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] text-slate-600 font-medium">
                      {m.text}
                      <span className="text-slate-400">
                        · {new Date(m.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id}>
                {showDaySep && <DaySeparator iso={m.createdAt} />}
                <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-1" : "mt-3"}`}>
                  <div className="flex flex-col max-w-[78%] sm:max-w-[60%]">
                    <div
                      className={`px-3.5 py-2 rounded-2xl ${
                        m.fromMe
                          ? "bg-slate-900 text-white rounded-br-[4px]"
                          : "bg-white border border-slate-200 text-slate-900 rounded-bl-[4px]"
                      }`}
                    >
                      <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                    {isLastInGroup && (
                      <div
                        className={`text-[10px] text-slate-400 mt-1 px-1 inline-flex items-center gap-1 ${
                          m.fromMe ? "self-end" : "self-start"
                        }`}
                      >
                        <span>{new Date(m.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
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
          <div className="flex justify-start mt-3">
            <div className="px-3.5 py-3 bg-white border border-slate-200 rounded-2xl rounded-bl-[4px] inline-flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-[typing-bounce_1.2s_infinite]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-[typing-bounce_1.2s_0.2s_infinite]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-[typing-bounce_1.2s_0.4s_infinite]" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="px-3 sm:px-4 pt-3 pb-3 border-t border-slate-200 bg-white">
        {error && (
          <p className="text-[12px] text-red-600 mb-2 px-1">{error}</p>
        )}
        {/* Quick action pills — visual scaffolding; clicking inserts placeholder text */}
        <div className="hidden sm:flex gap-1.5 mb-2.5 flex-wrap">
          {[
            "📎 Załącz dokumentację",
            "📅 Zaproponuj termin",
            "💪 Wyślij ćwiczenie",
            "📊 Pomiar",
          ].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setText((t) => (t ? `${t} ${label}` : label))}
              className="text-[12px] px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-400 transition"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 border border-slate-200 rounded-2xl p-1.5 pl-3.5 focus-within:border-emerald-400 focus-within:ring-[3px] focus-within:ring-emerald-100 transition">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.length > 0) pingTyping();
            }}
            onKeyDown={onKeyDown}
            placeholder={`Napisz wiadomość do ${other.name?.split(" ")[0] ?? "klienta"}…`}
            rows={1}
            maxLength={4000}
            className="flex-1 max-h-32 py-2 bg-transparent focus:outline-none text-[14px] resize-none"
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="h-9 w-9 inline-flex items-center justify-center bg-slate-900 text-white rounded-[10px] hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Wyślij (Enter)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function DaySeparator({ iso }: { iso: string }) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  let label: string;
  if (sameDay(iso, today.toISOString())) label = "Dziś";
  else if (sameDay(iso, yest.toISOString())) label = "Wczoraj";
  else label = d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="relative text-center my-4">
      <span className="absolute left-0 right-0 top-1/2 h-px bg-slate-200" />
      <span className="relative inline-block px-3 bg-[#fafbfc] text-[11px] uppercase tracking-[0.08em] text-slate-400 font-medium">{label}</span>
    </div>
  );
}

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
