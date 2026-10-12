import { TOOL_IDS } from "./recoveryFeatures";

export function balanceMomentPath(id: string): string {
  return `/daily/moments/${encodeURIComponent(id)}`;
}

/** Only known tool routes may consume the explicit linked-activity query. */
export function balanceToolContext(
  path: string,
  search: string,
): { present: boolean; id: string | null } {
  if (!(TOOL_IDS as readonly string[]).includes(path))
    return { present: false, id: null };
  const values = new URLSearchParams(search).getAll("balanceMoment");
  if (values.length === 0) return { present: false, id: null };
  const id = values[0]?.trim();
  return {
    present: true,
    id: values.length === 1 && id && id.length <= 200 ? id : null,
  };
}

/** A quick anxiety/tension intensity is never silently relabelled as craving. */
export function balanceCravingSeed(
  registrationType: string,
  intensity: number | null,
): number | null {
  return registrationType === "craving" &&
    intensity !== null &&
    Number.isInteger(intensity) &&
    intensity >= 0 &&
    intensity <= 10
    ? intensity
    : null;
}
