import { expect, test, type Page } from "@playwright/test";

async function storedRows(page: Page, store: "cigaretteLogs" | "settings") {
  return page.evaluate(async name => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, store);
}

async function startCigaretteEdit(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Log sigaret", exact: true }).click();
  await page.getByRole("button", { name: "1 Vandaag", exact: true }).click();
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toBeEnabled();
}

async function helpAndBack(page: Page) {
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toBeEnabled();
}

test("cigarette unfinished date and note survive direct Help, return, reload and explicit cancel", async ({ page }) => {
  await startCigaretteEdit(page);
  const original = (await storedRows(page, "cigaretteLogs"))[0];
  await page.getByLabel("Datum en tijd", { exact: true }).fill("");
  await page.getByLabel("Nog iets wat je wil noteren…", { exact: true }).fill("SYNTHETIC unfinished cigarette edit");
  await expect(page.getByRole("dialog").getByRole("link", { name: "Nu hulp", exact: true })).toBeVisible();
  await helpAndBack(page);
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC unfinished cigarette edit");
  await page.reload();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC unfinished cigarette edit");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByText("Vul een geldige datum en tijd in.", { exact: true })).toBeVisible();
  expect((await storedRows(page, "cigaretteLogs"))[0]).toEqual(original);
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveCount(0);
  expect((await storedRows(page, "cigaretteLogs"))[0]).toEqual(original);
  expect((await storedRows(page, "settings")).find(row => row.key === "draft:cigarette-edit")?.value).toBe("");
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "1 Vandaag", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("failed cigarette write keeps the draft through Help and successful retry updates only its original record", async ({ page }) => {
  await startCigaretteEdit(page);
  const original = (await storedRows(page, "cigaretteLogs"))[0];
  await page.getByLabel("Nog iets wat je wil noteren…", { exact: true }).fill("SYNTHETIC cigarette retry");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put; let failed = false;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "cigaretteLogs" && !failed) { failed = true; throw new DOMException("Synthetic failure", "QuotaExceededError"); }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /opslaan|opgeslagen|Opslaan/ }).first()).toBeVisible();
  expect((await storedRows(page, "cigaretteLogs"))[0]).toEqual(original);
  await helpAndBack(page);
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC cigarette retry");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveCount(0);
  const saved = await storedRows(page, "cigaretteLogs");
  expect(saved).toHaveLength(1); expect(saved[0].id).toBe(original.id); expect(saved[0].note).toBe("SYNTHETIC cigarette retry");
  expect((await storedRows(page, "settings")).find(row => row.key === "draft:cigarette-edit")?.value).toBe("");
  await page.reload(); await expect(page.getByRole("button", { name: "1 Vandaag", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("committed cigarette edit retains input and committed baseline when draft cleanup fails", async ({ page }) => {
  await startCigaretteEdit(page);
  await page.getByLabel("Nog iets wat je wil noteren…", { exact: true }).fill("SYNTHETIC committed cleanup retry");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put; let failed = false;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "settings" && args[0]?.key === "draft:cigarette-edit" && args[0]?.value === "" && !failed) { failed = true; throw new DOMException("Synthetic cleanup failure", "QuotaExceededError"); }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByText("De wijziging is opgeslagen; het concept kon niet worden gewist. Je invoer staat hier nog.", { exact: true })).toBeVisible();
  const committed = (await storedRows(page, "cigaretteLogs"))[0];
  const rebased = JSON.parse((await storedRows(page, "settings")).find(row => row.key === "draft:cigarette-edit").value).value;
  expect(rebased.sourceUpdatedAt).toBe(committed.updatedAt); expect(rebased.sourceNote).toBe(committed.note);
  await helpAndBack(page);
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC committed cleanup retry");
  await page.getByRole("button", { name: "Opnieuw proberen", exact: true }).click();
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveCount(0);
  const rows = await storedRows(page, "cigaretteLogs"); expect(rows).toHaveLength(1); expect(rows[0].id).toBe(committed.id);
});

test("an earlier-day cigarette edit resumes on Help return and reload with its original day", async ({ page }) => {
  await startCigaretteEdit(page);
  await page.getByLabel("Datum en tijd", { exact: true }).fill("2026-09-01T12:30");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await page.goto("registraties");
  await page.getByRole("button", { name: /Sigaretten · 1/ }).click();
  await page.getByRole("button", { name: "Beheer dag", exact: true }).click();
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page.getByLabel("Nog iets wat je wil noteren…", { exact: true }).fill("SYNTHETIC earlier-day edit");
  await helpAndBack(page);
  await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(/1 september/);
  await expect(page.getByLabel("Datum en tijd", { exact: true })).toHaveValue("2026-09-01T12:30");
  await page.reload();
  await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(/1 september/);
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC earlier-day edit");
});

test("a stale cigarette edit cannot overwrite a newer saved record even before the UI refreshes", async ({ page }) => {
  await startCigaretteEdit(page);
  await page.getByLabel("Nog iets wat je wil noteren…", { exact: true }).fill("SYNTHETIC stale local input");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("cigaretteLogs", "readwrite");
        const store = transaction.objectStore("cigaretteLogs");
        const read = store.getAll();
        read.onsuccess = () => store.put({ ...read.result[0], note: "SYNTHETIC newer external edit", updatedAt: Number(read.result[0].updatedAt ?? 0) + 1 });
        transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByText("Opslaan mislukt. Probeer het opnieuw.", { exact: true })).toBeVisible();
  expect((await storedRows(page, "cigaretteLogs"))[0].note).toBe("SYNTHETIC newer external edit");
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC stale local input");
  await page.reload();
  await expect(page.getByText("De opgeslagen registratie is gewijzigd of verwijderd. Je concept staat hier nog. Annuleer om de huidige registratie opnieuw te openen.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Nog iets wat je wil noteren…", { exact: true })).toHaveValue("SYNTHETIC stale local input");
});
