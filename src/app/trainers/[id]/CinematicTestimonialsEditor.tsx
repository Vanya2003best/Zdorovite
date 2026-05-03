"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import InlineEditable from "./InlineEditable";
import {
  addTestimonial,
  backfillTestimonialAvatars,
  removeTestimonial,
  seedDemoTestimonials,
  updateTestimonialField,
  updateTestimonialRating,
} from "./cinematic-copy-actions";
import { useEditingPageId } from "./EditingPageContext";
import { usePreviewTransition } from "./preview-busy";
import type { CinematicTestimonial } from "@/types";

/**
 * Render testimonials in editor mode: one card per entry with inline editable
 * authorName / text / date and clickable star row to set rating. Plus a "+" tile
 * at the end to append new ones. Visual matches the read-only review card so
 * the trainer sees the public outcome while editing.
 */
export default function CinematicTestimonialsEditor({
  testimonials,
}: {
  testimonials: CinematicTestimonial[];
}) {
  const router = useRouter();
  const [pending, startTransition] = usePreviewTransition();
  const pageId = useEditingPageId();

  const onAdd = () => {
    startTransition(async () => {
      await addTestimonial(pageId);
      router.refresh();
    });
  };

  const onRemove = (id: string) => {
    startTransition(async () => {
      await removeTestimonial(id, pageId);
      router.refresh();
    });
  };

  const onCommit =
    (id: string, field: "authorName" | "text" | "date") => async (next: string) => {
      await updateTestimonialField(id, field, next, pageId);
      router.refresh();
    };

  const onSetRating = (id: string, rating: number) => {
    startTransition(async () => {
      await updateTestimonialRating(id, rating, pageId);
      router.refresh();
    });
  };

  const onSeed = () => {
    startTransition(async () => {
      const res = await seedDemoTestimonials(pageId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onBackfillAvatars = () => {
    startTransition(async () => {
      const res = await backfillTestimonialAvatars(pageId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  // Seed-author names whose portraits we know — only show the backfill nudge
  // when at least one current testimonial is a seed author still missing its photo.
  const SEED_NAMES = new Set([
    "Marcin K.",
    "Anna W.",
    "Tomasz P.",
    "Kasia M.",
    "Magdalena R.",
  ]);
  const missingAvatarCount = testimonials.filter(
    (t) => !t.authorAvatar && SEED_NAMES.has(t.authorName),
  ).length;

  // Empty-state — also let the trainer one-click load 5 ready-made Polish reviews.
  if (testimonials.length === 0) {
    return (
      <div className="border border-dashed border-white/15 rounded-2xl p-8 sm:p-12 text-center">
        <div className="font-mono text-[11px] text-white/50 tracking-[0.15em] uppercase mb-3">
          Brak opinii
        </div>
        <p className="text-[15px] text-white/70 max-w-[480px] mx-auto mb-6">
          Dodaj pierwszą opinię ręcznie albo wgraj 5 przykładowych
          (możesz je później dowolnie edytować lub usunąć).
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            type="button"
            onClick={onAdd}
            disabled={pending}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-white/15 text-[14px] font-medium text-white hover:bg-white/5 transition disabled:opacity-60"
          >
            <span className="text-lg leading-none">+</span> Dodaj opinię
          </button>
          <button
            type="button"
            onClick={onSeed}
            disabled={pending}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[14px] font-semibold hover:brightness-110 transition disabled:opacity-60"
          >
            ✨ Wgraj 5 przykładowych
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {missingAvatarCount > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-[#d4ff00]/25 bg-[#d4ff00]/[0.04] px-5 py-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="font-mono text-[11px] text-[#d4ff00] tracking-[0.15em] uppercase">
              Brakuje zdjęć
            </div>
            <p className="text-[13px] text-white/75 m-0">
              {missingAvatarCount === 1
                ? "Jedna z przykładowych opinii nie ma jeszcze zdjęcia autora."
                : `${missingAvatarCount} z przykładowych opinii nie ma jeszcze zdjęć autorów.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onBackfillAvatars}
            disabled={pending}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[13px] font-semibold hover:brightness-110 transition disabled:opacity-60 shrink-0"
          >
            ✨ Dodaj brakujące zdjęcia
          </button>
        </div>
      )}

      <div className="grid @[640px]:grid-cols-2 @[1024px]:grid-cols-3 gap-5">
        {testimonials.map((t) => (
        <div
          key={t.id}
          className="group/test relative bg-white/[0.025] border border-white/10 rounded-2xl p-7 flex flex-col"
        >
          {/* Hover delete */}
          <button
            type="button"
            onClick={() => onRemove(t.id)}
            disabled={pending}
            title="Usuń opinię"
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center opacity-0 group-hover/test:opacity-100 hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-60"
          >
            🗑
          </button>

          {/* Star rating — click a star to set rating to that index+1. */}
          <div className="text-[#d4ff00] tracking-[0.25em] text-[13px] mb-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSetRating(t.id, n)}
                disabled={pending}
                aria-label={`Ustaw ocenę: ${n}`}
                className={`transition hover:text-[#e6ff4a] disabled:opacity-60 ${n <= t.rating ? "text-[#d4ff00]" : "text-white/20"}`}
              >
                ★
              </button>
            ))}
          </div>

          <p className="text-[15px] leading-[1.55] text-white m-0 mb-6 flex-grow tracking-[-0.005em]">
            <InlineEditable
              initial={t.text}
              maxLength={500}
              multiline
              block
              theme="dark"
              rich
              accentColor="#d4ff00"
              placeholder="Wpisz słowa od klienta..."
              onCommit={onCommit(t.id, "text")}
            />
          </p>

          <div className="flex gap-3 items-center pt-5 border-t border-white/10">
            {t.authorAvatar && (
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.authorAvatar} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[14px] font-medium tracking-[-0.005em]">
                <InlineEditable
                  initial={t.authorName}
                  maxLength={60}
                  theme="dark"
                  placeholder="Imię klienta"
                  onCommit={onCommit(t.id, "authorName")}
                />
              </div>
              <div className="font-mono text-[11px] text-white/50 tracking-[0.05em] mt-0.5">
                <InlineEditable
                  initial={t.date ?? ""}
                  maxLength={40}
                  theme="dark"
                  placeholder="np. Maraton · 03.2026"
                  onCommit={onCommit(t.id, "date")}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

        {/* Add tile */}
        <button
          type="button"
          onClick={onAdd}
          disabled={pending}
          className="rounded-2xl border-2 border-dashed border-[#d4ff00]/30 bg-[#d4ff00]/[0.02] hover:border-[#d4ff00] hover:bg-[#d4ff00]/[0.06] transition flex flex-col items-center justify-center gap-2 min-h-[260px] text-[#d4ff00]/80 hover:text-[#d4ff00] disabled:opacity-60"
        >
          <span className="text-3xl leading-none">+</span>
          <span className="font-mono text-[12px] uppercase tracking-[0.15em]">
            {pending ? "Dodaję..." : "Dodaj opinię"}
          </span>
        </button>
      </div>
    </div>
  );
}
