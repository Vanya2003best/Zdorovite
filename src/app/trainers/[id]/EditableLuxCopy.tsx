"use client";

import { useRouter } from "next/navigation";
import { updateLuxuryCopyField } from "./luxury-copy-actions";
import InlineEditable from "./InlineEditable";
import { useEditingPageId } from "./EditingPageContext";

/**
 * Inline editor for a single LuxuryCopy field. Mirrors EditableSigCopy with
 * Luxury's gold accent + light theme as defaults.
 */
type Theme = "light" | "dark";

export default function EditableLuxCopy({
  field,
  initial,
  defaultValue,
  placeholder,
  className = "",
  suffix,
  theme = "light",
  accentColor = "#8a7346",
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
  const pageId = useEditingPageId();

  const onCommit = async (next: string) => {
    await updateLuxuryCopyField(field, next, pageId);
    router.refresh();
  };

  const value = initial ?? defaultValue;

  if (suffix) {
    return (
      <>
        <InlineEditable
          initial={value}
          maxLength={maxLength ?? 300}
          multiline={multiline ?? false}
          block={block ?? false}
          placeholder={placeholder}
          theme={theme}
          rich={rich}
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
      maxLength={maxLength ?? 300}
      multiline={multiline ?? false}
      block={block ?? false}
      placeholder={placeholder}
      theme={theme}
      rich={rich}
      accentColor={accentColor}
      className={className}
      onCommit={onCommit}
    />
  );
}
