import { expect, test, type Page } from "@playwright/test";

async function storeRows(page: Page, store: string): Promise<any[]> {
  return page.evaluate(async storeName => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, store);
}

test.beforeEach(async ({ page }) => {
  await page.goto("settings");
  await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("craving seeds a linked activity while preserving the unfinished detailed registration", async ({ page }) => {
  await page.goto("craving");
  await page.getByRole("button", { name: "Other", exact: true }).first().click();
  await page.getByPlaceholder("Describe how it's coming on…", { exact: true }).fill("SYNTHETIC unfinished craving description");
  const intensity = page.getByRole("slider", { name: "How strong is the urge or craving?", exact: true });
  await intensity.press("End");
  for (let index = 0; index < 3; index++) await intensity.press("ArrowLeft");
  await expect(intensity).toHaveValue("7");
  await page.getByRole("button", { name: "Track mood and an activity", exact: true }).click();
  await expect(page).toHaveURL(/\/daily\/moments\/[^/?]+$/);
  const features = await storeRows(page, "featureRecords");
  const moment = features.find(record => record.recordType === "balance-moment");
  expect(moment.before).toEqual({ mood: null, emotionalIntensity: null, craving: 7 });
  expect(moment.attempted).toBeNull();
  expect(moment.status).toBe("open");
  expect(await storeRows(page, "cravingLogs")).toHaveLength(0);
  expect(await storeRows(page, "relapseLogs")).toHaveLength(0);

  await page.goto("craving");
  await page.reload();
  await expect(page.getByPlaceholder("Describe how it's coming on…", { exact: true })).toHaveValue("SYNTHETIC unfinished craving description");
  await expect(intensity).toHaveValue("7");
  await page.getByRole("button", { name: "Track mood and an activity", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/daily/moments/${moment.id}$`));
  expect((await storeRows(page, "featureRecords")).filter(record => record.recordType === "balance-moment")).toHaveLength(1);
});

for (const scenario of [
  { label: "Craving or urge", score: 0, expectedCraving: 0 },
  { label: "Anxiety or tension", score: 8, expectedCraving: null },
]) {
  test(`saved quick ${scenario.label} links its own record and respects the original score meaning`, async ({ page }) => {
    await page.goto("quick");
    await page.getByRole("button", { name: scenario.label, exact: true }).click();
    await page.getByRole("radio", { name: `Intensity now ${scenario.score}/10`, exact: true }).click();
    await page.getByRole("button", { name: "Safe for now", exact: true }).click();
    await page.getByRole("button", { name: "Use a coping tool", exact: true }).click();
    await page.getByRole("button", { name: "Save quick registration", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quick registration saved", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Track mood and an activity", exact: true }).click();
    await expect(page).toHaveURL(/\/daily\/moments\/[^/?]+$/);
    const features = await storeRows(page, "featureRecords");
    const quick = features.filter(record => record.recordType === "quick-registration");
    const moments = features.filter(record => record.recordType === "balance-moment");
    expect(quick).toHaveLength(1);
    expect(moments).toHaveLength(1);
    expect(moments[0].source).toEqual({ kind: "quick-registration", recordId: quick[0].id });
    expect(moments[0].before).toEqual({ mood: null, emotionalIntensity: null, craving: scenario.expectedCraving });
    expect(quick[0].reflectionStatus).toBe("pending");
    expect(await storeRows(page, "cravingLogs")).toHaveLength(0);
    expect(await storeRows(page, "relapseLogs")).toHaveLength(0);
  });
}

test("a linked app tool has an immediate return path without recording an attempt or duplicate follow-up", async ({ page }) => {
  await page.goto("daily/moments/new");
  await page.getByRole("button", { name: "An app tool", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose a tool", exact: true }).selectOption("/tools/grounding");
  await page.getByRole("button", { name: "Save before & open tool", exact: true }).click();
  await expect(page).toHaveURL(/\/tools\/grounding\?balanceMoment=/);
  await expect(page.getByRole("button", { name: "Return to activity check-in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I used this tool", exact: true })).toHaveCount(0);
  let features = await storeRows(page, "featureRecords");
  const moment = features.find(record => record.recordType === "balance-moment");
  expect(moment.attempted).toBeNull();
  expect(features.filter(record => record.recordType === "tool-follow-up" || record.recordType === "recovery-action")).toHaveLength(0);
  for (let index = 0; index < 4; index++) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You did it.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I used this tool", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Return to activity check-in", exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/daily/moments/${moment.id}$`));
  features = await storeRows(page, "featureRecords");
  expect(features.find(record => record.id === moment.id).attempted).toBeNull();
});

test("an unavailable linked activity offers daily overview recovery", async ({ page }) => {
  await page.goto("tools/grounding?balanceMoment=missing-synthetic-record");
  await expect(page.getByText("The linked check-in is unavailable. Open your daily overview to continue.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open my daily overview", exact: true }).click();
  await expect(page).toHaveURL(/\/daily$/);
});
