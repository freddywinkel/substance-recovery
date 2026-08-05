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
  it("retains an exact quick-registration link and rejects an empty one", () => {
    const base = parseActiveRegistration(legacySession("craving", "/craving", "onset"));
    expect(base.ok && base.value).toBeTruthy();
    if (!base.ok || !base.value) return;

    expect(parseActiveRegistration({
      ...base.value,
      quickRegistrationId: "quick-123",
      quickRegistrationTimestamp: 1_699_999_000_000,
    })).toMatchObject({
      ok: true,
      value: {
        quickRegistrationId: "quick-123",
        quickRegistrationTimestamp: 1_699_999_000_000,
      },
    });
    expect(parseActiveRegistration({ ...base.value, quickRegistrationId: "" }))
      .toMatchObject({ ok: false });
    expect(parseActiveRegistration({
      ...base.value,
      quickRegistrationTimestamp: 1_699_999_000_000,
    })).toMatchObject({ ok: false });
    expect(parseActiveRegistration({
      ...base.value,
      quickRegistrationId: "quick-123",
      quickRegistrationTimestamp: 8_640_000_000_000_001,
    })).toMatchObject({ ok: false });
  });

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

  it.each(legacySessions)("migrates a deployed v2 %s session to v3", (type, route, step) => {
    const current = parseActiveRegistration(legacySession(type, route, step));
    if (!current.ok || !current.value) throw new Error("Expected v1 migration to succeed");
    const result = parseActiveRegistration({ ...current.value, version: 2 });
    expect(result).toMatchObject({
      ok: true,
      migrated: true,
      value: { version: ACTIVE_REGISTRATION_VERSION, type, route, step },
    });
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
      acuteRisks: [],
      acuteRisk: "unanswered",
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

  it("marks an early-v2 Boredom draft as migrated when timer fields are backfilled", () => {
    const base = parseActiveRegistration(legacySession("boredom", "/boredom", "type"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const draft = { ...(base.value.draft as Record<string, unknown>) };
    delete draft.delayTimerStartedAt;
    delete draft.delayDuration;

    const result = parseActiveRegistration({ ...base.value, version: 2, draft });
    expect(result).toMatchObject({
      ok: true,
      migrated: true,
      value: { draft: { delayTimerStartedAt: null, delayDuration: null } },
    });
  });

  it("rejects current v3 drafts with missing canonical fields instead of legacy-backfilling them", () => {
    const boredom = parseActiveRegistration(legacySession("boredom", "/boredom", "type"));
    const relapse = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!boredom.ok || !boredom.value || !relapse.ok || !relapse.value) {
      throw new Error("Expected current fixtures");
    }
    const boredomDraft = { ...(boredom.value.draft as Record<string, unknown>) };
    delete boredomDraft.delayDuration;
    expect(parseActiveRegistration({ ...boredom.value, draft: boredomDraft })).toMatchObject({ ok: false });

    const relapseDraft = { ...(relapse.value.draft as Record<string, unknown>) };
    delete relapseDraft.acuteRisks;
    expect(parseActiveRegistration({ ...relapse.value, draft: relapseDraft })).toMatchObject({ ok: false });
  });

  it("rejects an unknown Trek form stored together with a specific form", () => {
    const trek = parseActiveRegistration(legacySession("trek", "/trek", "type"));
    if (!trek.ok || !trek.value) throw new Error("Expected current Trek fixture");
    expect(parseActiveRegistration({
      ...trek.value,
      draft: {
        ...(trek.value.draft as Record<string, unknown>),
        trekTypes: ["approach-not-sure", "approach-mental-rehearsal"],
      },
    })).toMatchObject({ ok: false });
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
    ["none", ["none"], "none"],
    ["unsafe", ["unsafe"], "unsafe"],
    ["withdrawal", ["withdrawal"], "withdrawal"],
  ] as const)(
    "migrates a pre-array v2 Relapse %s answer without losing it",
    (acuteRisk, expected, expectedAlias) => {
      const migrated = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
      if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");
      const draft: Record<string, unknown> = {
        ...(migrated.value.draft as Record<string, unknown>),
        acuteRisk,
      };
      delete draft.acuteRisks;

      const result = parseActiveRegistration({ ...migrated.value, version: 2, draft });
      if (!result.ok || !result.value) throw new Error("Expected v2 safety migration to succeed");
      expect(result.migrated).toBe(true);
      expect(result.value.draft).toMatchObject({ acuteRisks: expected, acuteRisk: expectedAlias });
    },
  );

  it("preserves only an explicit canonical no-concern answer across prior and partial versions", () => {
    const priorVersion = parseActiveRegistration({
      ...legacySession("relapse", "/relapse", "label"),
      draft: { acuteRisks: ["none"], acuteRisk: "none" },
    });
    expect(priorVersion).toMatchObject({
      ok: true,
      value: { draft: { acuteRisks: ["none"], acuteRisk: "none" } },
    });

    const base = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const draft: Record<string, unknown> = {
      ...(base.value.draft as Record<string, unknown>),
      acuteRisks: ["none"],
    };
    delete draft.acuteRisk;
    expect(parseActiveRegistration({ ...base.value, draft })).toMatchObject({
      ok: true,
      migrated: true,
      value: { draft: { acuteRisks: ["none"], acuteRisk: "none" } },
    });
  });

  it("migrates the deployed v2 Relapse defaults conservatively while preserving its deliberate none", () => {
    const current = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!current.ok || !current.value) throw new Error("Expected migration to succeed");
    const occurrence = new Date();
    const localOccurrence = new Date(
      occurrence.getTime() - occurrence.getTimezoneOffset() * 60_000,
    ).toISOString().slice(0, 16);
    const draft: Record<string, unknown> = {
      ...(current.value.draft as Record<string, unknown>),
      label: "no-label",
      when: "just-now",
      occurrenceDateTime: localOccurrence,
      acuteRisk: "none",
    };
    delete draft.acuteRisks;

    expect(parseActiveRegistration({ ...current.value, version: 2, draft })).toMatchObject({
      ok: true,
      migrated: true,
      value: {
        version: ACTIVE_REGISTRATION_VERSION,
        draft: {
          label: "",
          when: "",
          occurrenceDateTime: "",
          acuteRisks: ["none"],
          acuteRisk: "none",
        },
      },
    });
  });

  it("preserves the same label/time choices when current v3 stores them explicitly", () => {
    const current = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!current.ok || !current.value) throw new Error("Expected migration to succeed");
    const occurrence = new Date(Date.now() - 10 * 60 * 1000);
    const localOccurrence = new Date(
      occurrence.getTime() - occurrence.getTimezoneOffset() * 60_000,
    ).toISOString().slice(0, 16);
    expect(parseActiveRegistration({
      ...current.value,
      draft: {
        ...(current.value.draft as Record<string, unknown>),
        label: "no-label",
        when: "just-now",
        occurrenceDateTime: localOccurrence,
        acuteRisks: ["none"],
        acuteRisk: "none",
      },
    })).toMatchObject({
      ok: true,
      migrated: false,
      value: {
        draft: {
          label: "no-label",
          when: "just-now",
          occurrenceDateTime: localOccurrence,
          acuteRisks: ["none"],
        },
      },
    });
  });

  it("uses a canonical concern array even when its compatibility alias is missing or malformed", () => {
    const base = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const baseDraft = base.value.draft as Record<string, unknown>;

    for (const acuteRisk of [undefined, null, "__stale__"] as const) {
      const draft = {
        ...baseDraft,
        acuteRisks: ["unsafe", "withdrawal"],
        acuteRisk,
      };
      if (acuteRisk === undefined) delete draft.acuteRisk;
      expect(parseActiveRegistration({ ...base.value, draft })).toMatchObject({
        ok: true,
        value: {
          draft: {
            acuteRisks: ["unsafe", "withdrawal"],
            acuteRisk: "withdrawal",
          },
        },
      });
    }
  });

  it.each([
    ["first trigger", { firstTriggerType: "External event", firstTriggerText: "A message" }],
    ["support contact", { supportContact: "Friend", supportContactOther: "My neighbour" }],
    ["next step", { nextStep: "Water, food, rest first", nextStepOther: "Take a shower" }],
  ] as const)("rejects a restored Relapse draft with conflicting canned and custom %s answers", (_label, changes) => {
    const base = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    expect(parseActiveRegistration({
      ...base.value,
      draft: { ...(base.value.draft as Record<string, unknown>), ...changes },
    })).toMatchObject({
      ok: false,
      error: "Active-registration draft has an invalid shape.",
    });

    expect(parseActiveRegistration({
      ...legacySession("relapse", "/relapse", "label"),
      draft: changes,
    })).toMatchObject({
      ok: false,
      error: "Active-registration draft has an invalid shape.",
    });
  });

  it("does not restore an amount category without a substance or behavior target", () => {
    const base = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const baseDraft = base.value.draft as Record<string, unknown>;
    expect(parseActiveRegistration({
      ...base.value,
      draft: { ...baseDraft, amountCategory: "moderate" },
    })).toMatchObject({ ok: false });
    expect(parseActiveRegistration({
      ...base.value,
      draft: {
        ...baseDraft,
        primarySubstance: "Alcohol",
        amountCategory: "moderate",
      },
    })).toMatchObject({ ok: false });

    expect(parseActiveRegistration({
      ...base.value,
      version: 2,
      draft: {
        ...baseDraft,
        primarySubstance: "Alcohol",
        amountCategory: "moderate",
      },
    })).toMatchObject({
      ok: true,
      migrated: true,
      value: {
        draft: {
          substances: ["Alcohol"],
          primarySubstance: "",
          amountCategory: "moderate",
        },
      },
    });
  });

  it("migrates only legacy Relapse primary-thought scalars into the canonical plural answer", () => {
    const base = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const baseDraft = base.value.draft as Record<string, unknown>;

    expect(parseActiveRegistration({
      ...base.value,
      draft: {
        ...baseDraft,
        preUseThoughtPreset: "One time won't matter",
      },
    })).toMatchObject({ ok: false });

    expect(parseActiveRegistration({
      ...base.value,
      version: 2,
      draft: {
        ...baseDraft,
        preUseThoughtPreset: "One time won't matter",
        preUseThoughtPresets: ["I can't handle this"],
      },
    })).toMatchObject({
      ok: true,
      migrated: true,
      value: {
        draft: {
          preUseThoughtPreset: "",
          preUseThoughtPresets: ["I can't handle this", "One time won't matter"],
        },
      },
    });
  });

  it("regenerates a restored Relapse when bucket from the exact occurrence", () => {
    const base = parseActiveRegistration(legacySession("relapse", "/relapse", "when"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const occurrence = new Date(Date.now() - 30 * 60 * 1000);
    const localOccurrence = new Date(
      occurrence.getTime() - occurrence.getTimezoneOffset() * 60_000,
    ).toISOString().slice(0, 16);
    const result = parseActiveRegistration({
      ...base.value,
      draft: {
        ...(base.value.draft as Record<string, unknown>),
        occurrenceDateTime: localOccurrence,
        when: "few-days",
      },
    });
    expect(result).toMatchObject({
      ok: true,
      migrated: true,
      value: { draft: { occurrenceDateTime: localOccurrence, when: "just-now" } },
    });
  });

  it("clears hidden Craving other-text while preserving text with a visible controller", () => {
    const base = parseActiveRegistration(legacySession("craving", "/craving", "onset"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const baseDraft = base.value.draft as Record<string, unknown>;
    expect(parseActiveRegistration({
      ...base.value,
      draft: {
        ...baseDraft,
        onsetType: "Physical sensation",
        onsetOther: "hidden onset",
        situationPresets: ["Home alone"],
        triggerOther: "hidden situation",
      },
    })).toMatchObject({
      ok: true,
      value: { draft: { onsetOther: "", triggerOther: "" } },
    });
    expect(parseActiveRegistration({
      ...base.value,
      draft: {
        ...baseDraft,
        onsetType: "Other",
        onsetOther: "visible onset",
        situationPresets: ["Other"],
        triggerOther: "visible situation",
      },
    })).toMatchObject({
      ok: true,
      value: {
        draft: { onsetOther: "visible onset", triggerOther: "visible situation" },
      },
    });
  });

  it("clears hidden Trek other-text and outcome confidence on restore", () => {
    const base = parseActiveRegistration(legacySession("trek", "/trek", "planning"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    const baseDraft = base.value.draft as Record<string, unknown>;
    expect(parseActiveRegistration({
      ...base.value,
      draft: {
        ...baseDraft,
        location: "Home",
        locationOther: "hidden location",
        triggers: ["Stress"],
        triggerNote: "hidden trigger",
        needTypes: ["Relief"],
        needOther: "hidden need",
        actionAttempted: false,
        confidenceAfter: 8,
      },
    })).toMatchObject({
      ok: true,
      value: {
        draft: {
          locationOther: "",
          triggerNote: "",
          needOther: "",
          confidenceAfter: null,
        },
      },
    });
  });

  it("clears hidden and conversion-inapplicable Boredom answers on restore", () => {
    const base = parseActiveRegistration(legacySession("boredom", "/boredom", "situation"));
    if (!base.ok || !base.value) throw new Error("Expected migration to succeed");
    expect(parseActiveRegistration({
      ...base.value,
      draft: {
        ...(base.value.draft as Record<string, unknown>),
        convertCheck: "Maybe anxiety",
        situation: "Doing nothing",
        situationOther: "hidden situation",
        urge: "Gaming",
        urgeOther: "hidden urge",
        rescueMenu: ["Short walk"],
        action: "Delayed action",
        showNote: true,
        note: "hidden note",
      },
    })).toMatchObject({
      ok: true,
      value: {
        draft: {
          situationOther: "",
          urgeOther: "",
          rescueMenu: [],
          action: "",
          showNote: false,
          note: "",
        },
      },
    });
  });

  it("round-trips simultaneous Relapse concerns and rejects none combined with a concern", () => {
    const migrated = parseActiveRegistration(legacySession("relapse", "/relapse", "label"));
    if (!migrated.ok || !migrated.value) throw new Error("Expected migration to succeed");
    const baseDraft = migrated.value.draft as Record<string, unknown>;

    const valid = parseActiveRegistration({
      ...migrated.value,
      draft: {
        ...baseDraft,
        acuteRisks: ["unsafe", "withdrawal"],
        acuteRisk: "withdrawal",
      },
    });
    expect(valid).toMatchObject({
      ok: true,
      value: { draft: { acuteRisks: ["unsafe", "withdrawal"], acuteRisk: "withdrawal" } },
    });

    expect(parseActiveRegistration({
      ...migrated.value,
      draft: {
        ...baseDraft,
        acuteRisks: ["none", "unsafe"],
        acuteRisk: "unsafe",
      },
    })).toMatchObject({
      ok: false,
      error: "Active-registration draft has an invalid shape.",
    });
  });

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
