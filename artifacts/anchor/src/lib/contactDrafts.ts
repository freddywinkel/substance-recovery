import type { EmergencyContact } from "@/db/schema";
import type { CareRole } from "./careDirectory";
export interface CareContactDraft {
  selected: string; name: string; number: string; role: CareRole; availability: string; eligibility: string;
}
export function isCareContactDraft(value: unknown): value is CareContactDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return ["selected", "name", "number", "availability", "eligibility"].every(key => typeof item[key] === "string" && (item[key] as string).length <= 500)
    && ["emergency", "suicide-support", "urgent-care", "treatment", "advice", "listening", "relatives", "safeguarding", "non-acute-report", "unverified"].includes(item.role as string);
}
export function isPersonalContactDraft(value: unknown): value is EmergencyContact | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return ["id", "name", "relationship", "phone"].every(key => typeof item[key] === "string" && (item[key] as string).length <= 500)
    && ["role", "availability", "supportNotes", "fallback"].every(key => item[key] === undefined || (typeof item[key] === "string" && (item[key] as string).length <= 500))
    && (item.sharingPreference === undefined || ["unanswered", "ask-first", "may-share", "keep-private"].includes(item.sharingPreference as string));
}
