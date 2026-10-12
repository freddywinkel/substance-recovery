import { describe, expect, it } from "vitest";
import { balanceCravingSeed, balanceMomentPath, balanceToolContext } from "../src/lib/balanceConnections";

describe("linked activity entry and return", () => {
  it("keeps unanswered craving separate from a real zero and does not relabel other intensity scales", () => {
    expect(balanceCravingSeed("craving", 0)).toBe(0);
    expect(balanceCravingSeed("craving", 10)).toBe(10);
    expect(balanceCravingSeed("craving", null)).toBeNull();
    expect(balanceCravingSeed("anxiety", 8)).toBeNull();
    expect(balanceCravingSeed("trek", 8)).toBeNull();
    expect(balanceCravingSeed("craving", 11)).toBeNull();
    expect(balanceCravingSeed("craving", 2.5)).toBeNull();
  });

  it("only consumes a linked moment on an existing app tool, including the pause timer", () => {
    expect(balanceToolContext("/tools/breathing", "balanceMoment=synthetic-id")).toEqual({ present: true, id: "synthetic-id" });
    expect(balanceToolContext("/delay", "?balanceMoment=synthetic-id")).toEqual({ present: true, id: "synthetic-id" });
    expect(balanceToolContext("/craving", "balanceMoment=synthetic-id")).toEqual({ present: false, id: null });
    expect(balanceToolContext("/tools/breathing", "")).toEqual({ present: false, id: null });
  });

  it("retains an invalid-link recovery state so an orphan cannot launch an unrelated legacy follow-up", () => {
    expect(balanceToolContext("/tools/grounding", "balanceMoment=")).toEqual({ present: true, id: null });
    expect(balanceToolContext("/tools/grounding", "balanceMoment=first&balanceMoment=second")).toEqual({ present: true, id: null });
    expect(balanceToolContext("/tools/grounding", `balanceMoment=${"x".repeat(201)}`)).toEqual({ present: true, id: null });
  });

  it("escapes the stored id as one route segment", () => {
    expect(balanceMomentPath("imported/id?next=elsewhere")).toBe("/daily/moments/imported%2Fid%3Fnext%3Delsewhere");
  });
});
