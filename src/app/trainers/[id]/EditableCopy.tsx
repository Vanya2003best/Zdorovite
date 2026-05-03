"use client";

import { useRouter } from "next/navigation";
import { updateCinematicCopyField } from "./cinematic-copy-actions";
import InlineEditable from "./InlineEditable";
import { useEditingPageId } from "./EditingPageContext";

/**
 * In-place editor for a single Cinematic copy override. Wraps InlineEditable
 * with field-specific config and dispatches updateCinematicCopyField on commit.
 *
 * All cinematic-copy fields are rich by default (selection toolbar with
 * Akcent / Italic / Clear). The accent color comes from the caller — typically
 * the template's brand color (#d4ff00 for Cinematic).
 */
type Field = "name" | "description" | "duration" | "price"; // unused but kept for API compat
void ({} as Field);

type Theme = "light" | "dark";

const FIELD_CONFIG: Record<
  string,
  { maxLength: number; numeric?: boolean; multiline?: boolean; block?: boolean }
> = {
  // service-shape fields (legacy callers may still use these)
  name:        { maxLength: 40 },
  description: { maxLength: 120, multiline: true, block: true },
  price:       { maxLength: 5, numeric: true },
  duration:    { maxLength: 3, numeric: true },
};

export default function EditableCopy({
  field,
  initial,
  defaultValue,
  placeholder,
  className = "",
  suffix,
  theme = "light",
  accentColor = "#d4ff00",
  rich = true,
  multiline,
  block,
  maxLength,
}: {
  field: string;
  initial: string | undefined;
  defaultValue: string;
  placeholder?: string;
  className?: string;
  suffix?: string;
  theme?: Theme;
  accentColor?: string;
  /** Rich-text mode (HTML + selection toolbar). Default true since EditableCopy
   *  is only used in CinematicProfile where every text field should be richable. */
  rich?: boolean;
  multiline?: boolean;
  block?: boolean;
  maxLength?: number;
}) {
  const router = useRouter();
  const cfg = FIELD_CONFIG[field];
  const pageId = useEditingPageId();

  // Resolve config: explicit props override defaults, then fall back to FIELD_CONFIG entry
  // (kept for old callers), and finally a generous default for cinematic-copy fields.
  const effectiveMaxLength = maxLength ?? cfg?.maxLength ?? 300;
  const effectiveMultiline = multiline ?? cfg?.multiline ?? false;
  const effectiveBlock = block ?? cfg?.block ?? false;
  const isNumeric = cfg?.numeric ?? false;

  const onCommit = async (next: string) => {
    await updateCinematicCopyField(field, next, pageId);
    router.refresh();
  };

  const value = initial ?? defaultValue;

  if (suffix) {
    return (
      <>
        <InlineEditable
          initial={value}
          maxLength={effectiveMaxLength}
          numeric={isNumeric}
          multiline={effectiveMultiline}
          block={effectiveBlock}
          placeholder={placeholder}
          theme={theme}
          rich={rich && !isNumeric}
          accentColor={accentColor}
          className={className}
          onCommit={onCommit}
        />
        {suffix}
      </>
    );
  }

  return (
    <InlineEditable
      initial={value}
      maxLength={effectiveMaxLength}
      numeric={isNumeric}
      multiline={effectiveMultiline}
      block={effectiveBlock}
      placeholder={placeholder}
      theme={theme}
      rich={rich && !isNumeric}
      accentColor={accentColor}
      className={className}
      onCommit={onCommit}
    />
  );
}
