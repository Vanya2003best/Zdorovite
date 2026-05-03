"use client";

import { useRouter } from "next/navigation";
import InlineEditable from "./InlineEditable";
import { updateTrainerField } from "./edit-actions";

/**
 * Click-to-edit wrapper around InlineEditable for the trainers.about column.
 * Used by SignatureProfile (and any other template that wants a contenteditable
 * about body instead of the textarea-based EditableText). Same UX as the
 * EditableSigCopy pattern: hover → dotted underline, click → edit, Ctrl+Enter
 * → save, Esc → cancel.
 *
 * Theme defaults to "light" because Signature renders on a paper background.
 * Pass theme="dark" if you reuse this on a dark template later.
 */
export default function EditableAboutInline({
  initial,
  className = "",
  theme = "light",
  placeholder = "Napisz swój list — podziel akapity pustą linią.",
  maxLength = 3000,
}: {
  initial: string;
  className?: string;
  theme?: "light" | "dark";
  placeholder?: string;
  maxLength?: number;
}) {
  const router = useRouter();

  const onCommit = async (next: string) => {
    await updateTrainerField("about", next);
    router.refresh();
  };

  return (
    <InlineEditable
      initial={initial}
      maxLength={maxLength}
      multiline
      block
      placeholder={placeholder}
      theme={theme}
      // Plain text — about is paragraph prose, not rich HTML; sanitiser strips
      // tags anyway. Keeps the editor surface uncluttered (no toolbar floating
      // over a long body of text).
      rich={false}
      className={className}
      onCommit={onCommit}
    />
  );
}
