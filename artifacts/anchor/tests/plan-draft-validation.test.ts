import { describe, expect, it } from "vitest";
import { isRecoveryPlanDraft, type RecoveryPlanDraft } from "../src/lib/planDraft";
import { emptyPreventionPlan } from "../src/lib/preventionPlan";

const draft = (): RecoveryPlanDraft => ({ warningSigns: "", reasons: "", situations: "", message: "", next24Hours: "", trustedContactIds: [], pinnedContactId: null, pinnedToolIds: [], prevention: emptyPreventionPlan(), baseUpdatedAt: null });

describe("recovery plan draft validation shared by form and backup", () => {
  it("accepts incomplete forms, field boundaries and the saved base timestamp without defaulting answers", () => {
    expect(isRecoveryPlanDraft(draft())).toBe(true);
    expect(isRecoveryPlanDraft({ ...draft(), warningSigns: "a".repeat(12000), message: "b".repeat(1000), trustedContactIds: Array.from({ length: 50 }, (_, i) => `helper-${i}`), pinnedToolIds: ["/tools/breathing", "/tools/grounding"], baseUpdatedAt: 1780000000000 })).toBe(true);
  });
  it.each([
    { warningSigns: "x".repeat(12001) }, { reasons: 1 }, { situations: [] }, { next24Hours: null }, { message: "x".repeat(1001) },
    { trustedContactIds: ["duplicate", "duplicate"] }, { trustedContactIds: [""] }, { trustedContactIds: Array.from({ length: 51 }, (_, i) => `${i}`) },
    { pinnedContactId: "x".repeat(201) }, { pinnedToolIds: ["/tools/nonexistent"] }, { pinnedToolIds: ["/tools/breathing", "/tools/breathing"] },
    { pinnedToolIds: ["/tools/breathing", "/tools/grounding", "/tools/tape"] },
    { baseUpdatedAt: NaN }, { baseUpdatedAt: Infinity }, { baseUpdatedAt: -1 }, { baseUpdatedAt: 1.5 }, { baseUpdatedAt: 8_640_000_000_000_001 },
    { prevention: { version: 99 } }, { unexpectedFutureField: "unsupported" },
  ])("rejects unsafe or unsupported draft data without normalizing it: %j", patch => {
    const value = { ...draft(), ...patch };
    expect(isRecoveryPlanDraft(value)).toBe(false);
    expect(value).toMatchObject(patch);
  });
});
