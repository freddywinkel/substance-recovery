import { describe, expect, it } from "vitest";
import { isRangeInteractionKey } from "../src/components/tracker/IntensitySlider";

describe("unanswered range keyboard guard", () => {
  it.each(["Tab", "Shift", "Escape", "Enter", " ", "a"])(
    "does not turn %s into a midpoint answer",
    (key) => {
      expect(isRangeInteractionKey(key)).toBe(false);
    },
  );

  it.each([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ])("recognizes intentional range key %s", (key) => {
    expect(isRangeInteractionKey(key)).toBe(true);
  });
});
