"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReviewReply } from "./actions";

const REPLY_MAX = 2000;

/**
 * Trainer reply composer for a single review.
 *   - When no reply yet: collapsed "Odpowiedz" link → expands a textarea.
 *   - When reply set: shows the reply inline + "Edytuj" / "Usuń" affordances.
 *   - Save / Cancel / Delete all hit the setReviewReply server action and
 *     trigger router.refresh so the row re-renders with the canonical
 *     reply_text + reply_at from the DB.
 *
 * Stays client-only — the wrapping page (`/studio/reviews`) is a server
 * component that supplies the initial reply via props, and we keep an
 * optimistic local copy so the UI feels instant.
 */
export default function ReplyComposer({
  reviewId,
  initialReply,
  initialReplyAt,
}: {
  reviewId: string;
  initialReply?: string;
  initialReplyAt?: string;
}) {
  const router = useRouter();
  const [reply, setReply] = useState<string | undefined>(initialReply);
  const [replyAt, setReplyAt] = useState<string | undefined>(initialReplyAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialReply ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(reply ?? "");
    setEditing(true);
    setError(null);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(reply ?? "");
    setError(null);
  };

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return; // empty draft = use Usuń instead
    if (trimmed.length > REPLY_MAX) {
      setError(`Max ${REPLY_MAX} znaków.`);
      return;
    }
    startTransition(async () => {
      const res = await setReviewReply(reviewId, trimmed);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setReply(trimmed);
      setReplyAt(new Date().toISOString());
      setEditing(false);
      setError(null);
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm("Usunąć odpowiedź?")) return;
    startTransition(async () => {
      const res = await setReviewReply(reviewId, "");
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setReply(undefined);
      setReplyAt(undefined);
      setDraft("");
      setEditing(false);
      setError(null);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="mt-3 ml-14 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
        <div className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-semibold mb-2">
          Twoja odpowiedź
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={REPLY_MAX}
          rows={3}
          autoFocus
          placeholder="Napisz publiczną odpowiedź na tę opinię…"
          className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2.5 text-[14px] text-slate-900 leading-relaxed resize-y focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
          <span className="text-[12px] text-slate-500 tabular-nums">
            {draft.length}/{REPLY_MAX}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-60"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending || draft.trim().length === 0}
              className="h-9 px-4 rounded-lg text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {pending ? "Zapisuję…" : "Zapisz odpowiedź"}
            </button>
          </div>
        </div>
        {error && <div className="text-[12px] text-red-600 mt-2">{error}</div>}
      </div>
    );
  }

  if (reply) {
    const dateLabel = replyAt
      ? new Date(replyAt).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <div className="mt-3 ml-14 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="text-[11px] uppercase tracking-[0.08em] text-emerald-700 font-semibold">
            Odpowiedź od trenera
            {dateLabel && (
              <span className="text-slate-400 normal-case tracking-normal font-normal ml-2">
                · {dateLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startEdit}
              disabled={pending}
              className="h-7 px-2.5 rounded-md text-[12px] font-medium text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60"
            >
              Edytuj
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="h-7 px-2.5 rounded-md text-[12px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-60"
            >
              Usuń
            </button>
          </div>
        </div>
        <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line">
          {reply}
        </p>
        {error && <div className="text-[12px] text-red-600 mt-2">{error}</div>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="mt-3 ml-14 inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:text-emerald-900"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
      Odpowiedz publicznie
    </button>
  );
}
