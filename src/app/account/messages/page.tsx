import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/auth";
import MessagesClient from "./MessagesClient";
import { markThreadRead } from "./actions";

type RawMsg = {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  read_at: string | null;
  created_at: string;
};

export type Thread = {
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastText: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
};

export type ConversationMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
};

export default async function MessagesPage(props: {
  searchParams: Promise<{ with?: string; filter?: string }>;
}) {
  const sp = await props.searchParams;
  const withId = sp?.with ?? "";
  const filter = sp?.filter === "unread" ? "unread" : "all";

  const { user } = await requireClient(`/account/messages${withId ? `?with=${withId}` : ""}`);
  const supabase = await createClient();
  const me = user.id;

  if (withId) {
    await markThreadRead(withId);
  }

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, from_id, to_id, text, read_at, created_at")
    .or(`from_id.eq.${me},to_id.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(500);

  const threadsMap = new Map<string, Thread>();
  for (const m of (msgs ?? []) as RawMsg[]) {
    const other = m.from_id === me ? m.to_id : m.from_id;
    if (!threadsMap.has(other)) {
      threadsMap.set(other, {
        otherId: other,
        otherName: "",
        otherAvatar: null,
        lastText: m.text,
        lastAt: m.created_at,
        lastFromMe: m.from_id === me,
        unread: 0,
      });
    }
    const t = threadsMap.get(other)!;
    if (m.to_id === me && !m.read_at) t.unread += 1;
  }

  const otherIds = Array.from(threadsMap.keys());
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", otherIds);
    for (const p of profiles ?? []) {
      const t = threadsMap.get(p.id);
      if (t) {
        t.otherName = p.display_name;
        t.otherAvatar = p.avatar_url;
      }
    }
  }

  const allThreads = Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
  const unreadCount = allThreads.filter((t) => t.unread > 0).length;
  const threads = filter === "unread" ? allThreads.filter((t) => t.unread > 0) : allThreads;

  let conversation: ConversationMessage[] = [];
  let activeOther: { id: string; name: string; avatar: string | null } | null = null;
  if (withId) {
    const { data: conv } = await supabase
      .from("messages")
      .select("id, from_id, to_id, text, created_at")
      .or(`and(from_id.eq.${me},to_id.eq.${withId}),and(from_id.eq.${withId},to_id.eq.${me})`)
      .order("created_at", { ascending: true })
      .limit(500);
    conversation = (conv ?? []).map((m) => ({
      id: m.id,
      fromMe: m.from_id === me,
      text: m.text,
      createdAt: m.created_at,
    }));

    const existing = threadsMap.get(withId);
    if (existing) {
      activeOther = { id: existing.otherId, name: existing.otherName, avatar: existing.otherAvatar };
    } else {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", withId)
        .maybeSingle();
      if (p) {
        activeOther = { id: p.id, name: p.display_name, avatar: p.avatar_url };
      }
    }
  }

  return (
    <div className="grid md:grid-cols-[360px_1fr] md:max-w-[1280px] md:mx-auto md:my-6 md:px-6 md:gap-5 min-h-[calc(100dvh-64px-96px)] md:min-h-[calc(100dvh-64px-48px)]">
      {/* Inbox — hidden on mobile when a thread is open */}
      <aside
        className={`${withId ? "hidden md:flex" : "flex"} flex-col bg-white md:border md:border-slate-200 md:rounded-2xl overflow-hidden`}
      >
        {/* Inbox top */}
        <header className="px-4 md:px-5 pt-2 md:pt-4 pb-3.5 border-b border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[22px] md:text-lg font-semibold tracking-[-0.02em]">Wiadomości</h2>
            <div className="flex gap-2">
              <button
                aria-label="Szukaj"
                className="w-9 h-9 rounded-[11px] bg-slate-100 inline-flex items-center justify-center text-slate-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
              <button
                aria-label="Nowa wiadomość"
                className="w-9 h-9 rounded-[11px] bg-slate-100 inline-flex items-center justify-center text-slate-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          {/* Search bar — visual only (no autocomplete wired) */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 rounded-[10px] text-[13px] text-slate-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Szukaj w wiadomościach…
          </div>
        </header>

        {/* Filter pills */}
        <div className="flex gap-1.5 px-4 md:px-5 pt-3 pb-1.5 flex-wrap">
          <FilterPill href="/account/messages" active={filter === "all"} label="Wszystkie" badge={allThreads.length} />
          <FilterPill href="/account/messages?filter=unread" active={filter === "unread"} label="Nieprzeczytane" badge={unreadCount} />
          {/* Decorative: trainer/pinned filters not wired yet */}
          <span className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[12px] text-slate-700 font-medium">
            Trenerzy
          </span>
          <span className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[12px] text-slate-700 font-medium">
            Przypięte
          </span>
        </div>

        {/* Threads */}
        <div className="flex-1 overflow-y-auto px-2 md:px-3 pb-2">
          {threads.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px] text-slate-500">
              {filter === "unread"
                ? "Brak nieprzeczytanych wiadomości."
                : "Nie masz jeszcze żadnych wiadomości."}
            </div>
          ) : (
            <ul>
              {threads.map((t) => {
                const active = withId === t.otherId;
                return (
                  <li key={t.otherId}>
                    <Link
                      href={`/account/messages?with=${t.otherId}`}
                      className={`grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 p-2 md:p-2.5 rounded-[14px] transition ${
                        active
                          ? "bg-slate-100"
                          : t.unread > 0
                            ? "bg-gradient-to-r from-emerald-50 to-transparent hover:to-emerald-50/40"
                            : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="relative">
                        {t.otherAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.otherAvatar}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold">
                            {(t.otherName || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[14px] font-semibold truncate">{t.otherName || "Klient"}</span>
                          <span
                            className={`text-[10.5px] font-medium whitespace-nowrap ${
                              t.unread > 0 ? "text-emerald-700" : "text-slate-500"
                            }`}
                          >
                            {formatRelative(t.lastAt)}
                          </span>
                        </div>
                        <p
                          className={`text-[12.5px] leading-[1.4] line-clamp-2 ${
                            t.unread > 0 ? "text-slate-900" : "text-slate-600"
                          }`}
                        >
                          {t.lastFromMe && <span className="text-slate-500">Ty: </span>}
                          {t.lastText}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 pt-0.5 min-w-[18px]">
                        {t.unread > 0 && (
                          <span className="bg-emerald-500 text-white text-[10.5px] font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1.5">
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Conversation panel */}
      <section
        className={`${withId ? "flex" : "hidden md:flex"} flex-col min-w-0 bg-white md:border md:border-slate-200 md:rounded-2xl overflow-hidden`}
      >
        {activeOther ? (
          <MessagesClient myId={me} other={activeOther} initialMessages={conversation} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-slate-500">
            <span className="text-5xl mb-3">💬</span>
            <p className="text-[14px]">Wybierz rozmowę z lewej strony</p>
            <p className="text-[12px] mt-1.5 text-slate-400">
              lub poczekaj aż trener odpowie z Twojego profilu
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  badge,
}: {
  href: string;
  active: boolean;
  label: string;
  badge: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium border transition ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 inline-block min-w-[16px] h-[14px] leading-[14px] px-[5px] rounded-full text-[10px] font-bold text-center ${
          active ? "bg-white text-slate-900" : "bg-emerald-500 text-white"
        }`}
      >
        {badge}
      </span>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 1000 / 3600;
  if (diffH < 1) {
    const m = Math.floor((now.getTime() - d.getTime()) / 1000 / 60);
    return m <= 0 ? "teraz" : `${m} min`;
  }
  if (diffH < 24) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diffH < 24 * 7) {
    const map = ["nd", "pn", "wt", "śr", "cz", "pt", "so"];
    return map[d.getDay()];
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
