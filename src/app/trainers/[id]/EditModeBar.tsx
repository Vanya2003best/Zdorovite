"use client";

import Link from "next/link";
import { useTransition } from "react";
import { togglePublished } from "./edit-actions";

export default function EditModeBar({
  slug,
  published,
}: {
  slug: string;
  published: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onTogglePublish = () => {
    startTransition(async () => {
      await togglePublished();
    });
  };

  return (
    <div className="sticky top-16 z-40 bg-emerald-600 text-white shadow-[0_4px_12px_rgba(2,6,23,0.1)]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 h-12 flex items-center justify-between gap-3 text-[13px]">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <strong className="font-semibold">Edytujesz profil</strong>
          <span className="hidden sm:inline text-emerald-100">
            — kliknij dowolny tekst, aby edytować
          </span>
        </span>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={pending}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium transition ${
              published
                ? "bg-emerald-700/80 hover:bg-emerald-800"
                : "bg-amber-500 hover:bg-amber-600"
            } disabled:opacity-60`}
          >
            {pending ? "..." : published ? "✓ Opublikowany" : "◌ Szkic (nieopublikowany)"}
          </button>
          <Link
            href={`/trainers/${slug}`}
            className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-[12px] font-medium inline-flex items-center transition"
          >
            Podgląd klienta
          </Link>
        </div>
      </div>
    </div>
  );
}
