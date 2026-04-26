"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Thread } from "./page";

type Filter = "all" | "clients" | "leads";

export default function ThreadList({
  threads,
  activeId,
  mobileHidden,
}: {
  threads: Thread[];
  activeId: string;
  mobileHidden: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => ({
    all: threads.length,
    clients: threads.filter((t) => t.isClient).length,
    leads: threads.filter((t) => !t.isClient).length,
  }), [threads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === "clients" && !t.isClient) return false;
      if (filter === "leads" && t.isClient) return false;
      if (q.length >= 2) {
        const hay = `${t.otherName} ${t.lastText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threads, filter, query]);

  return (
    <aside className={`${mobileHidden ? "hidden sm:flex" : "flex"} flex-col bg-white border-r border-slate-200 overflow-hidden`}>
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-[9px] bg-slate-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj klienta lub wiadomości…"
            className="flex-1 bg-transparent outline-none text-[13px] text-slate-900 placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-1.5 mt-3">
          {([
            ["all", "Wszystkie", counts.all],
            ["clients", "Klienci", counts.clients],
            ["leads", "Leady", counts.leads],
          ] as const).map(([k, label, n]) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border transition ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {label}
                <span className={`text-[10px] tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {visible.length === 0 ? (
          <p className="text-center text-[12px] text-slate-500 py-12 px-4">
            {threads.length === 0 ? "Nie masz jeszcze rozmów." : "Brak wyników."}
          </p>
        ) : (
          <ul>
            {visible.map((t) => {
              const active = activeId === t.otherId;
              return (
                <li key={t.otherId}>
                  <Link
                    href={`/studio/messages?with=${t.otherId}`}
                    className={`flex gap-3 p-3 rounded-[12px] transition ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                  >
                    <div className="relative w-[42px] h-[42px] rounded-full overflow-hidden bg-emerald-50 shrink-0">
                      {t.otherAvatar ? (
                        <img src={t.otherAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full inline-flex items-center justify-center text-emerald-700 font-semibold">
                          {(t.otherName || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <strong className="text-[13px] font-semibold text-slate-900 truncate">
                          {t.otherName || "Klient"}
                        </strong>
                        <span className="text-[11px] text-slate-500 ml-2 shrink-0">{formatRelative(t.lastAt)}</span>
                      </div>
                      <p className={`text-[12px] truncate mt-0.5 ${t.unread > 0 ? "text-slate-900 font-medium" : "text-slate-600"}`}>
                        {t.lastFromMe && <span className="text-slate-400">Ty: </span>}
                        {t.lastText}
                      </p>
                      <span
                        className={`mt-1 inline-block text-[10px] px-2 py-px rounded font-medium ${
                          t.isClient
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {t.isClient ? "Aktywny klient" : "Nowy lead"}
                      </span>
                    </div>
                    {t.unread > 0 && (
                      <span className="self-start mt-1 bg-emerald-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1.5 shrink-0">
                        {t.unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
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
