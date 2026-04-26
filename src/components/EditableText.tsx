"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateTrainerField } from "@/app/trainers/[id]/edit-actions";

type Props = {
  field: "tagline" | "about" | "location" | "experience" | "price_from";
  initial: string;
  multiline?: boolean;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
};

/**
 * Click-to-edit text. Saves on blur or Ctrl+Enter (multiline) / Enter (single line).
 * Outside edit mode renders a plain element with the styles from className.
 */
export default function EditableText({
  field,
  initial,
  multiline = false,
  type = "text",
  className,
  placeholder,
  maxLength,
  min,
  max,
}: Props) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current instanceof HTMLTextAreaElement) {
        ref.current.selectionStart = ref.current.selectionEnd = ref.current.value.length;
      }
    }
  }, [editing]);

  const commit = () => {
    if (value.trim() === initial.trim()) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateTrainerField(field, value);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const cancel = () => {
    setValue(initial);
    setEditing(false);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      cancel();
      return;
    }
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
    if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    // All spans (not divs) so EditableText can be used inside <p> without hydration errors.
    return (
      <span className={`relative ${multiline ? "block w-full" : "inline-block"}`}>
        {multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            maxLength={maxLength}
            placeholder={placeholder}
            className={`${className ?? ""} block w-full bg-emerald-50/40 border-2 border-emerald-400 rounded-lg p-2 outline-none resize-vertical`}
            rows={Math.max(3, value.split("\n").length + 1)}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            maxLength={maxLength}
            min={min}
            max={max}
            placeholder={placeholder}
            className={`${className ?? ""} bg-emerald-50/40 border-2 border-emerald-400 rounded-lg px-2 py-1 outline-none inline-block`}
          />
        )}
        <span className="absolute -top-6 right-0 text-[11px] text-emerald-700 font-medium block whitespace-nowrap">
          {pending ? "Zapisywanie..." : multiline ? "Ctrl+Enter → zapisz · Esc → anuluj" : "Enter → zapisz · Esc → anuluj"}
        </span>
        {error && (
          <span className="absolute left-0 right-0 -bottom-6 text-[11px] text-red-600 block">{error}</span>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Kliknij, aby edytować"
      className={`${className ?? ""} cursor-text relative rounded hover:bg-emerald-50/40 hover:outline hover:outline-2 hover:outline-emerald-300 transition inline`}
    >
      {value || (
        <span className="text-slate-400 italic">{placeholder ?? "Kliknij, aby dodać..."}</span>
      )}
      {saved && (
        <span className="ml-2 text-[11px] text-emerald-700 font-medium">✓ zapisano</span>
      )}
    </span>
  );
}
