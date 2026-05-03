"use client";

import { useRouter } from "next/navigation";
import { updateSignatureCopyField } from "./signature-copy-actions";
import InlineEditable from "./InlineEditable";
import { useEditingPageId } from "./EditingPageContext";

/**
 * In-place editor for a single SignatureCopy override. Mirrors EditableCopy
 * (the Cinematic-template counterpart) but dispatches updateSignatureCopyField
 * on commit. Default theme is "light" because the Signature palette is
 * cream-on-burgundy, not Cinematic's dark.
 *
 * Accent color defaults to Signature's burgundy. Rich-text mode is on by
 * default — the only fields that pass `rich={false}` are the plain contact
 * details (phone, email, studio).
 */
type Theme = "light" | "dark";

const FIELD_CONFIG: Record<
  string,
  { maxLength: number; numeric?: boolean; multiline?: boolean; block?: boolean }
> = {};

export default function EditableSigCopy({
  field,
  initial,
  defaultValue,
  placeholder,
  className = "",
  suffix,
  theme = "light",
  accentColor = "#7d1f1f",
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
  rich?: boolean;
  multiline?: boolean;
  block?: boolean;
  maxLength?: number;
}) {
  const router = useRouter();
  const cfg = FIELD_CONFIG[field];
  const pageId = useEditingPageId();

  const effectiveMaxLength = maxLength ?? cfg?.maxLength ?? 300;
  const effectiveMultiline = multiline ?? cfg?.multiline ?? false;
  const effectiveBlock = block ?? cfg?.block ?? false;
  const isNumeric = cfg?.numeric ?? false;

  const onCommit = async (next: string) => {
    await updateSignatureCopyField(field, next, pageId);
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
