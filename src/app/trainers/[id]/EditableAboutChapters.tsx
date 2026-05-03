"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import InlineEditable from "./InlineEditable";
import {
  addAboutChapter,
  removeAboutChapter,
  updateAboutChapterField,
} from "./cinematic-copy-actions";
import type { AboutChapter } from "@/types";
import { useEditingPageId } from "./EditingPageContext";
import { usePreviewTransition } from "./preview-busy";

/**
 * Cinematic about-section chapters in edit mode.
 *
 * Replaces the read-mode rendering that auto-splits trainer.about into 3
 * paragraphs and pairs them with hardcoded titles. Once the trainer edits
 * any chapter or adds a new one, the customization.cinematicCopy.aboutChapters
 * array is the source of truth (read-mode falls back only when this array is
 * empty/undefined).
 *
 * Each chapter has 3 inline editable fields (title, head, body) and a hover
 * delete. A trailing "+ Dodaj rozdział" tile appends a new chapter with
 * placeholder copy.
 */
export default function EditableAboutChapters({
  chapters,
}: {
  chapters: AboutChapter[];
}) {
  const router = useRouter();
  const [pending, startTransition] = usePreviewTransition();
  const pageId = useEditingPageId();

  const onAdd = () => {
    startTransition(async () => {
      await addAboutChapter(pageId);
      router.refresh();
    });
  };

  const onRemove = (id: string) => {
    startTransition(async () => {
      await removeAboutChapter(id, pageId);
      router.refresh();
    });
  };

  const onCommit = (id: string, field: "title" | "head" | "body") => async (next: string) => {
    await updateAboutChapterField(id, field, next, pageId);
    router.refresh();
  };

  return (
    <div className="grid gap-16 sm:gap-18 min-w-0">
      {chapters.map((c) => (
        <div key={c.id} className="group/ch relative min-w-0">
          {/* Hover delete — top-right of the chapter block */}
          <button
            type="button"
            onClick={() => onRemove(c.id)}
            disabled={pending}
            title="Usuń rozdział"
            className="absolute top-0 right-0 z-10 w-8 h-8 rounded-full bg-white/5 border border-white/15 text-white/70 inline-flex items-center justify-center opacity-0 group-hover/ch:opacity-100 hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-60"
          >
            🗑
          </button>

          <div className="font-mono text-[11px] text-[#d4ff00] tracking-[0.2em] mb-3 pr-10">
            <InlineEditable
              initial={c.title}
              maxLength={60}
              theme="dark"
              rich
              accentColor="#d4ff00"
              placeholder="01 / Rozdział"
              onCommit={onCommit(c.id, "title")}
            />
          </div>
          <h3
            style={{ fontSize: "clamp(22px, 3.5cqw, 42px)" }}
            className="leading-[1.1] tracking-[-0.025em] font-medium m-0 mb-5 pr-10"
          >
            <InlineEditable
              initial={c.head}
              maxLength={80}
              theme="dark"
              rich
              accentColor="#d4ff00"
              placeholder="Tytuł rozdziału"
              onCommit={onCommit(c.id, "head")}
            />
          </h3>
          <div className="text-[15px] sm:text-[17px] leading-[1.6] text-white/70 m-0 tracking-[-0.005em]">
            <InlineEditable
              initial={c.body}
              maxLength={1500}
              multiline
              block
              theme="dark"
              rich
              accentColor="#d4ff00"
              placeholder="Treść rozdziału..."
              onCommit={onCommit(c.id, "body")}
            />
          </div>
        </div>
      ))}

      {/* Add tile */}
      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="group flex items-center justify-center gap-2.5 min-h-[120px] rounded-[16px] border-2 border-dashed border-[#d4ff00]/30 bg-[#d4ff00]/[0.02] text-[#d4ff00]/80 hover:border-[#d4ff00] hover:bg-[#d4ff00]/[0.06] hover:text-[#d4ff00] transition disabled:opacity-60"
      >
        <span className="text-2xl leading-none">+</span>
        <span className="font-mono text-[12px] tracking-[0.15em] uppercase">
          {pending ? "Dodaję..." : "Dodaj rozdział"}
        </span>
      </button>
    </div>
  );
}
