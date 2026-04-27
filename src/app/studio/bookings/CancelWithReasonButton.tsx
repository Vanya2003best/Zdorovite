"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAsTrainer } from "./actions";

export default function CancelWithReasonButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:border-red-400 hover:text-red-600 transition"
      >
        Anuluj
      </button>
    );
  }

  const onSubmit = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("booking_id", bookingId);
      if (reason.trim()) fd.set("reason", reason.trim());
      await cancelAsTrainer(fd);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <div className="w-full sm:w-auto inline-flex flex-col gap-1.5 p-2.5 rounded-lg border border-red-200 bg-red-50/60">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Powód anulacji (opcjonalne — klient zobaczy go w powiadomieniu)"
        className="w-full px-2.5 py-1.5 rounded-md border border-red-200 bg-white text-[12.5px] resize-none outline-none focus:border-red-400"
        autoFocus
      />
      <div className="flex gap-1.5 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setReason(""); }}
          disabled={pending}
          className="h-8 px-3 rounded-md text-[12px] font-medium text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
        >
          Wstrzymaj
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="h-8 px-3 rounded-md bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 transition disabled:opacity-50"
        >
          {pending ? "..." : "Tak, anuluj"}
        </button>
      </div>
    </div>
  );
}
