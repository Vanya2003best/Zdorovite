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
  searchParams: Promise<{ with?: string }>;
}) {
  const sp = await props.searchParams;
  const withId = sp?.with ?? "";

  const { user } = await requireClient(`/account/messages${withId ? `?with=${withId}` : ""}`);
  const supabase = await createClient();
  const me = user.id;

  // Mark messages as read when opening a thread
  if (withId) {
    await markThreadRead(withId);
  }

  // Fetch all messages I'm part of, then group by other party
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

  // Fetch other users' display info
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

  const threads = Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );

  // If `with` is set, fetch the conversation + the other person's profile (in case no messages yet)
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
      // No messages yet — fetch profile directly
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
    <div className="-mx-4 -my-6 sm:-mx-8 sm:-my-10 h-[calc(100vh-32px)] sm:h-[calc(100vh-80px)] grid sm:grid-cols-[320px_1fr] bg-white border border-slate-200 rounded-none sm:rounded-2xl overflow-hidden">
      {/* Threads list — hidden on mobile when a thread is open */}
      <aside
        className={`${withId ? "hidden sm:block" : ""} border-r border-slate-200 overflow-y-auto`}
      >
        <header className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold tracking-tight">Wiadomości</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {threads.length} {threads.length === 1 ? "rozmowa" : "rozmów"}
          </p>
        </header>

        {threads.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-slate-500">
            Nie masz jeszcze żadnych wiadomości.
            <br />
            Klienci mogą napisać do Ciebie z poziomu Twojego profilu.
          </div>
        ) : (
          <ul>
            {threads.map((t) => {
              const active = withId === t.otherId;
              return (
                <li key={t.otherId}>
                  <Link
                    href={`/account/messages?with=${t.otherId}`}
                    className={`flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition ${
                      active ? "bg-emerald-50/60" : ""
                    }`}
                  >
                    {t.otherAvatar ? (
                      <img src={t.otherAvatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center font-semibold shrink-0">
                        {(t.otherName || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <strong className="text-[14px] text-slate-900 truncate">
                          {t.otherName || "Klient"}
                        </strong>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {formatRelative(t.lastAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[12.5px] text-slate-600 truncate flex-1">
                          {t.lastFromMe && <span className="text-slate-400">Ty: </span>}
                          {t.lastText}
                        </p>
                        {t.unread > 0 && (
                          <span className="bg-emerald-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1.5 shrink-0">
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Conversation panel */}
      <section className="min-w-0 flex flex-col bg-slate-50">
        {activeOther ? (
          <MessagesClient
            myId={me}
            other={activeOther}
            initialMessages={conversation}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-slate-500">
            <span className="text-5xl mb-3">💬</span>
            <p className="text-[14px]">Wybierz rozmowę z lewej strony</p>
            <p className="text-[12px] mt-1.5 text-slate-400">
              lub poczekaj aż klient się odezwie z Twojego profilu
            </p>
          </div>
        )}
      </section>
    </div>
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
  if (diffH < 24 * 7) return d.toLocaleDateString("pl-PL", { weekday: "short" });
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
