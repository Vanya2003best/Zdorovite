"use client";

import { useRouter } from "next/navigation";
import InlineEditable from "./InlineEditable";
import { updateTrainerField } from "./edit-actions";

export default function EditableTaglineInline({
  initial,
  className = "",
  theme = "light",
  placeholder = "Twój tagline...",
  maxLength = 200,
}: {
  initial: string;
  className?: string;
  theme?: "light" | "dark";
  placeholder?: string;
  maxLength?: number;
}) {
  const router = useRouter();

  const onCommit = async (next: string) => {
    await updateTrainerField("tagline", next);
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
      rich={false}
      className={className}
      onCommit={onCommit}
    />
  );
}
