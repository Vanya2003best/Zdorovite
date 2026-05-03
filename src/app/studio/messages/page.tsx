import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/states/EmptyState";
import { getRescheduleRequestsByIds, type RescheduleRequest } from "@/lib/db/reschedule";
import MessagesClient from "./MessagesClient";
import ClientContextPanel from "./ClientContextPanel";
import ThreadList from "./ThreadList";
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
  // Tag derived from booking history with this person:
  isClient: boolean;
};

export type MessageType = "text" | "reschedule_proposal" | "reschedule_response";

export type ConversationMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
  readAt: string | null;
  messageType: MessageType;
  reschedule: RescheduleRequest | null;
};

export default async function MessagesPage(props: {
  searchParams: Promise<{ with?: string }>;
}) {
  const sp = await props.searchParams;
  const withId = sp?.with ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/messages");
  const me = user.id;

  if (withId) await markThreadRead(withId);

  // All messages I'm part of
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
        isClient: false,
      });
    }
    const t = threadsMap.get(other)!;
    if (m.to_id === me && !m.read_at) t.unread += 1;
  }

  const otherIds = Array.from(threadsMap.keys());

  // Fetch other users' profile info
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

  // Mark threads where the other person has booked with me as "client" (else "lead")
  if (otherIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("client_id")
      .eq("trainer_id", me)
      .in("client_id", otherIds)
      .neq("status", "cancelled");
    const clientIds = new Set((bookings ?? []).map((b) => b.client_id));
    for (const id of clientIds) {
      const t = threadsMap.get(id);
      if (t) t.isClient = true;
    }
  }

  const threads = Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );

  // Active conversation
  let conversation: ConversationMessage[] = [];
  let activeOther: { id: string; name: string; avatar: string | null } | null = null;
  let firstBookingAt: string | null = null;
  let upcoming: { start_time: string; service_name?: string | null; package_name?: string | null; service?: { name: string | null } | null; package?: { name: string | null } | null } | null = null;
  let totalBookings = 0;

  if (withId) {
    const { data: conv } = await supabase
      .from("messages")
      .select("id, from_id, to_id, text, created_at, read_at, message_type, reschedule_request_id")
      .or(`and(from_id.eq.${me},to_id.eq.${withId}),and(from_id.eq.${withId},to_id.eq.${me})`)
      .order("created_at", { ascending: true })
      .limit(500);
    type ConvRow = {
      id: string; from_id: string; to_id: string; text: string;
      created_at: string; read_at: string | null;
      message_type: string | null; reschedule_request_id: string | null;
    };
    const rows = (conv ?? []) as ConvRow[];

    const reqIds = Array.from(new Set(rows.map((m) => m.reschedule_request_id).filter((x): x is string => !!x)));
    const reqs = await getRescheduleRequestsByIds(reqIds);
    const reqById = new Map(reqs.map((r) => [r.id, r]));

    conversation = rows.map((m) => ({
      id: m.id,
      fromMe: m.from_id === me,
      text: m.text,
      createdAt: m.created_at,
      readAt: m.read_at,
      messageType: (m.message_type ?? "text") as MessageType,
      reschedule: m.reschedule_request_id ? reqById.get(m.reschedule_request_id) ?? null : null,
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
      if (p) activeOther = { id: p.id, name: p.display_name, avatar: p.avatar_url };
    }

    // Right-panel context: bookings between this client and me
    const nowIso = new Date().toISOString();
    const [{ data: bks }, { count }] = await Promise.all([
      supabase
        .from("bookings")
        .select("start_time, service_name, package_name, service:services(name), package:packages(name)")
        .eq("trainer_id", me)
        .eq("client_id", withId)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true }),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", me)
        .eq("client_id", withId)
        .neq("status", "cancelled"),
    ]);
    totalBookings = count ?? 0;
    if (bks && bks.length > 0) {
      firstBookingAt = bks[0].start_time;
      upcoming =
        (bks as unknown as { start_time: string; service_name: string | null; package_name: string | null; service: { name: string } | null; package: { name: string } | null }[])
          .find((b) => b.start_time >= nowIso) ?? null;
    }
  }

  return (
    <div className="h-[calc(100vh-56px-84px)] lg:h-[calc(100vh-56px)] flex flex-col bg-white border-b border-slate-200 overflow-hidden">
      <div className="grid sm:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr_320px] flex-1 min-h-0 overflow-hidden">
        {/* LEFT: thread list */}
        <ThreadList
          threads={threads}
          activeId={withId}
          mobileHidden={!!withId}
        />

        {/* CENTER: conversation */}
        <section className="min-w-0 flex flex-col bg-[linear-gradient(180deg,#fafbfc,#fff)]">
          {activeOther ? (
            <MessagesClient
              myId={me}
              other={activeOther}
              initialMessages={conversation}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center px-6">
              {threads.length === 0 ? (
                <EmptyState
                  icon={
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                  }
                  title="Cisza — to dobrze"
                  description="Brak nowych wiadomości od klientów. Wracamy z powiadomieniem, gdy ktoś napisze."
                  actions={[{ label: "Strona publiczna", href: "/studio", primary: false }]}
                />
              ) : (
                <EmptyState
                  icon={
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  }
                  title="Wybierz rozmowę"
                  description="Kliknij konwersację z lewej, żeby zobaczyć wątek i dane klienta."
                />
              )}
            </div>
          )}
        </section>

        {/* RIGHT: client context (lg+ only) */}
        {activeOther && (
          <ClientContextPanel
            name={activeOther.name}
            avatar={activeOther.avatar}
            firstBookingAt={firstBookingAt}
            upcoming={upcoming}
            totalBookings={totalBookings}
          />
        )}
      </div>
    </div>
  );
}

