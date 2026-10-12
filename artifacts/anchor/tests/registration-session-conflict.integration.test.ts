import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("registration session compare-and-write", () => {
  it("rejects an older window's whole-draft write without changing the newer active draft", async () => {
    const { getRegistrationSessionState: read, setRegistrationSessionState: write } = await import("../src/db/registrationSessionSettings");
    await write("SYNTHETIC earlier", "[]");
    const stale = await read();
    await write("SYNTHETIC newer answers", "[]", stale);
    await expect(write("SYNTHETIC stale answers", "[]", stale)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect(await read()).toEqual({ activeRegistration: "SYNTHETIC newer answers", suspendedRegistrations: "[]" });
  });

  it("protects the suspended stack even when the active draft did not change", async () => {
    const { getRegistrationSessionState: read, setRegistrationSessionState: write } = await import("../src/db/registrationSessionSettings");
    const stale = await read();
    await write("", '["SYNTHETIC preserved draft"]', stale);
    await expect(write("SYNTHETIC next", "", stale)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect((await read()).suspendedRegistrations).toBe('["SYNTHETIC preserved draft"]');
  });

  it("allows only one of two concurrent first saves from the same empty snapshot", async () => {
    const { getRegistrationSessionState: read, setRegistrationSessionState: write } = await import("../src/db/registrationSessionSettings");
    const empty = await read();
    const outcomes = await Promise.allSettled([write("SYNTHETIC first", "", empty), write("SYNTHETIC second", "", empty)]);
    expect(outcomes.map(outcome => outcome.status)).toEqual(["fulfilled", "rejected"]);
    expect((await read()).activeRegistration).toBe("SYNTHETIC first");
  });

  it("prevents delayed startup normalization from overwriting an intervening save", async () => {
    const { getRegistrationSessionState: read, setRegistrationSessionState: write } = await import("../src/db/registrationSessionSettings");
    await write("SYNTHETIC legacy draft", "");
    const startup = await read();
    await write("SYNTHETIC newer draft", "", startup);
    await expect(write("SYNTHETIC normalized legacy draft", "", startup)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect((await read()).activeRegistration).toBe("SYNTHETIC newer draft");
  });

  it("lets the same window advance its successful snapshot and a reloaded window edit the latest data", async () => {
    const { getRegistrationSessionState: read, setRegistrationSessionState: write } = await import("../src/db/registrationSessionSettings");
    let expected = await read();
    for (const text of ["SYNTHETIC first", "SYNTHETIC second", "SYNTHETIC third"]) {
      await write(text, "", expected);
      expected = { activeRegistration: text, suspendedRegistrations: "" };
    }
    const reloaded = await read();
    await write("SYNTHETIC after reload", "", reloaded);
    expect((await read()).activeRegistration).toBe("SYNTHETIC after reload");
  });
});
