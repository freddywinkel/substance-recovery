import { z } from "zod/v4";

// ── Request limits ──────────────────────────────────────────────────────────
export const MAX_CHANGES_PER_REQUEST = 500;
export const MAX_PAYLOAD_BYTES = 100_000;
export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PULL_LIMIT = 1000;

// ── Kind allowlist ──────────────────────────────────────────────────────────
// Only these record kinds may be synced. Everything else (theme, language,
// active registration drafts, etc.) stays device-local and is rejected here.
export const SYNCABLE_KINDS = [
  "journal",
  "cravingLogs",
  "relapseLogs",
  "anxietyLogs",
  "boredomLogs",
  "setting:sobrietyStartDate",
] as const;

export type SyncableKind = (typeof SYNCABLE_KINDS)[number];

const kindSet = new Set<string>(SYNCABLE_KINDS);

export function isSyncableKind(kind: string): kind is SyncableKind {
  return kindSet.has(kind);
}

// ── Per-kind payload validation ─────────────────────────────────────────────
// Record kinds carry the full IndexedDB record; we require an `id` (matched to
// recordId below). The single setting kind carries a small typed value object.
// Default z.object() ignores extra keys without failing, so validation acts as
// a gate while the route stores the original payload verbatim (faithful JSONB
// backstore). Tombstones (deleted=true) skip payload validation.
const recordPayload = z.object({ id: z.string().min(1) });

const settingPayload = z.object({
  value: z.string().nullable(),
  updatedAt: z.number(),
});

const payloadValidators: Record<SyncableKind, z.ZodType> = {
  journal: recordPayload,
  cravingLogs: recordPayload,
  relapseLogs: recordPayload,
  anxietyLogs: recordPayload,
  boredomLogs: recordPayload,
  "setting:sobrietyStartDate": settingPayload,
};

export type ChangeValidation = { ok: true } | { ok: false; error: string };

export function validateChangePayload(
  kind: SyncableKind,
  recordId: string,
  deleted: boolean,
  payload: unknown,
): ChangeValidation {
  if (deleted) {
    return { ok: true };
  }
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: `payload required for ${kind}/${recordId}` };
  }
  const size = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (size > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: `payload too large for ${kind}/${recordId}` };
  }
  const result = payloadValidators[kind].safeParse(payload);
  if (!result.success) {
    return { ok: false, error: `invalid payload for ${kind}/${recordId}` };
  }
  // Record kinds: the payload id must equal the recordId so a client cannot
  // smuggle a record in under a mismatched key.
  if (kind !== "setting:sobrietyStartDate") {
    const pid = (payload as { id?: unknown }).id;
    if (pid !== recordId) {
      return { ok: false, error: `id mismatch for ${kind}/${recordId}` };
    }
  }
  return { ok: true };
}

// ── CSRF / origin check ─────────────────────────────────────────────────────
// Cookie-authenticated mutations are vulnerable to CSRF. Browsers always send
// an Origin header on cross-origin POSTs, so we require Origin (when present)
// to match the request host. Non-browser clients without Origin are allowed
// through (still gated by requireAuth).
export function isOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
): boolean {
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    return !!host && originHost === host;
  } catch {
    return false;
  }
}

export function clampPullLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_PULL_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_PULL_LIMIT);
}
