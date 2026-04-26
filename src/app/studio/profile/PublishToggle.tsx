"use client";

import { useTransition } from "react";
import { togglePublished } from "@/app/trainers/[id]/edit-actions";

export default function PublishToggle({ published }: { published: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => { await togglePublished(); })}
      className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-semibold transition disabled:opacity-60 ${
        published
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
      }`}
      title={published ? "Twój profil jest widoczny dla klientów" : "Twój profil jest w trybie szkicu"}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          published ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
        }`}
      />
      {pending ? "..." : published ? "Opublikowany" : "Szkic"}
    </button>
  );
}
