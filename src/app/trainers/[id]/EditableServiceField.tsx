"use client";

import { useRouter } from "next/navigation";
import { updateServiceField } from "./service-actions";
import InlineEditable from "./InlineEditable";

/**
 * In-place editor for a service field. Wraps InlineEditable with the right
 * maxLength/numeric/multiline config per field, and dispatches updateServiceField
 * on commit. The suffix (e.g., " zł", " min") is rendered as a plain sibling so
 * it can't accidentally enter the editable area.
 */
type Field = "name" | "description" | "duration" | "price";
type Theme = "light" | "dark";

const FIELD_CONFIG: Record<
  Field,
  { maxLength: number; numeric?: boolean; multiline?: boolean; block?: boolean }
> = {
  name:        { maxLength: 40 },
  description: { maxLength: 120, multiline: true, block: true },
  price:       { maxLength: 5, numeric: true },
  duration:    { maxLength: 3, numeric: true },
};

export default function EditableServiceField({
  serviceId,
  field,
  initial,
  placeholder,
  className = "",
  suffix,
  theme = "light",
}: {
  serviceId: string;
  field: Field;
  initial: string;
  placeholder?: string;
  className?: string;
  suffix?: string;
  theme?: Theme;
}) {
  const router = useRouter();
  const cfg = FIELD_CONFIG[field];

  const onCommit = async (next: string) => {
    const res = await updateServiceField(serviceId, field, next);
    if ("error" in res) {
      // Validation error path — rare since we limit length client-side, but if the
      // server still rejects (e.g., negative price), best-effort: revert to initial
      // by reloading server state.
      router.refresh();
      return;
    }
    router.refresh();
  };

  if (suffix) {
    return (
      <>
        <InlineEditable
          initial={initial}
          maxLength={cfg.maxLength}
          numeric={cfg.numeric}
          multiline={cfg.multiline}
          block={cfg.block}
          placeholder={placeholder}
          theme={theme}
          className={className}
          onCommit={onCommit}
        />
        {suffix}
      </>
    );
  }

  return (
    <InlineEditable
      initial={initial}
      maxLength={cfg.maxLength}
      numeric={cfg.numeric}
      multiline={cfg.multiline}
      block={cfg.block}
      placeholder={placeholder}
      theme={theme}
      className={className}
      onCommit={onCommit}
    />
  );
}
