import { describe, expect, it } from "vitest";
import {
  ACTIVE_REGISTRATION_VERSION,
  parseActiveRegistration,
  registrationSteps,
  type RegistrationType,
} from "../src/contexts/activeRegistrationValidation";

const legacySessions = [
  ["craving", "/craving", "onset"],
  ["trek", "/trek", "type"],
  ["anxiety", "/anxiety", "type"],
  ["boredom", "/boredom", "type"],
  ["relapse", "/relapse", "label"],
] as const satisfies ReadonlyArray<readonly [RegistrationType, string, string]>;

function legacySession(type: RegistrationType, route: string, step: string) {
  return {
    version: 1,
    type,
    route,
    step,
    draft: {},
    updatedAt: 1_700_000_000_000,
  };
}

describe("parseActiveRegistration", () => {
  it.each([null, "", "null"])("treats %j as no active session", (raw) => {
    expect(parseActiveRegistration(raw)).toEqual({ ok: true, value: null, migrated: false });
  });

  it.each(legacySessions)("migrates a valid legacy %s session to the canonical shape", (type, route, step) => {
    const result = parseActiveRegistration(JSON.stringify(legacySession(type, route, step)));

    expect(result).toMatchObject({
      ok: true,
      migrated: true,
      value: {
        version: ACTIVE_REGISTRATION_VERSION,
        type,
        route,
        step,
        startedAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
    });
    if (!result.ok || !result.value) throw new Error("Expected a migrated active registration");
    expect(result.value.recordId).toEqual(expect.any(String));
    expect(result.value.recordId).not.toBe("");
    expect(result.value.stepCount).toBe(registrationSteps(type).length - 1);
    expect(result.value.draft).toEqual(expect.any(Object));
  });

  it("uses explicit unanswered values when migrating formerly preselected drafts", () => {
    const anxiety = parseActiveRegistration(legacySession("anxiety", "/anxiety", "type"));
    const relapse = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!anxiety.ok || !anxiety.value || !relapse.ok || !relapse.value) {
      throw new Error("Expected legacy sessions to migrate");
    }

    expect(anxiety.value.draft).toMatchObject({ intensity: null });
    expect(relapse.value.draft).toMatchObject({
      episodeDuration: "unanswered",
      amountCategory: "unanswered",
      emotionAfter: null,
    });
  });

  it.each([
    ["craving", "intensity"],
    ["craving", "confidenceBefore"],
    ["craving", "intensityAfter"],
    ["trek", "intensity"],
    ["trek", "confidenceBefore"],
    ["trek", "confidenceAfter"],
    ["anxiety", "intensity"],
    ["boredom", "intensity"],
    ["relapse", "emotionAfter"],
  ] as const)("enforces the 0 through 10 range for %s.%s", (type, field) => {
    const session = legacySessions.find(([candidate]) => candidate === type);
    if (!session) throw new Error(`Missing test setup for ${type}`);
    const [, route, step] = session;
    const migrated = parseActiveRegistration(legacySession(type, route, step));
    if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");

    for (const invalid of [-1, 11, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseActiveRegistration({
        ...migrated.value,
        draft: {
          ...(migrated.value.draft as Record<string, unknown>),
          [field]: invalid,
        },
      })).toMatchObject({
        ok: false,
        error: "Active-registration draft has an invalid shape.",
      });
    }

    for (const boundary of [0, 10]) {
      expect(parseActiveRegistration({
        ...migrated.value,
        draft: {
          ...(migrated.value.draft as Record<string, unknown>),
          [field]: boundary,
        },
      })).toMatchObject({ ok: true });
    }
  });

  it("round-trips a migrated v2 session without changing its stable record ID", () => {
    const migrated = parseActiveRegistration(legacySession("craving", "/craving", "onset"));
    if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");

    const result = parseActiveRegistration(JSON.stringify(migrated.value));
    expect(result).toMatchObject({ ok: true, migrated: false });
    if (!result.ok || !result.value) throw new Error("Expected v2 parse to succeed");
    expect(result.value.recordId).toBe(migrated.value.recordId);
    expect(result.value.draft).toEqual(migrated.value.draft);
  });

  it("uses a saved log ID as the stable record ID when migrating legacy state", () => {
    const result = parseActiveRegistration({
      ...legacySession("relapse", "/relapse", "label"),
      savedLogId: "saved-log-1",
    });
    expect(result).toMatchObject({
      ok: true,
      migrated: true,
      value: { recordId: "saved-log-1", savedLogId: "saved-log-1" },
    });
  });

  it.each([
    ["anxiety", "/anxiety", "type", { urgencyHigh: false }, "urgencyHigh", null],
    ["relapse", "/relapse", "label", { acuteRisk: "none" }, "acuteRisk", "unanswered"],
  ] as const)(
    "clears the legacy preselected %s safety answer during migration",
    (type, route, step, draft, field, expected) => {
      const result = parseActiveRegistration({
        ...legacySession(type, route, step),
        draft,
      });
      if (!result.ok || !result.value) throw new Error("Expected migration to succeed");
      expect((result.value.draft as Record<string, unknown>)[field]).toBe(expected);
    },
  );

  it.each([
    ["anxiety", "/anxiety", "type", "urgencyHigh", false],
    ["relapse", "/relapse", "label", "acuteRisk", "none"],
  ] as const)(
    "preserves an explicit v2 %s safety answer",
    (type, route, step, field, explicitValue) => {
      const migrated = parseActiveRegistration(legacySession(type, route, step));
      if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");
      const value = {
        ...migrated.value,
        draft: {
          ...(migrated.value.draft as Record<string, unknown>),
          [field]: explicitValue,
        },
      };

      const result = parseActiveRegistration(value);
      if (!result.ok || !result.value) throw new Error("Expected v2 parse to succeed");
      expect((result.value.draft as Record<string, unknown>)[field]).toBe(explicitValue);
    },
  );

  it.each([
    ["invalid JSON", "{", "Active registration is not valid JSON."],
    ["a primitive", 4, "Active registration must be an object."],
    ["an unsupported version", { ...legacySession("craving", "/craving", "onset"), version: 99 }, "Unsupported active-registration version."],
    ["an unknown type", { ...legacySession("craving", "/craving", "onset"), type: "unknown" }, "Unknown active-registration type."],
    ["a mismatched route", { ...legacySession("craving", "/craving", "onset"), route: "/trek" }, "Active-registration route does not match its type."],
    ["a step from another tracker", { ...legacySession("craving", "/craving", "onset"), step: "planning" }, "Active-registration step is invalid for its type."],
    ["a non-object draft", { ...legacySession("craving", "/craving", "onset"), draft: [] }, "Active-registration draft has an invalid shape."],
    ["a malformed return target", { ...legacySession("craving", "/craving", "onset"), pendingReturn: { returnRoute: "settings", returnStep: "done" } }, "Active-registration return target is invalid."],
  ])("rejects %s", (_label, value, error) => {
    expect(parseActiveRegistration(value)).toEqual({
      ok: false,
      value: null,
      migrated: false,
      error,
    });
  });

  it("rejects a v2 draft with a missing or incorrectly typed field", () => {
    const migrated = parseActiveRegistration(legacySession("anxiety", "/anxiety", "type"));
    if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");
    const draft = migrated.value.draft as Record<string, unknown>;

    const missing = { ...migrated.value, draft: { ...draft } };
    delete (missing.draft as Record<string, unknown>).intensity;
    const wrongType = { ...migrated.value, draft: { ...draft, intensity: "high" } };

    for (const value of [missing, wrongType]) {
      expect(parseActiveRegistration(value)).toEqual({
        ok: false,
        value: null,
        migrated: false,
        error: "Active-registration draft has an invalid shape.",
      });
    }
  });

  it("requires v2 identity, timestamps, and same-tracker return targets", () => {
    const migrated = parseActiveRegistration(legacySession("craving", "/craving", "onset"));
    if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");

    const missingRecordId = { ...migrated.value } as Record<string, unknown>;
    delete missingRecordId.recordId;
    const missingStartedAt = { ...migrated.value } as Record<string, unknown>;
    delete missingStartedAt.startedAt;
    const missingUpdatedAt = { ...migrated.value } as Record<string, unknown>;
    delete missingUpdatedAt.updatedAt;

    const cases: Array<[unknown, string]> = [
      [missingRecordId, "Active-registration record ID is invalid."],
      [missingStartedAt, "Active-registration start time is invalid."],
      [missingUpdatedAt, "Active-registration update time is invalid."],
      [{ ...migrated.value, savedLogId: "" }, "Active-registration saved-log ID is invalid."],
      [
        {
          ...migrated.value,
          pendingReturn: { returnRoute: "/trek", returnStep: "type" },
        },
        "Active-registration return target is invalid.",
      ],
    ];

    for (const [value, error] of cases) {
      expect(parseActiveRegistration(value)).toEqual({
        ok: false,
        value: null,
        migrated: false,
        error,
      });
    }
  });
});
