import { test, expect, type Page } from "@playwright/test";

async function rows(page: Page, store: "featureRecords" | "settings") {
  return page.evaluate(async storeName => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, store);
}

async function startCorrection(page: Page) {
  await page.goto("quick");
  await page.getByRole("button", { name: "Trek of drang", exact: true }).click();
  await page.getByRole("button", { name: "Voor nu veilig", exact: true }).click();
  await page.getByRole("button", { name: "10 minuten pauzeren", exact: true }).click();
  await page.getByRole("button", { name: "Snelle registratie opslaan", exact: true }).click();
  await expect(page.getByText("Snelle registratie opgeslagen", { exact: true })).toBeVisible();
  await page.goto("registraties");
  await page.locator("article").first().getByRole("button").first().click();
  await page.getByRole("button", { name: "Antwoorden en gebeurtenistijd corrigeren", exact: true }).click();
  await expect(page.getByLabel("Notitie bij snelle registratie", { exact: true })).toBeEditable();
}

async function helpAndBack(page: Page) {
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Concept van correctie", exact: true })).toBeVisible();
}

test("history correction retains unfinished time, explicit zero and note across Help and reload before saving", async ({ page }) => {
  await startCorrection(page);
  const original = (await rows(page, "featureRecords"))[0];
  const time = page.getByLabel("Wanneer gebeurde het?", { exact: true });
  const originalTime = await time.inputValue();
  await time.fill("");
  await page.getByLabel("Intensiteit (leeg = niet vastgelegd)", { exact: true }).fill("0");
  await page.getByLabel("Notitie bij snelle registratie", { exact: true }).fill("SYNTHETIC unfinished correction");
  await helpAndBack(page);
  await page.reload();
  await expect(time).toHaveValue("");
  await expect(page.getByLabel("Intensiteit (leeg = niet vastgelegd)", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Notitie bij snelle registratie", { exact: true })).toHaveValue("SYNTHETIC unfinished correction");
  expect((await rows(page, "featureRecords"))[0]).toEqual(original);
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByText("Kies een geldige gebeurtenistijd in het verleden.", { exact: true })).toBeVisible();
  await time.fill(originalTime);
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Concept van correctie", exact: true })).toHaveCount(0);
  await page.reload();
  const saved = await rows(page, "featureRecords");
  expect(saved).toHaveLength(1); expect(saved[0].id).toBe(original.id); expect(saved[0].intensity).toBe(0); expect(saved[0].note).toBe("SYNTHETIC unfinished correction");
});

test("explicitly discarding a correction removes only its draft and keeps the original entry", async ({ page }) => {
  await startCorrection(page);
  const original = (await rows(page, "featureRecords"))[0];
  await page.getByLabel("Notitie bij snelle registratie", { exact: true }).fill("SYNTHETIC discard me");
  await page.getByRole("button", { name: "Concept verwerpen", exact: true }).click();
  await expect(page.getByRole("region", { name: "Concept van correctie", exact: true })).toHaveCount(0);
  await page.reload();
  expect((await rows(page, "featureRecords"))[0]).toEqual(original);
  await expect(page.getByRole("region", { name: "Concept van correctie", exact: true })).toHaveCount(0);
});

test("failed correction write retains input through Help and retry updates the same entry", async ({ page }) => {
  await startCorrection(page);
  const original = (await rows(page, "featureRecords"))[0];
  await page.getByLabel("Notitie bij snelle registratie", { exact: true }).fill("SYNTHETIC retry correction");
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put; let failed = false;
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (this.name === "featureRecords" && !failed) { failed = true; throw new DOMException("Synthetic write failure", "QuotaExceededError"); }
      return originalPut.call(this, value, ...args);
    };
  });
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByText(/Opslaan lukte niet\. Controleer verplichte antwoorden/)).toBeVisible();
  expect((await rows(page, "featureRecords"))[0]).toEqual(original);
  await helpAndBack(page);
  await expect(page.getByLabel("Notitie bij snelle registratie", { exact: true })).toHaveValue("SYNTHETIC retry correction");
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Concept van correctie", exact: true })).toHaveCount(0);
  const saved = await rows(page, "featureRecords"); expect(saved).toHaveLength(1); expect(saved[0].id).toBe(original.id); expect(saved[0].note).toBe("SYNTHETIC retry correction");
});

test("committed correction rebases its retained draft before a cleanup failure and can retry", async ({ page }) => {
  await startCorrection(page);
  await page.getByLabel("Notitie bij snelle registratie", { exact: true }).fill("SYNTHETIC committed correction");
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put; let failed = false;
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (this.name === "settings" && value?.key === "draft:registration-correction" && value?.value === "" && !failed) { failed = true; throw new DOMException("Synthetic cleanup failure", "QuotaExceededError"); }
      return originalPut.call(this, value, ...args);
    };
  });
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByText(/De correctie is opgeslagen; het concept kon nog niet worden gewist/)).toBeVisible();
  const committed = (await rows(page, "featureRecords"))[0];
  const draft = JSON.parse((await rows(page, "settings")).find(row => row.key === "draft:registration-correction").value).value;
  expect(draft.quick).toEqual(committed);
  await helpAndBack(page);
  await expect(page.getByLabel("Notitie bij snelle registratie", { exact: true })).toHaveValue("SYNTHETIC committed correction");
  await page.getByRole("button", { name: "Opnieuw proberen", exact: true }).click();
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Concept van correctie", exact: true })).toHaveCount(0);
  const saved = await rows(page, "featureRecords"); expect(saved).toHaveLength(1); expect(saved[0].id).toBe(committed.id); expect(saved[0].note).toBe(committed.note);
});

test("a newer saved entry is not overwritten by an older correction draft", async ({ page }) => {
  await startCorrection(page);
  await page.getByLabel("Notitie bij snelle registratie", { exact: true }).fill("SYNTHETIC older local draft");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("featureRecords", "readwrite"); const store = tx.objectStore("featureRecords"); const request = store.getAll();
        request.onsuccess = () => { const row = request.result[0]; store.put({ ...row, note: "SYNTHETIC newer saved entry", updatedAt: Date.now() + 1000 }); };
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.getByRole("button", { name: "Correctie opslaan", exact: true }).click();
  await expect(page.getByText(/De opgeslagen registratie is gewijzigd of verwijderd\. Je concept blijft hier/)).toBeVisible();
  await helpAndBack(page); await page.reload();
  await expect(page.getByLabel("Notitie bij snelle registratie", { exact: true })).toHaveValue("SYNTHETIC older local draft");
  expect((await rows(page, "featureRecords"))[0].note).toBe("SYNTHETIC newer saved entry");
});
