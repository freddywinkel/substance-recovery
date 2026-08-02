import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  validateBackupEnvelope,
  validateImportedStoreRecord,
  type ImportStoreKey,
} from "../src/db/validation";

function backup(overrides: Record<string, unknown> = {}) {
  return {
    version: BACKUP_FORMAT_VERSION,
    journal: [],
    cravingLogs: [],
    relapseLogs: [],
    anxietyLogs: [],
    boredomLogs: [],
    settings: [],
    ...overrides,
  };
}

function cravingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "craving-1",
    timestamp: 1_700_000_000_000,
    status: "completed",
    situationPresets: [],
    situationOther: "",
    intensity: 5,
    distressLevel: 4,
    riskLevel: "low",
    emotions: [],
    emotionOther: "",
    physicalSensations: [],
    thoughtPresets: [],
    thoughtFreeText: "",
    location: "",
    locationOther: "",
    socialContext: [],
    substances: [],
    primarySubstance: "",
    buildupDuration: "",
    chosenAction: "",
    chosenActionOther: "",
    toolUsed: null,
    confidenceBefore: 5,
    intensityAfter: null,
    confidenceAfter: null,
    cravingOutcome: null,
    interventionUsed: null,
    markAsPattern: false,
    highRiskFlag: false,
    note: "",
    ...overrides,
  };
}

function relapseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "relapse-1",
    timestamp: 1_700_000_000_000,
    status: "completed",
    label: "no-label",
    when: "today",
    episodeDuration: "unanswered",
    substances: [],
    primarySubstance: "",
    amountCategory: "unanswered",
    firstTriggerType: "",
    firstTriggerText: "",
    preUseFactors: [],
    missedWarnings: [],
    preUseThoughtPreset: "",
    preUseThoughtFreeText: "",
    couldHaveHelpedEarly: [],
    couldHaveHelpedMiddle: [],
    couldHaveHelpedLast: [],
    supportContact: "",
    supportContactOther: "",
    nextStep: "",
    nextStepOther: "",
    acuteRisk: "none",
    note: "",
    context: "",
    emotionAfter: null,
    ...overrides,
  };
}

function cravingV3Answers(registrationType: "craving" | "trek") {
  return registrationType === "craving"
    ? {
        registrationType: "craving",
        onsetType: "random-no-reason",
        onsetOther: null,
        intensity: 5,
        confidenceBefore: 5,
        situations: ["no-clear-situation-not-sure"],
        situationOther: null,
        physicalSensations: null,
        buildupDuration: "just-started",
        location: null,
        emotions: null,
        emotionOther: null,
        thoughts: null,
        thoughtOther: null,
        targets: null,
        chosenAction: "just-observed",
        actionAttempted: false,
        useOutcome: "unsure",
        cravingOutcome: null,
        intensityAfter: null,
      }
    : {
        registrationType: "trek",
        trekTypes: ["approach-not-sure"],
        intensity: 5,
        confidenceBefore: 5,
        planningStage: "immediacy-thoughts-only",
        location: null,
        locationOther: null,
        triggers: ["no-clear-trigger-not-sure"],
        triggerNote: null,
        emotions: null,
        emotionOther: null,
        physicalSensations: null,
        thoughts: null,
        thoughtFreeText: null,
        needs: ["not-sure"],
        needOther: null,
        targets: null,
        chosenAction: "just-observe",
        actionAttempted: false,
        confidenceAfter: null,
        useOutcome: "unsure",
      };
}

function anxietyV3Answers() {
  return {
    anxietyTypes: ["dread"],
    intensity: null,
    bodyLocations: ["whole-body"],
    bodyPrediction: null,
    urgencyHigh: false,
    context: null,
    triggers: null,
    reassuranceSeeking: null,
    linkedStates: null,
    reaction: "not-yet-just-logging",
    note: null,
    outcomeAfter: null,
  };
}

function boredomV3Answers() {
  return {
    restlessnessTypes: ["bored"],
    intensity: null,
    stimulationNeeds: ["not-sure"],
    convertCheck: "classification-not-sure",
    situation: "doing-nothing",
    situationOther: null,
    urge: null,
    urgeOther: null,
    rescueMenu: null,
    action: "not-yet-just-logging",
    delayDuration: null,
    note: null,
    outcomeAfter: null,
  };
}

function relapseV3Answers(overrides: Record<string, unknown> = {}) {
  return {
    acuteRisks: ["none"],
    label: null,
    when: "just-now",
    episodeDuration: null,
    substances: null,
    primarySubstance: null,
    amountCategory: null,
    firstTriggerType: null,
    firstTriggerText: null,
    preUseFactors: null,
    leadUpContext: null,
    missedWarnings: null,
    preUseThoughts: null,
    preUseThoughtFreeText: null,
    couldHaveHelped: null,
    couldHaveHelpedEarly: null,
    couldHaveHelpedMiddle: null,
    couldHaveHelpedLast: null,
    supportContact: "no-one-right-now",
    supportContactOther: null,
    nextStep: "water-food-rest-first",
    nextStepOther: null,
    note: null,
    emotionAfter: null,
    whatNeeded: null,
    repairActions: null,
    ...overrides,
  };
}

function relapseV3Record(overrides: Record<string, unknown> = {}) {
  const timestamp = 1_700_000_000_000;
  return relapseRecord({
    dataVersion: 3,
    contentVersion: "registration-v3",
    timestamp,
    occurredAt: timestamp,
    startedAt: timestamp,
    completedAt: timestamp,
    when: "just-now",
    preUseThoughtPreset: "",
    acuteRisks: ["none"],
    acuteRisk: "none",
    answers: relapseV3Answers(),
    ...overrides,
  });
}

function anxietyRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "anxiety-1",
    timestamp: 1_700_000_000_000,
    intensity: null,
    context: "",
    trigger: "",
    bodySensations: [],
    reaction: "",
    note: "",
    linkedState: "",
    ...overrides,
  };
}

function boredomRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "boredom-1",
    timestamp: 1_700_000_000_000,
    intensity: null,
    feelingTypes: [],
    situation: "",
    urge: "",
    action: "",
    delayDuration: null,
    note: "",
    stimulationNeed: "",
    ...overrides,
  };
}

describe("validateBackupEnvelope", () => {
  it("accepts the current backup envelope and optional cigarette store", () => {
    const value = backup({ cigaretteLogs: [] });
    expect(validateBackupEnvelope(value)).toEqual({ ok: true, value });
  });

  it.each([
    ["a primitive", null, "Backup must be an object."],
    ["an unsupported version", backup({ version: 99 }), "Unsupported backup version."],
    ["a missing required store", (() => {
      const value = backup();
      delete (value as Partial<typeof value>).journal;
      return value;
    })(), "journal must be an array."],
    ["a malformed optional cigarette store", backup({ cigaretteLogs: {} }), "cigaretteLogs must be an array when present."],
  ])("rejects %s", (_label, value, error) => {
    expect(validateBackupEnvelope(value)).toEqual({ ok: false, error });
  });
});

describe("validateImportedStoreRecord", () => {
  it("rejects a v3 Craving/Trek record missing its canonical classification", () => {
    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      answers: { intensity: 7 },
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Trek requires canonical answers.registrationType",
    });

    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      answers: { ...cravingV3Answers("trek"), intensity: 7 },
    }))).toMatchObject({ ok: true });
  });

  it("accepts complete writer-shaped v3 canonical answer envelopes for every registration flow", () => {
    const records = [
      ["cravingLogs", cravingRecord({
        dataVersion: 3,
        contentVersion: "registration-v3",
        cravingType: "passive",
        answers: cravingV3Answers("craving"),
      })],
      ["cravingLogs", cravingRecord({
        dataVersion: 3,
        contentVersion: "registration-v3",
        cravingType: "active",
        needType: "",
        answers: cravingV3Answers("trek"),
      })],
      ["anxietyLogs", anxietyRecord({
        dataVersion: 3,
        contentVersion: "registration-v3",
        answers: anxietyV3Answers(),
      })],
      ["boredomLogs", boredomRecord({
        dataVersion: 3,
        contentVersion: "registration-v3",
        answers: boredomV3Answers(),
      })],
      ["relapseLogs", relapseV3Record()],
    ] as const;

    for (const [store, record] of records) {
      expect(validateImportedStoreRecord(store, record), store).toMatchObject({ ok: true });
    }
  });

  it.each([
    ["Craving", "cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: (() => {
        const value = cravingV3Answers("craving");
        delete (value as Partial<typeof value>).thoughtOther;
        return value;
      })(),
    }), "thoughtOther"],
    ["Trek", "cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: (() => {
        const value = cravingV3Answers("trek");
        delete (value as Partial<typeof value>).needs;
        return value;
      })(),
    }), "needs"],
    ["Anxiety", "anxietyLogs", anxietyRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: (() => {
        const value = anxietyV3Answers();
        delete (value as Partial<typeof value>).urgencyHigh;
        return value;
      })(),
    }), "urgencyHigh"],
    ["Boredom", "boredomLogs", boredomRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: (() => {
        const value = boredomV3Answers();
        delete (value as Partial<typeof value>).delayDuration;
        return value;
      })(),
    }), "delayDuration"],
    ["Relapse", "relapseLogs", relapseV3Record({
      answers: (() => {
        const value = relapseV3Answers();
        delete (value as Partial<typeof value>).leadUpContext;
        return value;
      })(),
    }), "leadUpContext"],
  ] as const)("rejects an incomplete v3 %s canonical envelope", (flow, store, record, missingKey) => {
    expect(validateImportedStoreRecord(store as ImportStoreKey, record)).toEqual({
      ok: false,
      error: `dataVersion 3 ${flow} requires canonical answers.${missingKey}`,
    });
  });

  it.each([
    ["Craving", "cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), intensity: "7" },
    }), "intensity"],
    ["Trek", "cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: { ...cravingV3Answers("trek"), needs: [] },
    }), "needs"],
    ["Anxiety", "anxietyLogs", anxietyRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: { ...anxietyV3Answers(), urgencyHigh: null },
    }), "urgencyHigh"],
    ["Boredom", "boredomLogs", boredomRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: { ...boredomV3Answers(), delayDuration: "600" },
    }), "delayDuration"],
    ["Relapse", "relapseLogs", relapseV3Record({
      answers: relapseV3Answers({ emotionAfter: "7" }),
    }), "emotionAfter"],
  ] as const)("rejects a wrong-kind v3 %s canonical answer", (flow, store, record, key) => {
    expect(validateImportedStoreRecord(store as ImportStoreKey, record)).toEqual({
      ok: false,
      error: `dataVersion 3 ${flow} has an invalid canonical answers.${key}`,
    });
  });

  it.each([
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), physicalSensations: ["one", "two", "three", "four"] },
    }), "dataVersion 3 Craving answers.physicalSensations exceeds the maximum of 3 selections"],
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), emotions: ["one", "two", "three", "four"] },
    }), "dataVersion 3 Craving answers.emotions exceeds the maximum of 3 selections"],
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), thoughts: ["one", "two", "three"] },
    }), "dataVersion 3 Craving answers.thoughts exceeds the maximum of 2 selections"],
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: {
        ...cravingV3Answers("trek"),
        trekTypes: ["approach-mental-rehearsal", "approach-checking-availability", "approach-arranging-access"],
      },
    }), "dataVersion 3 Trek answers.trekTypes exceeds the maximum of 2 selections"],
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: { ...cravingV3Answers("trek"), emotions: ["one", "two", "three", "four"] },
    }), "dataVersion 3 Trek answers.emotions exceeds the maximum of 3 selections"],
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: { ...cravingV3Answers("trek"), physicalSensations: ["one", "two", "three", "four"] },
    }), "dataVersion 3 Trek answers.physicalSensations exceeds the maximum of 3 selections"],
    ["cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: { ...cravingV3Answers("trek"), thoughts: ["one", "two", "three"] },
    }), "dataVersion 3 Trek answers.thoughts exceeds the maximum of 2 selections"],
    ["anxietyLogs", anxietyRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: { ...anxietyV3Answers(), anxietyTypes: ["one", "two", "three"] },
    }), "dataVersion 3 Anxiety answers.anxietyTypes exceeds the maximum of 2 selections"],
    ["boredomLogs", boredomRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: { ...boredomV3Answers(), restlessnessTypes: ["one", "two", "three"] },
    }), "dataVersion 3 Boredom answers.restlessnessTypes exceeds the maximum of 2 selections"],
  ] as const)("rejects a v3 canonical selection above its field cap", (store, record, error) => {
    expect(validateImportedStoreRecord(store as ImportStoreKey, record)).toEqual({ ok: false, error });
  });

  it("allows the optional canonical note only when it has a valid text/null value", () => {
    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      note: "Edited note",
      answers: { ...cravingV3Answers("craving"), note: "Edited note" },
    }))).toMatchObject({ ok: true });
    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), note: "" },
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Craving has an invalid canonical answers.note",
    });
  });

  it.each([
    ["Craving", "cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), onsetType: "other", onsetOther: null },
    }), "dataVersion 3 Craving onsetOther conflicts with onsetType"],
    ["Trek", "cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "",
      answers: { ...cravingV3Answers("trek"), actionAttempted: false, confidenceAfter: 6 },
    }), "dataVersion 3 Trek confidenceAfter requires an attempted action"],
    ["Anxiety", "anxietyLogs", anxietyRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: {
        ...anxietyV3Answers(),
        bodyLocations: ["whole-body", "chest"],
      },
    }), "dataVersion 3 Anxiety cannot combine a neutral body answer with a specific answer"],
    ["Boredom", "boredomLogs", boredomRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: { ...boredomV3Answers(), convertCheck: "maybe-anxiety" },
    }), "dataVersion 3 Boredom conversion cannot retain skipped action answers"],
    ["Relapse", "relapseLogs", relapseV3Record({
      answers: relapseV3Answers({
        firstTriggerType: "internal-emotion",
        firstTriggerText: "I wrote a custom trigger too",
      }),
    }), "dataVersion 3 Relapse has conflicting canonical canned and custom answers"],
  ] as const)("rejects a contradictory v3 %s answer branch", (_flow, store, record, error) => {
    expect(validateImportedStoreRecord(store as ImportStoreKey, record)).toEqual({ ok: false, error });
  });

  it("rejects raw display copy where v3 requires a stable option ID", () => {
    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      answers: { ...cravingV3Answers("craving"), onsetType: "Random / no reason" },
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Craving has an invalid canonical answers.onsetType",
    });
  });

  it("accepts a valid record and backfills canonical registration metadata", () => {
    const result = validateImportedStoreRecord("cigaretteLogs", {
      id: "cigarette-1",
      timestamp: 1_700_000_000_000,
      note: "",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "cigarette-1",
        timestamp: 1_700_000_000_000,
        occurredAt: 1_700_000_000_000,
        startedAt: 1_700_000_000_000,
        completedAt: 1_700_000_000_000,
        dataVersion: 1,
      },
    });
  });

  it("accepts unanswered nullable fields declared by the craving schema", () => {
    const result = validateImportedStoreRecord(
      "cravingLogs",
      cravingRecord({ intensity: null, distressLevel: null, confidenceBefore: null }),
    );
    expect(result.ok).toBe(true);
  });

  it("normalizes the retired QuickLog distress sentinel to unanswered", () => {
    const legacy = cravingRecord({
      id: "legacy-quick-log",
      distressLevel: -1,
      cravingType: "passive",
    });

    const result = validateImportedStoreRecord("cravingLogs", legacy);

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "legacy-quick-log",
        distressLevel: null,
      },
    });
    expect(legacy.distressLevel).toBe(-1);
  });

  it("migrates a legacy singular Relapse concern without mutating or losing it", () => {
    const legacy = relapseRecord({
      acuteRisk: "withdrawal",
      answers: { acuteRisk: "withdrawal" },
    });

    const result = validateImportedStoreRecord("relapseLogs", legacy);

    expect(result).toMatchObject({
      ok: true,
      value: {
        acuteRisks: ["withdrawal"],
        acuteRisk: "withdrawal",
        answers: {
          acuteRisks: ["withdrawal"],
        },
      },
    });
    expect(legacy).not.toHaveProperty("acuteRisks");
    expect(legacy.answers).toEqual({ acuteRisk: "withdrawal" });
  });

  it("treats a singular legacy none as unanswered but preserves canonical none", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      acuteRisk: "none",
      answers: { acuteRisk: "none" },
    }))).toMatchObject({
      ok: true,
      value: {
        acuteRisks: [],
        acuteRisk: "unanswered",
        answers: { acuteRisks: null },
      },
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      dataVersion: 2,
      contentVersion: "registration-v2",
      acuteRisk: "none",
      answers: { acuteRisk: "none" },
    }))).toMatchObject({
      ok: true,
      value: {
        acuteRisks: ["none"],
        acuteRisk: "none",
        answers: { acuteRisks: ["none"] },
      },
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      acuteRisks: ["none"],
      acuteRisk: "unanswered",
      answers: { acuteRisks: ["none"], acuteRisk: "unsafe" },
    }))).toMatchObject({
      ok: true,
      value: {
        acuteRisks: ["none"],
        acuteRisk: "none",
        answers: { acuteRisks: ["none"] },
      },
    });
  });

  it("treats canonical safety-key presence as authoritative and rejects v3 singular-only shapes", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      dataVersion: 2,
      contentVersion: "registration-v2",
      acuteRisk: "unsafe",
      answers: { acuteRisks: null, acuteRisk: "unsafe" },
    }))).toMatchObject({
      ok: true,
      value: { acuteRisks: [], acuteRisk: "unanswered", answers: { acuteRisks: null } },
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      status: "draft",
      acuteRisks: [],
      acuteRisk: "unsafe",
      answers: relapseV3Answers({ acuteRisks: null }),
    }))).toMatchObject({
      ok: true,
      value: { acuteRisks: [], acuteRisk: "unanswered", answers: { acuteRisks: null } },
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      status: "completed",
      acuteRisks: [],
      acuteRisk: "unanswered",
      answers: relapseV3Answers({ acuteRisks: null }),
    }))).toEqual({
      ok: false,
      error: "completed dataVersion 3 Relapse requires an answered safety question",
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      acuteRisk: "unsafe",
      answers: { acuteRisk: "unsafe" },
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Relapse requires canonical acuteRisks fields",
    });
  });

  it("rejects conflicting pre-v3 singular safety aliases when no canonical key exists", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      dataVersion: 2,
      contentVersion: "registration-v2",
      acuteRisk: "unsafe",
      answers: { acuteRisk: "withdrawal" },
    }))).toEqual({
      ok: false,
      error: "acuteRisk conflicts with answers.acuteRisk",
    });
  });

  it("requires exactly one support contact and next step on completed v3 Relapse records", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      answers: relapseV3Answers({
        supportContact: null,
        supportContactOther: null,
      }),
    }))).toEqual({
      ok: false,
      error: "completed dataVersion 3 Relapse requires exactly one support-contact answer",
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      answers: relapseV3Answers({
        nextStep: null,
        nextStepOther: null,
      }),
    }))).toEqual({
      ok: false,
      error: "completed dataVersion 3 Relapse requires exactly one next-step answer",
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      status: "draft",
      answers: relapseV3Answers({
        supportContact: null,
        supportContactOther: null,
        nextStep: null,
        nextStepOther: null,
      }),
    }))).toMatchObject({ ok: true });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      answers: relapseV3Answers({
        supportContact: null,
        supportContactOther: "My neighbour",
        nextStep: null,
        nextStepOther: "Take a short walk",
      }),
    }))).toMatchObject({ ok: true });
  });

  it("marks only deployed-v2 default label/time answers unproven and preserves v3 explicit choices", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      dataVersion: 2,
      contentVersion: "registration-v2",
      label: "no-label",
      when: "just-now",
      acuteRisk: "none",
      answers: {
        acuteRisk: "none",
        label: "no-label",
        when: "just-now",
      },
    }))).toMatchObject({
      ok: true,
      value: {
        label: "no-label",
        when: "just-now",
        answers: { label: null, when: null, acuteRisks: ["none"] },
      },
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      label: "no-label",
      when: "just-now",
      occurredAt: 1_700_000_000_000,
      completedAt: 1_700_000_000_000,
      acuteRisks: ["none"],
      acuteRisk: "none",
      answers: relapseV3Answers({
        acuteRisks: ["none"],
        label: "no-label",
        when: "just-now",
      }),
    }))).toMatchObject({
      ok: true,
      value: {
        answers: { label: "no-label", when: "just-now", acuteRisks: ["none"] },
      },
    });
  });

  it("accepts simultaneous canonical Relapse concerns and derives only a compatibility alias", () => {
    const result = validateImportedStoreRecord("relapseLogs", relapseRecord({
      acuteRisks: ["unsafe", "fear-continued-use", "self-harm-risk"],
      acuteRisk: "unsafe",
      answers: {
        acuteRisks: ["unsafe", "fear-continued-use", "self-harm-risk"],
      },
    }));

    expect(result).toMatchObject({
      ok: true,
      value: {
        acuteRisks: ["unsafe", "fear-continued-use", "self-harm-risk"],
        acuteRisk: "self-harm-risk",
        answers: {
          acuteRisks: ["unsafe", "fear-continued-use", "self-harm-risk"],
        },
      },
    });
  });

  it.each([
    [["none", "unsafe"], "acuteRisks must contain unique valid values and 'none' must be exclusive"],
    [["unsafe", "unsafe"], "acuteRisks must contain unique valid values and 'none' must be exclusive"],
    [["unknown-risk"], "acuteRisks must contain unique valid values and 'none' must be exclusive"],
    ["unsafe", "acuteRisks must contain unique valid values and 'none' must be exclusive"],
  ])("rejects an invalid canonical Relapse safety array %j", (acuteRisks, error) => {
    expect(validateImportedStoreRecord(
      "relapseLogs",
      relapseRecord({ acuteRisks }),
    )).toEqual({ ok: false, error });
  });

  it("rejects contradictory canonical Relapse arrays but accepts a different selection order", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      acuteRisks: ["unsafe", "withdrawal"],
      answers: { acuteRisks: ["unsafe", "self-harm-risk"] },
    }))).toEqual({
      ok: false,
      error: "acuteRisks conflicts with answers.acuteRisks",
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      acuteRisks: ["unsafe", "withdrawal"],
      acuteRisk: { stale: true },
      answers: { acuteRisks: ["withdrawal", "unsafe"] },
    }))).toMatchObject({
      ok: true,
      value: {
        acuteRisks: ["withdrawal", "unsafe"],
        acuteRisk: "withdrawal",
        answers: { acuteRisks: ["withdrawal", "unsafe"] },
      },
    });
  });

  it("rejects an amount without a target and derives when from occurrence metadata", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      amountCategory: "moderate",
    }))).toEqual({
      ok: false,
      error: "amountCategory requires at least one substance or behavior target",
    });

    const completedAt = new Date(2026, 7, 2, 12, 0).getTime();
    const occurredAt = new Date(2026, 7, 1, 10, 0).getTime();
    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      timestamp: completedAt,
      occurredAt,
      completedAt,
      when: "few-days",
      primarySubstance: "Alcohol",
      amountCategory: "moderate",
    }))).toMatchObject({
      ok: true,
      value: {
        when: "yesterday",
        primarySubstance: "Alcohol",
        amountCategory: "moderate",
      },
    });

    expect(validateImportedStoreRecord("relapseLogs", relapseRecord({
      when: "yesterday",
    }))).toMatchObject({
      ok: true,
      value: { when: "yesterday", dataVersion: 1 },
    });
  });

  it("rejects hidden scalar meaning in current v3 compatibility fields", () => {
    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "passive",
      primarySubstance: "Alcohol",
      answers: cravingV3Answers("craving"),
    }))).toMatchObject({ ok: false, error: expect.stringContaining("primarySubstance") });

    expect(validateImportedStoreRecord("cravingLogs", cravingRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active",
      needType: "Relief",
      answers: cravingV3Answers("trek"),
    }))).toMatchObject({ ok: false, error: expect.stringContaining("needType") });

    expect(validateImportedStoreRecord("anxietyLogs", anxietyRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      trigger: "Feeling observed",
      answers: anxietyV3Answers(),
    }))).toMatchObject({ ok: false, error: expect.stringContaining("trigger") });

    expect(validateImportedStoreRecord("anxietyLogs", anxietyRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      linkedState: "After a conflict",
      answers: anxietyV3Answers(),
    }))).toMatchObject({ ok: false, error: expect.stringContaining("linkedState") });

    expect(validateImportedStoreRecord("boredomLogs", boredomRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      stimulationNeed: "movement",
      answers: boredomV3Answers(),
    }))).toMatchObject({ ok: false, error: expect.stringContaining("stimulationNeed") });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      primarySubstance: "Alcohol",
      amountCategory: "moderate",
      acuteRisks: ["none"],
      answers: relapseV3Answers({
        substances: null,
        amountCategory: "moderate",
      }),
    }))).toMatchObject({ ok: false, error: expect.stringContaining("primarySubstance") });

    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      preUseThoughtPreset: "One time won't matter",
    }))).toMatchObject({ ok: false, error: expect.stringContaining("preUseThoughtPreset") });
  });

  it("requires a canonical plural target for a current v3 Relapse amount", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      substances: ["Alcohol"],
      amountCategory: "moderate",
      acuteRisks: ["none"],
      answers: relapseV3Answers({
        substances: null,
        amountCategory: "moderate",
      }),
    }))).toEqual({
      ok: false,
      error: "canonical answers.amountCategory requires at least one canonical substance or behavior target",
    });
  });

  it("rejects the ambiguous legacy Relapse not-sure trigger ID in a v3 canonical envelope", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      answers: relapseV3Answers({ firstTriggerType: "not-sure" }),
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Relapse has an invalid canonical answers.firstTriggerType",
    });
  });

  it("rejects the ambiguous legacy Boredom not-sure classification ID in a v3 canonical envelope", () => {
    expect(validateImportedStoreRecord("boredomLogs", boredomRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers: { ...boredomV3Answers(), convertCheck: "not-sure" },
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Boredom has an invalid canonical answers.convertCheck",
    });
  });

  it("rejects a current Relapse when answer that conflicts with exact occurrence metadata", () => {
    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({
      occurredAt: 1_700_000_000_000,
      completedAt: 1_700_000_000_000,
      acuteRisks: ["none"],
      answers: relapseV3Answers({ when: "yesterday" }),
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Relapse canonical answers.when conflicts with occurrence metadata",
    });
  });

  it.each([
    [
      "missing exact timestamps",
      { occurredAt: undefined, completedAt: undefined },
      "dataVersion 3 Relapse requires exact occurredAt and completedAt metadata",
    ],
    [
      "an occurrence after completion",
      { occurredAt: 1_700_000_000_001, timestamp: 1_700_000_000_001 },
      "dataVersion 3 Relapse occurrence cannot be after completion",
    ],
    [
      "an index timestamp different from occurrence",
      { timestamp: 1_700_000_000_001 },
      "dataVersion 3 Relapse requires timestamp to equal occurredAt",
    ],
    [
      "only a stale top-level when",
      { when: "yesterday" },
      "dataVersion 3 Relapse canonical answers.when conflicts with occurrence metadata",
    ],
    [
      "top-level and canonical when values that agree with each other but not the timestamps",
      { when: "yesterday", answers: relapseV3Answers({ when: "yesterday" }) },
      "dataVersion 3 Relapse canonical answers.when conflicts with occurrence metadata",
    ],
  ] as const)("rejects v3 Relapse timing with %s", (_label, overrides, error) => {
    expect(validateImportedStoreRecord("relapseLogs", relapseV3Record({ ...overrides }))).toEqual({
      ok: false,
      error,
    });
  });

  it("accepts unanswered nullable fields declared by the anxiety and boredom schemas", () => {
    const anxiety = validateImportedStoreRecord("anxietyLogs", {
      id: "anxiety-1",
      timestamp: 1_700_000_000_000,
      intensity: null,
      context: "",
      trigger: "",
      bodySensations: [],
      reaction: "",
      note: "",
    });
    const boredom = validateImportedStoreRecord("boredomLogs", {
      id: "boredom-1",
      timestamp: 1_700_000_000_000,
      intensity: null,
      feelingTypes: [],
      situation: "",
      urge: "",
      action: "",
      delayDuration: null,
      note: "",
    });

    expect(anxiety.ok).toBe(true);
    expect(boredom.ok).toBe(true);
  });

  it.each([
    ["cravingLogs", cravingRecord({ intensity: 11 }), "intensity must be null or from 0 through 10"],
    ["cravingLogs", cravingRecord({ substances: ["alcohol", 3] }), "substances must be an array of strings"],
    ["cravingLogs", cravingRecord({ answers: { intensity: { nested: true } } }), "answers.intensity has an unsupported value"],
    ["cravingLogs", cravingRecord({ dataVersion: 4 }), "dataVersion is newer than this app supports"],
    ["relapseLogs", relapseRecord({ dataVersion: 3, contentVersion: "registration-v2" }), "dataVersion 3 requires contentVersion registration-v3"],
    ["cigaretteLogs", { id: "", timestamp: 0 }, "id must be a non-empty string"],
  ] as const)("rejects malformed %s records", (key, value, error) => {
    expect(validateImportedStoreRecord(key as ImportStoreKey, value)).toEqual({ ok: false, error });
  });
});
