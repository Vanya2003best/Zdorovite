"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialCount: number;
  myId: string;
  /**
   * Visual variant. "inline" — small pill next to a label (desktop nav).
   * "floating" — absolutely-positioned circle on top of an icon (bottom tab bar).
   * "dot" — just a coloured dot (notification bell).
   */
  variant: "inline" | "floating" | "dot";
};

/**
 * Live unread-message counter. Subscribes to:
 *  - INSERT on messages where to_id=me  → +1
 *  - UPDATE on messages where to_id=me  → if it just became read, −1
 *
 * Combined with the SSR initialCount this stays accurate without router.refresh().
 */
export default function MessagesBadge({ initialCount, myId, variant }: Props) {
  const [count, setCount] = useState(initialCount);

  // Re-sync when SSR initialCount changes (e.g. after navigation that revalidated).
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`unread:${myId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `to_id=eq.${myId}` },
        () => setCount((c) => c + 1),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `to_id=eq.${myId}` },
        (payload) => {
          const before = payload.old as { read_at: string | null } | null;
          const after = payload.new as { read_at: string | null };
          // Only decrement on the actual unread→read transition.
          if (before?.read_at == null && after.read_at != null) {
            setCount((c) => Math.max(0, c - 1));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

  if (count <= 0) return null;

  if (variant === "dot") {
    return (
      <span
        aria-label={`${count} nieprzeczytane`}
        className="absolute top-2 right-2 w-[7px] h-[7px] bg-red-500 rounded-full border-[1.5px] border-white"
      />
    );
  }

  if (variant === "floating") {
    return (
      <span className="absolute -top-1 -right-2 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9.5px] font-bold border-[1.5px] border-white">
        {count > 9 ? "9+" : count}
      </span>
    );
  }

  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-500 text-white text-[10.5px] font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
}
