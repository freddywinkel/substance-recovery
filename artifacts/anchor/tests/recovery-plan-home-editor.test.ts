import { describe, expect, it } from "vitest";
import { moveHomeItem } from "@/pages/HomeCustomization";
import { normalizePlanLines } from "@/pages/RecoveryPlan";

describe("recovery plan line normalization", () => {
  it("trims blank lines and keeps the user's order", () => {
    expect(normalizePlanLines("  Call Sam  \n\nEat breakfast\r\n  Walk outside ")).toEqual([
      "Call Sam",
      "Eat breakfast",
      "Walk outside",
    ]);
  });

  it("does not silently truncate user-authored lines", () => {
    const long = "a".repeat(520);
    const lines = Array.from({ length: 30 }, (_, index) => `${long}${index}`).join("\n");
    const normalized = normalizePlanLines(lines);
    expect(normalized).toHaveLength(30);
    expect(normalized[0]).toBe(`${long}0`);
    expect(normalized[29]).toBe(`${long}29`);
  });
});

describe("Home widget ordering", () => {
  it("moves one item without mutating the source order", () => {
    const source = ["sobriety", "quick-registration", "cigarettes"];
    expect(moveHomeItem(source, 1, -1)).toEqual(["quick-registration", "sobriety", "cigarettes"]);
    expect(source).toEqual(["sobriety", "quick-registration", "cigarettes"]);
  });

  it("ignores moves beyond either edge", () => {
    const source = ["sobriety", "cigarettes"];
    expect(moveHomeItem(source, 0, -1)).toBe(source);
    expect(moveHomeItem(source, 1, 1)).toBe(source);
  });
});
