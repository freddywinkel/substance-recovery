import { describe, expect, it } from "vitest";
import { HOME_WIDGET_IDS, type HomeWidgetId } from "../src/lib/recoveryFeatures";
import { orderHomeWidgetIds } from "../src/pages/Home";

describe("Home widget DOM order", () => {
  it("keeps the saved order and appends every missing widget exactly once", () => {
    const savedOrder: HomeWidgetId[] = ["pinned-tools", "sobriety", "pinned-tools"];

    const result = orderHomeWidgetIds(savedOrder, false);

    expect(result.slice(0, 2)).toEqual(["pinned-tools", "sobriety"]);
    expect(result).toHaveLength(HOME_WIDGET_IDS.length);
    expect(new Set(result)).toEqual(new Set(HOME_WIDGET_IDS));
  });

  it("puts an urgent active follow-up first without changing the remaining order", () => {
    const savedOrder = [...HOME_WIDGET_IDS].reverse();

    const result = orderHomeWidgetIds(savedOrder, true);

    expect(result[0]).toBe("follow-ups");
    expect(result.slice(1)).toEqual(savedOrder.filter((id) => id !== "follow-ups"));
  });
});
