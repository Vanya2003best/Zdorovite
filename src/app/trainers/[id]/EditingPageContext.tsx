"use client";

import { createContext, useContext } from "react";

/**
 * Carries the `pageId` of the trainer_page currently being edited. Read by
 * every Editable* component (EditableCopy / EditableSigCopy / EditableServiceField
 * / EditablePkgField / EditableAboutInline / etc.) so they can pass it through
 * to their server actions, scoping the write to that page's customization.
 *
 * Provider is set in /studio/design when the URL has `?page={id}` (i.e. the
 * trainer is editing a secondary page). Without provider OR when pageId is
 * undefined → actions fall through to the legacy primary-page path
 * (trainers.customization).
 */
export const EditingPageContext = createContext<{ pageId?: string }>({});

export function useEditingPageId(): string | undefined {
  return useContext(EditingPageContext).pageId;
}
