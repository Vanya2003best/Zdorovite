"use client";

import { useRouter } from "next/navigation";
import InlineEditable from "./InlineEditable";
import { updateTrainerField } from "./edit-actions";
import { pinScrollFor } from "./keep-scroll";

type Field = "tagline" | "about" | "location" | "experience" | "price_from";

export default function EditableTrainerField({
  field,
  initial,
  multiline = false,
  numeric = false,
  maxLength,
  placeholder,
  className,
  block = false,
}: {
  field: Field;
  initial: string;
  multiline?: boolean;
  numeric?: boolean;
  maxLength: number;
  placeholder?: string;
  className?: string;
  block?: boolean;
}) {
  const router = useRouter();
  return (
    <InlineEditable
      initial={initial}
      maxLength={maxLength}
      multiline={multiline}
      numeric={numeric}
      placeholder={placeholder}
      className={className}
      block={block}
      onCommit={async (value) => {
        pinScrollFor(1500);
        const res = await updateTrainerField(field, value);
        if ("error" in res) {
          alert(res.error);
          return;
        }
        router.refresh();
      }}
    />
  );
}
