"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleFavorite } from "./favorite-actions";

type Props = {
  slug: string;
  /**
   * Initial state from the server. The component drives further state itself
   * via toggleFavorite + optimistic update.
   */
  initialIsFavorite: boolean;
  /**
   * If true, the button just links to /login?next=... instead of mutating.
   * Used when no one is signed in.
   */
  needsLogin: boolean;
  /**
   * Tailwind classes for the wrapper. Defaults to a circular cover-style button.
   */
  className?: string;
  /** Icon size in px. */
  size?: number;
};

const DEFAULT_CLASS =
  "w-10 h-10 rounded-full bg-white/92 backdrop-blur-md flex items-center justify-center text-slate-900 transition disabled:opacity-70";

export default function FavoriteButton({
  slug,
  initialIsFavorite,
  needsLogin,
  className,
  size = 16,
}: Props) {
  const [isFav, setIsFav] = useState(initialIsFavorite);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cls = className ?? DEFAULT_CLASS;

  if (needsLogin) {
    return (
      <Link
        href={`/login?next=/trainers/${slug}`}
        aria-label="Zaloguj się, by dodać do ulubionych"
        className={cls}
      >
        <HeartIcon filled={false} size={size} />
      </Link>
    );
  }

  const onClick = () => {
    if (pending) return;
    setError(null);
    const optimistic = !isFav;
    setIsFav(optimistic);
    startTransition(async () => {
      const res = await toggleFavorite(slug);
      if ("error" in res) {
        setError(res.error);
        setIsFav(!optimistic); // rollback
        return;
      }
      setIsFav(res.isFavorite);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={isFav}
      aria-label={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
      title={error ?? (isFav ? "W ulubionych" : "Dodaj do ulubionych")}
      className={cls}
    >
      <HeartIcon filled={isFav} size={size} />
    </button>
  );
}

function HeartIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={filled ? "text-red-500" : "text-slate-700"}
    >
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
