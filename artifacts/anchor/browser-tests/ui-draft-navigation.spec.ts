import { expect, test, type Page } from "@playwright/test";

// Every scenario starts in an isolated browser context with synthetic input.
async function rows(page: Page, store: "settings" | "featureRecords") {
  return page.evaluate(async name => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, store);
}

async function helpAndBack(page: Page) {
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
}

test("supportive action keyboard selection, text and hint survive Help and reload without submission", async ({ page }) => {
  await page.goto("actions");
  const contact = page.getByRole("radio", { name: "Contact gezocht", exact: true });
  const care = page.getByRole("radio", { name: "Zorg bijgewoond", exact: true });
  const goal = page.getByRole("radio", { name: "Persoonlijk doel", exact: true });
  await expect(contact).toBeEnabled();
  await expect(contact).toHaveAccessibleDescription("Iemand gebeld, bericht of ontmoet voor steun");
  await expect(page.getByRole("radiogroup").locator('[tabindex="0"]')).toHaveCount(1);
  await contact.focus(); await page.keyboard.press("ArrowRight");
  await expect(care).toBeFocused(); await expect(care).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End"); await expect(goal).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(contact).toBeFocused();
  await page.keyboard.press("ArrowLeft"); await expect(goal).toBeFocused();
  await page.keyboard.press("Home"); await expect(contact).toBeFocused();
  await page.keyboard.press("ArrowUp"); await expect(goal).toBeFocused();
  await care.click();
  await page.getByLabel("Wat heb je gedaan?", { exact: true }).fill("SYNTHETIC U01 meeting");
  await page.getByLabel("Optionele notitie", { exact: true }).fill("SYNTHETIC U01 remember this");
  await helpAndBack(page);
  await expect(page.getByLabel("Wat heb je gedaan?", { exact: true })).toHaveValue("SYNTHETIC U01 meeting");
  await expect(page.getByLabel("Optionele notitie", { exact: true })).toHaveValue("SYNTHETIC U01 remember this");
  await expect(care).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Wat heb je gedaan?", { exact: true })).toHaveValue("SYNTHETIC U01 meeting");
  await expect(care).toHaveAttribute("aria-checked", "true");
  expect((await rows(page, "featureRecords")).filter(row => row.recordType === "recovery-action")).toHaveLength(0);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("failed action write preserves input through Help and the retry saves one action", async ({ page }) => {
  await page.goto("actions");
  const label = page.getByLabel("Wat heb je gedaan?", { exact: true });
  await label.fill("SYNTHETIC action retry");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "featureRecords" && !failed) { failed = true; throw new DOMException("Synthetic write failure", "QuotaExceededError"); }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Actie opslaan", exact: true }).click();
  await expect(page.getByText("De actie kon niet worden opgeslagen. Probeer het opnieuw.", { exact: true })).toBeVisible();
  expect((await rows(page, "featureRecords")).filter(row => row.recordType === "recovery-action")).toHaveLength(0);
  await helpAndBack(page);
  await expect(label).toHaveValue("SYNTHETIC action retry");
  await page.getByRole("button", { name: "Actie opslaan", exact: true }).click();
  await expect(page.getByText("Actie op dit apparaat opgeslagen.", { exact: true })).toBeVisible();
  expect((await rows(page, "featureRecords")).filter(row => row.recordType === "recovery-action")).toHaveLength(1);
  await expect(label).toHaveValue("");
});

test("committed action with failed draft cleanup keeps its ID and input until a successful retry", async ({ page }) => {
  await page.goto("actions");
  const label = page.getByLabel("Wat heb je gedaan?", { exact: true });
  await label.fill("SYNTHETIC saved action cleanup retry");
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  const initialDraft = JSON.parse((await rows(page, "settings")).find(row => row.key === "draft:supportive-action").value).value;
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      const record = args[0];
      if (this.name === "settings" && record?.key === "draft:supportive-action" && record.value === "" && !failed) {
        failed = true; throw new DOMException("Synthetic cleanup failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Actie opslaan", exact: true }).click();
  await expect(page.getByText("De actie is opgeslagen; het concept kon niet worden gewist. Probeer opnieuw: dezelfde actie wordt bijgewerkt.", { exact: true })).toBeVisible();
  await expect(label).toHaveValue("SYNTHETIC saved action cleanup retry");
  const first = (await rows(page, "featureRecords")).filter(row => row.recordType === "recovery-action");
  expect(first).toHaveLength(1); expect(first[0].id).toBe(initialDraft.id);
  await helpAndBack(page);
  await expect(label).toHaveValue("SYNTHETIC saved action cleanup retry");
  await page.getByRole("button", { name: "Opnieuw proberen", exact: true }).click();
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Actie opslaan", exact: true }).click();
  await expect(page.getByText("Actie op dit apparaat opgeslagen.", { exact: true })).toBeVisible();
  const retried = (await rows(page, "featureRecords")).filter(row => row.recordType === "recovery-action");
  expect(retried).toHaveLength(1); expect(retried[0].id).toBe(first[0].id); expect(retried[0].timestamp).toBe(first[0].timestamp);
  await expect(label).toHaveValue("");
  await label.fill("SYNTHETIC separate next action");
  await page.getByRole("button", { name: "Actie opslaan", exact: true }).click();
  await expect(page.getByText("Actie op dit apparaat opgeslagen.", { exact: true })).toBeVisible();
  const both = (await rows(page, "featureRecords")).filter(row => row.recordType === "recovery-action");
  expect(both).toHaveLength(2); expect(new Set(both.map(row => row.id)).size).toBe(2);
});

test("Home layout draft preserves order, visibility and tool choices through Help and reload before explicit save", async ({ page }) => {
  await page.goto("home-customization");
  await expect(page.getByRole("button", { name: "Doelen en traject: Getoond", exact: true })).toBeEnabled();
  const initial = (await rows(page, "settings")).find(row => row.key === "homePreferences")?.value;
  await page.getByRole("button", { name: "Doelen en traject: Getoond", exact: true }).click();
  await page.getByRole("button", { name: "Omlaag verplaatsen: Doelen en traject", exact: true }).click();
  const craving = page.getByRole("button", { name: "Craving — er is een verlangen aanwezig", exact: true });
  await craving.click();
  const breathing = page.getByRole("button", { name: "Box-ademhaling", exact: true });
  const wasPinned = await breathing.getAttribute("aria-pressed");
  await breathing.click();
  const wantedPinned = wasPinned === "true" ? "false" : "true";
  const order = await page.locator("ol").first().locator("li button[aria-pressed]").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")));
  await helpAndBack(page);
  await expect(page.getByRole("button", { name: "Doelen en traject: Verborgen", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(craving).toHaveAttribute("aria-pressed", "false");
  await expect(breathing).toHaveAttribute("aria-pressed", wantedPinned);
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Doelen en traject: Verborgen", exact: true })).toBeVisible();
  expect(await page.locator("ol").first().locator("li button[aria-pressed]").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).toEqual(order);
  expect((await rows(page, "settings")).find(row => row.key === "homePreferences")?.value).toBe(initial);
  await page.getByRole("button", { name: "Indeling van Thuis opslaan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Indeling offline opgeslagen", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Doelen en traject: Verborgen", exact: true })).toBeVisible();
  const saved = JSON.parse((await rows(page, "settings")).find(row => row.key === "homePreferences").value);
  expect(saved.hiddenWidgets).toContain("sobriety"); expect(saved.hiddenRegistrationTypes).toContain("craving");
  expect(saved.pinnedToolIds.includes("/tools/breathing")).toBe(wantedPinned === "true");
});
