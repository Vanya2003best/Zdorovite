"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import InlineEditable from "./InlineEditable";
import { updateCinematicCopyField } from "./cinematic-copy-actions";

/**
 * EditableCopy variant for fields whose default has inline decoration that can't
 * survive a round-trip through plain text — e.g. the fullbleed quote where two
 * keywords are highlighted lime via <em className="text-[#d4ff00]">. Plain
 * EditableCopy would strip the JSX in editor view, making the editor look
 * different from the public page.
 *
 * State machine:
 *  - initial=undefined && !editing  → render `decoratedDefault` JSX (matches public)
 *  - click on decorated             → flip editing=true → swap to plain editor
 *  - blur with no change            → onAbort fires → editing=false → decorated again
 *  - blur with value === default    → server clears override, editing=false → decorated
 *  - blur with custom value         → server saves override, stay in plain editor
 *  - initial set (override exists)  → always plain editor (custom text won't have
 *                                     the same keyword positions, decoration moot)
 */
type Theme = "light" | "dark";

export default function EditableCopyDecorated({
  field,
  initial,
  defaultValue,
  decoratedDefault,
  maxLength = 300,
  multiline = true,
  block = true,
  className = "",
  theme = "dark",
}: {
  field: string;
  initial: string | undefined;
  defaultValue: string;
  decoratedDefault: ReactNode;
  maxLength?: number;
  multiline?: boolean;
  block?: boolean;
  className?: string;
  theme?: Theme;
}) {
  const router = useRouter();
  const hasOverride = !!initial && initial.trim() !== "";
  const [editing, setEditing] = useState(false);

  // No override AND not actively editing → show the decorated JSX. Click flips
  // editing to true and the InlineEditable mounts with autoFocus.
  if (!editing && !hasOverride) {
    return (
      <span
        className={`cursor-text ${className}`}
        onClick={() => setEditing(true)}
        title="Kliknij, aby edytować"
      >
        {decoratedDefault}
      </span>
    );
  }

  return (
    <InlineEditable
      initial={initial ?? defaultValue}
      maxLength={maxLength}
      multiline={multiline}
      block={block}
      placeholder={defaultValue}
      theme={theme}
      className={className}
      autoFocus={!hasOverride}
      onAbort={() => setEditing(false)}
      onCommit={async (next) => {
        // If the trainer typed back to the default exactly, treat that as
        // "remove override" so the lime-accented decoration returns next render.
        const trimmed = next.trim();
        const isBackToDefault = trimmed === defaultValue.trim();
        const valueToSend = isBackToDefault ? "" : next;
        await updateCinematicCopyField(field, valueToSend);
        if (valueToSend === "") {
          // Override cleared → revert to decorated mode.
          setEditing(false);
        }
        router.refresh();
      }}
    />
  );
}
