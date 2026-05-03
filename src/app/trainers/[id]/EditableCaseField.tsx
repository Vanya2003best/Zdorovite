"use client";

import { updateStudioCaseField } from "./studio-copy-actions";
import InlineEditable from "./InlineEditable";
import { useEditingPageId } from "./EditingPageContext";
import { useRefreshKeepingScroll } from "./keep-scroll";
import type { StudioCaseStudy } from "@/types";

/**
 * Inline editor for a single field on a Studio case study. Wraps
 * InlineEditable and dispatches updateStudioCaseField on commit. The case is
 * identified by its UUID; the field is one of the StudioCaseStudy keys.
 */
type Theme = "light" | "dark";

export default function EditableCaseField({
  caseId,
  field,
  initial,
  defaultValue,
  placeholder,
  className = "",
  theme = "light",
  accentColor = "#ff5722",
  rich = true,
  multiline,
  block,
  maxLength,
}: {
  caseId: string;
  field: keyof StudioCaseStudy;
  initial: string | undefined;
  defaultValue: string;
  placeholder?: string;
  className?: string;
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
    await updateStudioCaseField(caseId, field, next, pageId);
    refreshKeepingScroll();
  };

  const value = initial ?? defaultValue;

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
