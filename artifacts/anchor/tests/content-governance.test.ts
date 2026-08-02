import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function sourceFiles(path: string): string[] {
  const absolute = resolve(process.cwd(), path);
  return readdirSync(absolute).flatMap((entry) => {
    const child = resolve(absolute, entry);
    if (statSync(child).isDirectory()) {
      return sourceFiles(child);
    }
    return /\.(ts|tsx)$/.test(entry) ? [child] : [];
  });
}

describe("qualified content-review governance", () => {
  const packet = source("docs/QUALIFIED_CONTENT_REVIEW_PACKET.md");

  it("keeps qualified human review explicitly pending until real sign-off", () => {
    expect(packet).toContain("Status: **PENDING QUALIFIED HUMAN REVIEW**");
    expect(packet).toContain("Clinical reviewer name | PENDING");
    expect(packet).toContain("Professional credential and registration number | PENDING");
    expect(packet).toContain("Dutch review competence, or separate Dutch reviewer | PENDING");
    expect(packet).toContain("Clinical reviewer signature: PENDING");
  });

  it.each([
    "https://www.who.int/publications/i/item/9789241599405",
    "https://www.nice.org.uk/guidance/cg51/chapter/Recommendations",
    "https://www.113.nl/english",
    "https://www.drugsinfo.nl/vraag/wat-zijn-ontwenningsverschijnselen/",
    "https://www.drugsinfo.nl/heroine/heroine-risicos-verminderen",
    "https://www.drugsinfo.nl/overige-middelen/wat-is-narcan-naloxone/",
  ])("records the review source %s", (url) => {
    expect(packet).toContain(url);
  });

  it("marks the historical intervention notes as unreviewed", () => {
    const interventions = source("docs/INTERVENTIONS.md");
    expect(interventions).toContain("UNREVIEWED REFERENCE — NOT APPROVED USER-FACING COPY");
    expect(interventions).toContain("QUALIFIED_CONTENT_REVIEW_PACKET.md");
  });

  it("does not claim clinical approval or validation in application source", () => {
    const applicationSource = sourceFiles("src")
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(applicationSource).not.toMatch(
      /\b(?:clinically|medically) (?:approved|validated)\b|\bvalidated clinical assessment\b/i,
    );
  });
});
