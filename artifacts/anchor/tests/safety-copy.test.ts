import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTranslation, type Language } from "../src/lib/translations";

const REVIEWED_KEYS = [
  "tools.subtitle",
  "tools.intro",
  "tools.breathing.desc",
  "tools.urge.desc",
  "tools.cold.desc",
  "tools.compassion.desc",
  "tools.distraction.desc",
  "craving.done.sub",
  "craving.help.breathing_sub",
  "delay.note",
  "urge.intro",
  "urge.footer",
  "urge.done.body",
  "cold.intro_body",
  "cold.intro_sub",
  "cold.note",
  "cold.done.body",
  "cold.step.1.tip",
  "cold.step.2.tip",
  "cold.step.3.tip",
  "dist.intro",
  "dist.done.body",
  "anxiety.msg.used_tool",
  "anxiety.msg.reached_out",
  "boredom.msg.delayed",
  "boredom.msg.replaced",
  "dist.act.0.sub",
  "dist.act.3.sub",
  "dist.act.7.sub",
  "cold.s0.tip",
  "cold.s1.tip",
  "cold.s2.tip",
  "cold.done_body",
  "compassion.s1.body",
  "compassion.s1.ref",
  "compassion.s2.ref",
  "compassion.s3.body",
  "compassion.s3.ref",
  "compassion.done_body",
  "crisis.emergency_text",
  "crisis.tool.breathing.desc",
  "crisis.tool.coldwater.desc",
  "crisis.tool.urge.desc",
  "crisis.tool.compassion.desc",
  "crisis.tool.distraction.desc",
  "delay.i5",
  "delay.i7",
  "delay.i8",
  "delay.i10",
  "delay.i11",
  "delay.hint",
  "dist.done_body",
  "urge.msg2",
  "urge.msg4",
  "urge.msg5",
  "urge.msg7",
  "urge.msg8",
  "urge.msg9",
  "urge.msg10",
  "urge.msg11",
  "urge.done_body",
  "breath.tip",
  "breath.milestone",
] as const;

const UNSUPPORTED_OR_ABSOLUTE =
  /\b(?:proven|bewezen|guaranteed?|gegarandeerd|safe right now|je bent nu veilig|will (?:pass|soften)|zal (?:voorbijgaan|verzachten)|goes away on its own|gaat vanzelf voorbij|works? in \d+|werkt in \d+|typically peaks?|usually peaks?|bereikt meestal|rapidly (?:reduces?|slows?)|vertraagt (?:je )?hartslag snel|the only thing that actually works|het enige dat .* werkt|no power over you|geen macht over jou|it always does|dat doet het altijd)\b/i;

describe("support-tool safety copy", () => {
  it.each(["en", "nl"] satisfies Language[])(
    "avoids unsupported effects and false assurances in %s",
    (language) => {
      for (const key of REVIEWED_KEYS) {
        const copy = getTranslation(language, key);
        expect(copy, `${language}:${key}`).not.toBe(key);
        expect(copy, `${language}:${key}`).not.toMatch(UNSUPPORTED_OR_ABSOLUTE);
      }
    },
  );

  it.each(["en", "nl"] satisfies Language[])(
    "routes immediate danger to 112 in %s",
    (language) => {
      for (const key of [
        "help.emergency",
        "relapse.crisis.body",
        "crisis.emergency_text",
        "delay.hint",
        "cold.note",
      ]) {
        expect(getTranslation(language, key), `${language}:${key}`).toContain("112");
      }
    },
  );

  it("keeps emergency and non-immediate suicide routes distinct", () => {
    expect(getTranslation("en", "crisis.emergency_text")).toContain("113 Suicide Prevention");
    expect(getTranslation("nl", "crisis.emergency_text")).toContain("113 Zelfmoordpreventie");
  });

  it("renders universal 112 and 113 call actions without relying on user configuration", () => {
    const crisisPage = readFileSync(resolve(__dirname, "../src/pages/CrisisNow.tsx"), "utf8");
    const toolsPage = readFileSync(resolve(__dirname, "../src/pages/Tools.tsx"), "utf8");
    expect(crisisPage).toContain('href="tel:112"');
    expect(crisisPage).toContain('href="tel:113"');
    expect(crisisPage).toContain('t("crisis.emergency_text")');
    expect(toolsPage).toContain('<Link href="/help"');
  });

  it("does not present the cold-water exercise as universally safe or as treatment", () => {
    expect(getTranslation("en", "cold.intro_sub")).toContain("may not suit everyone");
    expect(getTranslation("nl", "cold.intro_sub")).toContain("niet voor iedereen geschikt");
    expect(getTranslation("en", "cold.step.3.tip")).toContain("not a treatment");
    expect(getTranslation("nl", "cold.step.3.tip")).toContain("geen behandeling");
  });
});
