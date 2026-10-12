import { expect, test, type Page } from "@playwright/test";

async function storedRegistration(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction("settings").objectStore("settings").get("activeRegistration");
        request.onsuccess = () => resolve(request.result?.value ?? ""); request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}

test("a stale final save cannot replace a registration completed in another window", async ({ page, context }) => {
  await page.goto("settings");
  await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("craving");
  await page.getByRole("button", { name: "Other", exact: true }).first().click();
  await page.getByPlaceholder("Describe how it's coming on…", { exact: true }).fill("SYNTHETIC shared final-step draft");
  await expect.poll(() => storedRegistration(page)).toContain("SYNTHETIC shared final-step draft");
  // Resume the same valid final-step draft in both windows. Earlier answers are
  // irrelevant to this regression: the final button must enforce session CAS.
  const recordId = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const transaction = db.transaction("settings", "readwrite");
        const store = transaction.objectStore("settings");
        const request = store.get("activeRegistration");
        let id = "";
        request.onsuccess = () => {
          const active = JSON.parse(request.result.value);
          id = active.recordId;
          active.step = "outcome"; active.stepIndex = 6; active.draft.useOutcome = "not_used";
          store.put({ ...request.result, value: JSON.stringify(active) });
        };
        transaction.oncomplete = () => resolve(id); transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  const untouchedOutcome = page.getByRole("button", { name: "I did not use / act on it", exact: true });
  await expect(untouchedOutcome).toHaveAttribute("aria-pressed", "true");
  const newer = await context.newPage();
  await newer.goto("craving");
  await newer.getByRole("button", { name: "I'm not sure yet", exact: true }).click();
  await expect.poll(() => storedRegistration(newer)).toContain('"useOutcome":"unsure"');
  await newer.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => storedRegistration(newer)).toContain('"step":"done"');

  async function completedRecord() {
    return page.evaluate(async id => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("anchor-recovery");
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<any>((resolve, reject) => {
          const request = db.transaction("cravingLogs").objectStore("cravingLogs").get(id);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
      } finally { db.close(); }
    }, recordId);
  }
  const saved = await completedRecord();
  expect(saved.useOutcome).toBe("unsure");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reload saved version", exact: true })).toBeVisible();
  await expect(untouchedOutcome).toHaveAttribute("aria-pressed", "true");
  expect(await completedRecord()).toEqual(saved);
  await newer.close();
});

for (const protectOtherDraft of [false, true]) {
  test(`a stale registration retains local input without overwriting newer answers${protectOtherDraft ? " and reload protects other unsaved forms" : ""}`, async ({ page, context }) => {
    await page.goto("settings");
    await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.goto("craving");
    await page.getByRole("button", { name: "Other", exact: true }).first().click();
    const input = page.getByPlaceholder("Describe how it's coming on…", { exact: true });
    await input.fill("SYNTHETIC original answers");
    await expect.poll(() => storedRegistration(page)).toContain("SYNTHETIC original answers");

    const newer = await context.newPage();
    await newer.goto("craving");
    await expect(newer.getByPlaceholder("Describe how it's coming on…", { exact: true })).toHaveValue("SYNTHETIC original answers");
    await newer.getByPlaceholder("Describe how it's coming on…", { exact: true }).fill("SYNTHETIC newer saved answers");
    await expect.poll(() => storedRegistration(newer)).toContain("SYNTHETIC newer saved answers");
    const saved = await storedRegistration(newer);

    await input.fill("SYNTHETIC unsaved stale-window answers");
    const reload = page.getByRole("button", { name: "Reload saved version", exact: true });
    await expect(reload).toBeVisible();
    await expect(input).toHaveValue("SYNTHETIC unsaved stale-window answers");
    expect(await storedRegistration(page)).toBe(saved);
    await input.fill("SYNTHETIC another local correction");
    await expect(reload).toBeVisible();
    expect(await storedRegistration(page)).toBe(saved);

    if (protectOtherDraft) {
      await page.getByRole("link", { name: "More", exact: true }).click();
      await page.locator('a[href$="/recovery-plan"]').click();
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        (window as any).restoreSyntheticPut = () => { IDBObjectStore.prototype.put = original; };
        IDBObjectStore.prototype.put = function(value, ...args) {
          if (value?.key === "draft:recovery-plan") throw new DOMException("SYNTHETIC quota", "QuotaExceededError");
          return original.call(this, value, ...args);
        };
      });
      const warning = page.getByRole("textbox", { name: "My warning signs", exact: true });
      await warning.fill("SYNTHETIC another unsaved form must survive");
      await page.getByText(/The draft could not be saved/).waitFor();
      await reload.click();
      await expect(page.getByText(/The saved version could not be reloaded/)).toBeVisible();
      await expect(warning).toHaveValue("SYNTHETIC another unsaved form must survive");
      expect(await storedRegistration(page)).toBe(saved);
      await page.evaluate(() => (window as any).restoreSyntheticPut());
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await page.getByText("Draft saved locally. Not submitted yet.", { exact: true }).waitFor();
      await reload.click();
      await expect(reload).toHaveCount(0);
      await expect(warning).toHaveValue("SYNTHETIC another unsaved form must survive");
      await page.goto("craving");
    } else {
      await reload.click();
      await expect(reload).toHaveCount(0);
    }
    await expect(input).toHaveValue("SYNTHETIC newer saved answers");
    await expect.poll(() => storedRegistration(page)).toBe(saved);
    await newer.close();
  });
}
