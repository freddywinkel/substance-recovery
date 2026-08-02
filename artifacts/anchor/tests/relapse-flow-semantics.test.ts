import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_REGISTRATION_VERSION,
  parseActiveRegistration,
} from "../src/contexts/activeRegistrationValidation";
import {
  RELAPSE_OPTIONAL_STEPS,
  buildRelapseAnswers,
  createBlankRelapseDraft,
  enterFirstTriggerText,
  enterExclusiveOther,
  generalHelpSelections,
  hasNoClearTrigger,
  isValidRelapseOccurrence,
  mergeRelapseFollowUpAnswers,
  navigateAfterRelapseReturnSaved,
  occurrenceForWhen,
  persistedFirstTriggerText,
  relapseSafetyRoutes,
  selectFirstTrigger,
  selectExclusiveChoice,
  toggleHelpPhaseSelection,
  toggleNoClearTrigger,
  toggleRelapseAcuteRisk,
  whenForOccurrence,
} from "../src/pages/RelapseLog";
import { getOptionTranslation, getTranslation } from "../src/lib/translations";
import { explicitSafetyAnswer } from "../src/lib/canonicalRegistration";
import type { RelapseLog as RelapseLogRecord } from "../src/db/schema";

describe("Relapse occurrence semantics", () => {
  it("does not prefill an event time on a blank registration", () => {
    const draft = createBlankRelapseDraft();

    expect(draft.occurrenceDateTime).toBe("");
    expect(draft.when).toBe("");
    expect(draft.label).toBe("");
    expect(isValidRelapseOccurrence(draft.occurrenceDateTime)).toBe(false);
  });

  it("accepts the genuinely blank form as a resumable active registration", () => {
    const now = new Date(2026, 7, 2, 12, 0).getTime();
    const parsed = parseActiveRegistration({
      version: ACTIVE_REGISTRATION_VERSION,
      type: "relapse",
      route: "/relapse",
      step: "label",
      draft: createBlankRelapseDraft(),
      recordId: "relapse-test-record",
      startedAt: now,
      updatedAt: now,
      stepIndex: 1,
      stepCount: 5,
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.value?.draft).toMatchObject({ label: "", when: "" });
  });

  it("keeps quick choices, exact time, and the broad compatibility bucket aligned", () => {
    const now = new Date(2026, 7, 2, 12, 0);
    const quickYesterday = occurrenceForWhen("yesterday", now);

    expect(whenForOccurrence(quickYesterday, now)).toBe("yesterday");
    expect(whenForOccurrence("2026-08-02T11:30", now)).toBe("just-now");
    expect(whenForOccurrence("2026-08-02T08:00", now)).toBe("today");
    expect(whenForOccurrence("2026-07-12T08:00", now)).toBe("few-days");
  });

  it("builds the saved when answer from exact occurrence rather than a stale bucket", () => {
    const reference = new Date(2026, 7, 2, 12, 0);
    const draft = {
      ...createBlankRelapseDraft(),
      occurrenceDateTime: "2026-08-01T10:00",
      when: "just-now",
    };
    expect(buildRelapseAnswers(draft, reference).when).toBe("yesterday");
  });

  it("rejects empty, invalid, pre-epoch, and future event times", () => {
    const now = new Date(2026, 7, 2, 12, 0).getTime();

    expect(isValidRelapseOccurrence("", now)).toBe(false);
    expect(isValidRelapseOccurrence("not-a-date", now)).toBe(false);
    expect(isValidRelapseOccurrence("1960-01-01T12:00", now)).toBe(false);
    expect(isValidRelapseOccurrence("2026-08-02T12:02", now)).toBe(false);
    expect(isValidRelapseOccurrence("2026-08-02T11:59", now)).toBe(true);
  });
});

describe("Relapse optional and unknown answers", () => {
  it("makes trigger and lead-up genuinely skippable", () => {
    expect(RELAPSE_OPTIONAL_STEPS).toEqual(["trigger", "before"]);
  });

  it("records an explicit no-clear-trigger answer without inventing free text", () => {
    const draft = toggleNoClearTrigger(createBlankRelapseDraft());
    const now = new Date(2026, 7, 2, 12, 0).getTime();

    expect(hasNoClearTrigger(draft)).toBe(true);
    expect(persistedFirstTriggerText(draft)).toBe("");
    expect(buildRelapseAnswers(draft)).toMatchObject({
      firstTriggerType: "no-clear-trigger-not-sure",
      firstTriggerText: null,
    });
    expect(parseActiveRegistration({
      version: ACTIVE_REGISTRATION_VERSION,
      type: "relapse",
      route: "/relapse",
      step: "trigger",
      draft,
      recordId: "relapse-not-sure-record",
      startedAt: now,
      updatedAt: now,
      stepIndex: 3,
      stepCount: 5,
    }).ok).toBe(true);
  });

  it("keeps canned and free-text first-trigger answers mutually exclusive in both directions", () => {
    const custom = enterFirstTriggerText(createBlankRelapseDraft(), "An unexpected message");
    const canned = selectFirstTrigger(custom, "External event");
    const customAgain = enterFirstTriggerText(canned, "A difficult phone call");

    expect(custom).toMatchObject({
      firstTriggerType: "",
      firstTriggerText: "An unexpected message",
    });
    expect(canned).toMatchObject({
      firstTriggerType: "External event",
      firstTriggerText: "",
    });
    expect(customAgain).toMatchObject({
      firstTriggerType: "",
      firstTriggerText: "A difficult phone call",
    });
  });

  it("uses null rather than empty strings or unanswered sentinels in canonical answers", () => {
    const draft = {
      ...createBlankRelapseDraft(),
      occurrenceDateTime: "2026-08-02T10:00",
    };
    const answers = buildRelapseAnswers(draft);

    expect(answers).toMatchObject({
      label: null,
      acuteRisks: null,
      episodeDuration: null,
      substances: null,
      primarySubstance: null,
      amountCategory: null,
      firstTriggerType: null,
      firstTriggerText: null,
      preUseFactors: null,
      missedWarnings: null,
      preUseThoughts: null,
      supportContact: null,
      supportContactOther: null,
      whatNeeded: null,
      repairActions: null,
    });
  });

  it("does not write an amount answer without a substance or behavior target", () => {
    const orphanedAmount = {
      ...createBlankRelapseDraft(),
      amountCategory: "moderate" as const,
    };
    expect(buildRelapseAnswers(orphanedAmount).amountCategory).toBeNull();
    expect(buildRelapseAnswers({
      ...orphanedAmount,
      substances: ["Alcohol"],
    }).amountCategory).toBe("moderate");
  });
});

describe("Relapse multi-concern safety semantics", () => {
  it("keeps unanswered distinct and makes none exclusive", () => {
    const blank = createBlankRelapseDraft();
    const unsafe = toggleRelapseAcuteRisk(blank, "unsafe");
    const multiple = toggleRelapseAcuteRisk(unsafe, "withdrawal");
    const none = toggleRelapseAcuteRisk(multiple, "none");
    const concernAfterNone = toggleRelapseAcuteRisk(none, "fear-continued-use");

    expect(blank).toMatchObject({ acuteRisks: [], acuteRisk: "unanswered" });
    expect(multiple).toMatchObject({
      acuteRisks: ["unsafe", "withdrawal"],
      acuteRisk: "withdrawal",
    });
    expect(none).toMatchObject({ acuteRisks: ["none"], acuteRisk: "none" });
    expect(concernAfterNone).toMatchObject({
      acuteRisks: ["fear-continued-use"],
      acuteRisk: "fear-continued-use",
    });
  });

  it("writes every selected concern to the canonical answer array", () => {
    const draft = toggleRelapseAcuteRisk(
      toggleRelapseAcuteRisk(createBlankRelapseDraft(), "unsafe"),
      "self-harm-risk",
    );
    const answers = buildRelapseAnswers(draft);

    expect(answers.acuteRisks).toEqual(["unsafe", "self-harm-risk"]);
    expect(answers).not.toHaveProperty("acuteRisk");
  });

  it("activates every urgent route represented by simultaneous concerns", () => {
    expect(relapseSafetyRoutes([
      "unsafe",
      "fear-continued-use",
      "withdrawal",
      "self-harm-risk",
    ])).toEqual({
      urgent: true,
      unsafe: true,
      continuedUse: true,
      withdrawal: true,
      selfHarm: true,
    });
    expect(relapseSafetyRoutes(["none"])).toMatchObject({ urgent: false });
  });

  it("preserves every canonical concern for downstream safety consumers", () => {
    const record = {
      dataVersion: 2,
      answers: {
        acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
      },
      acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
      acuteRisk: "self-harm-risk",
    } as unknown as RelapseLogRecord;

    expect(explicitSafetyAnswer("relapse", record)).toEqual({
      answered: true,
      needsAttention: true,
      reasons: ["relapse-unsafe", "relapse-withdrawal", "relapse-self-harm"],
      reason: "relapse-unsafe",
    });
  });

  it("falls back to an older singular safety answer only when the canonical array is absent", () => {
    const record = {
      dataVersion: 2,
      answers: { acuteRisk: "withdrawal" },
      acuteRisk: "withdrawal",
    } as unknown as RelapseLogRecord;

    expect(explicitSafetyAnswer("relapse", record)).toEqual({
      answered: true,
      needsAttention: true,
      reasons: ["relapse-withdrawal"],
      reason: "relapse-withdrawal",
    });
  });
});

describe("Relapse copy wiring", () => {
  it("uses the translated optional need prompt on the done screen", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/pages/RelapseLog.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('{t("relapse.q.needs")}');
    expect(pageSource).toContain('{t("relapse.q.needs_sub")}');
    expect(pageSource).not.toContain("What did you need in that moment?");
    expect(getTranslation("en", "relapse.q.needs")).toBe("What might you have needed in that moment?");
    expect(getTranslation("nl", "relapse.q.needs")).toBe("Wat had je op dat moment misschien nodig?");
  });

  it("renders the bilingual optional emotion-after question on the done screen", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/pages/RelapseLog.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('{t("relapse.q.emotion_after")}');
    expect(pageSource).toContain("emotionAfter: selected ? null : value");
    expect(getTranslation("en", "relapse.q.emotion_after")).toBe(
      "How much emotional distress do you feel now?",
    );
    expect(getTranslation("nl", "relapse.q.emotion_after")).toBe(
      "Hoeveel emotionele spanning voel je nu?",
    );
    expect(getTranslation("en", "logs.detail.emotion_after")).toBe(
      "Emotional distress afterward",
    );
    expect(getTranslation("nl", "logs.detail.emotion_after")).toBe(
      "Emotionele spanning achteraf",
    );
  });

  it("describes optional stabilizing actions as an invitation in both languages", () => {
    expect(getTranslation("en", "relapse.done.stabilize")).toBe(
      "If helpful, choose a stabilizing action:",
    );
    expect(getTranslation("nl", "relapse.done.stabilize")).toBe(
      "Kies eventueel een stabiliserende actie:",
    );
  });

  it("includes substance use and behaviour in the continued-risk option", () => {
    expect(getOptionTranslation("en", "fear-continued-use")).toBe(
      "I am afraid I may continue using or act on a behaviour",
    );
    expect(getOptionTranslation("nl", "fear-continued-use")).toBe(
      "Ik ben bang dat ik doorga met gebruiken of het gedrag uitvoer",
    );
  });

  it("makes the multi-select and none-exclusivity instruction explicit in both languages", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/pages/RelapseLog.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("toggleRelapseAcuteRisk(previous, value)");
    expect(pageSource).toContain("draft.acuteRisks.includes(value)");
    expect(getTranslation("en", "relapse.q.risk_sub")).toContain("Select every concern");
    expect(getTranslation("en", "relapse.q.risk_sub")).toContain("clears the other choices");
    expect(getTranslation("nl", "relapse.q.risk_sub")).toContain("Selecteer alle zorgen");
    expect(getTranslation("nl", "relapse.q.risk_sub")).toContain("wist de andere keuzes");
  });
});

describe("Relapse saved meaning", () => {
  it("keeps early, middle, and last-chance help answers independent", () => {
    const blank = createBlankRelapseDraft();
    const early = toggleHelpPhaseSelection(blank, "couldHaveHelpedEarly", "Text or call someone");
    const middle = toggleHelpPhaseSelection(early, "couldHaveHelpedMiddle", "Leave the trigger place");

    expect(middle.couldHaveHelpedEarly).toEqual(["Text or call someone"]);
    expect(middle.couldHaveHelpedMiddle).toEqual(["Leave the trigger place"]);
    expect(middle.couldHaveHelpedLast).toEqual([]);
    expect(generalHelpSelections(middle)).toEqual([
      "Text or call someone",
      "Leave the trigger place",
    ]);

    const answers = buildRelapseAnswers(middle);
    expect(answers.couldHaveHelpedEarly).toEqual(["text-or-call-someone"]);
    expect(answers.couldHaveHelpedMiddle).toEqual(["leave-the-trigger-place"]);
    expect(answers.couldHaveHelpedLast).toBeNull();
  });

  it("prevents canned and custom support or next-step answers from contradicting each other", () => {
    expect(selectExclusiveChoice("", "No one right now")).toEqual({
      selected: "No one right now",
      other: "",
    });
    expect(enterExclusiveOther("My neighbour")).toEqual({
      selected: "",
      other: "My neighbour",
    });
  });

  it("keeps every post-save follow-up synchronized with its canonical answer", () => {
    const merged = mergeRelapseFollowUpAnswers(
      { acuteRisk: "none", whatNeeded: null, repairActions: null, emotionAfter: null },
      {
        whatNeeded: "connection",
        repairActions: ["Tell someone safe"],
        emotionAfter: 0,
      },
    );

    expect(merged).toEqual({
      acuteRisk: "none",
      whatNeeded: "connection",
      repairActions: ["tell-someone-safe"],
      emotionAfter: 0,
    });
  });

  it("does not navigate to support until the pending return path is durably saved", async () => {
    const navigations: string[] = [];
    expect(await navigateAfterRelapseReturnSaved(
      async () => false,
      () => navigations.push("tools"),
    )).toBe(false);
    expect(await navigateAfterRelapseReturnSaved(
      async () => { throw new Error("storage failed"); },
      () => navigations.push("tools"),
    )).toBe(false);
    expect(navigations).toEqual([]);

    expect(await navigateAfterRelapseReturnSaved(
      async () => true,
      () => navigations.push("tools"),
    )).toBe(true);
    expect(navigations).toEqual(["tools"]);
  });
});
