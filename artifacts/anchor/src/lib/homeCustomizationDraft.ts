import { isValidHomePreferences, type HomePreferences } from "./recoveryFeatures";

/** The editor and import preview share the same closed, lossless form shape. */
export function isHomeCustomizationDraft(value: unknown): value is HomePreferences {
  if (!isValidHomePreferences(value)) return false;
  const fields = ["version", "widgetOrder", "hiddenWidgets", "hiddenRegistrationTypes", "pinnedContactId", "pinnedToolIds"];
  return Object.keys(value).every(key => fields.includes(key))
    && (value.pinnedContactId === null || value.pinnedContactId.trim().length > 0);
}
