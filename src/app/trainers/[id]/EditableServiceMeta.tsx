"use client";

import InlineEditable from "./InlineEditable";
import { setItemOverride } from "./override-actions";
import { useEditingPageId } from "./EditingPageContext";
import { useRefreshKeepingScroll } from "./keep-scroll";

/**
 * Inline editor for a service's per-page "meta" string (the suffix on the
 * card's bottom row — e.g. "min · sala", "online", "1 sesja · studio").
 * Saves via setItemOverride into customization.serviceOverrides[id].meta;
 * if cleared, falls back to the supplied defaultValue. Rich-enabled by
 * default so the trainer can accent any word with the selection toolbar.
 */
export default function EditableServiceMeta({
  serviceId,
  initial,
  defaultValue,
  className = "",
}: {
  serviceId: string;
  initial: string | undefined;
  defaultValue: string;
  className?: string;
}) {
  const pageId = useEditingPageId();
  const refreshKeepingScroll = useRefreshKeepingScroll();

  const onCommit = async (next: string) => {
    const trimmed = next.trim();
    await setItemOverride(
      "service",
      serviceId,
      { meta: trimmed === "" ? undefined : trimmed },
      pageId,
    );
    refreshKeepingScroll();
  };

  return (
    <InlineEditable
      initial={initial ?? defaultValue}
      maxLength={80}
      multiline={false}
      block={false}
      placeholder={defaultValue}
      theme="light"
      rich
      accentColor="#ff5722"
      className={className}
      onCommit={onCommit}
    />
  );
}
