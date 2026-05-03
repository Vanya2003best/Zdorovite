"use client";

import { updateStudioCopyField } from "./studio-copy-actions";
import InlineEditable from "./InlineEditable";
import { useEditingPageId } from "./EditingPageContext";
import { useRefreshKeepingScroll } from "./keep-scroll";

/**
 * Inline editor for a single StudioCopy field. Mirrors EditableLuxCopy with
 * Studio's burnt-orange accent + light theme as defaults.
 */
type Theme = "light" | "dark";

export default function EditableStudioCopy({
  field,
  initial,
  defaultValue,
  placeholder,
  className = "",
  suffix,
  theme = "light",
  accentColor = "#ff5722",
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
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();

  const onCommit = async (next: string) => {
    await updateStudioCopyField(field, next, pageId);
    refreshKeepingScroll();
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
