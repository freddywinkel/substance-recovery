import { describe, expect, it } from "vitest";
import { parseSuspendedRegistrationStack } from "../src/contexts/ActiveRegistrationContext";
import { parseActiveRegistration } from "../src/contexts/activeRegistrationValidation";

function validSession(type: "craving" | "trek", route: string, step: string) {
  const migrated = parseActiveRegistration({
    version: 1,
    type,
    route,
    step,
    draft: {},
    updatedAt: 1_700_000_000_000,
  });
  if (!migrated.ok || !migrated.value) throw new Error("Expected valid fixture");
  return migrated.value;
}

describe("suspended registration stack", () => {
  it.each([undefined, null, ""])("treats %j as an empty stack", (raw) => {
    expect(parseSuspendedRegistrationStack(raw)).toEqual([]);
  });

  it("round-trips multiple validated drafts in LIFO order", () => {
    const craving = validSession("craving", "/craving", "onset");
    const trek = validSession("trek", "/trek", "planning");

    const parsed = parseSuspendedRegistrationStack(JSON.stringify([craving, trek]));
    expect(parsed.map(({ recordId }) => recordId)).toEqual([craving.recordId, trek.recordId]);
    expect(parsed.at(-1)?.type).toBe("trek");
  });

  it.each([
    ["invalid JSON", "{"],
    ["a non-array payload", "{}"],
    ["an invalid saved session", JSON.stringify([{ version: 99 }])],
  ])("rejects %s", (_label, raw) => {
    expect(() => parseSuspendedRegistrationStack(raw)).toThrow();
  });
});
