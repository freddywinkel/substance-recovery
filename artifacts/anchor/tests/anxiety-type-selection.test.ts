import { describe, expect, it } from "vitest";
import { getTranslation } from "../src/lib/translations";
import { toggleAnxietyTypeSelection } from "../src/pages/AnxietyTracker";
import { readSource } from "./helpers/sourceContracts";

describe("Anxiety type UI selection cap", () => {
  it("blocks a third choice while preserving deselect and replacement interactions", () => {
    let selected: string[] = [];
    selected = toggleAnxietyTypeSelection(selected, "Panic spike");
    selected = toggleAnxietyTypeSelection(selected, "Health anxiety");

    expect(selected).toEqual(["Panic spike", "Health anxiety"]);
    expect(toggleAnxietyTypeSelection(selected, "Dread")).toEqual(selected);

    selected = toggleAnxietyTypeSelection(selected, "Health anxiety");
    expect(selected).toEqual(["Panic spike"]);

    selected = toggleAnxietyTypeSelection(selected, "Dread");
    expect(selected).toEqual(["Panic spike", "Dread"]);
    expect(toggleAnxietyTypeSelection(selected, "Panic spike")).toEqual(["Dread"]);
  });

  it("wires the capped toggle into the grid and states the limit in both languages", () => {
    const source = readSource("src/pages/AnxietyTracker.tsx");

    expect(source).toContain("toggleAnxietyTypeSelection(previous, value)");
    expect(source).toContain("maxSelections={ANXIETY_TYPE_MAX_SELECTIONS}");
    expect(getTranslation("en", "anxiety.q.type_sub"))
      .toBe("Choose one or two descriptions that fit best.");
    expect(getTranslation("nl", "anxiety.q.type_sub"))
      .toBe("Kies er een of twee die het beste passen.");
  });
});
