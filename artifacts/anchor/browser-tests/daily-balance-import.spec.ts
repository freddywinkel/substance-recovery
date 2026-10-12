import { test, expect, type Page } from "@playwright/test";
import {
  DEFAULT_SETTINGS,
  SCALES,
  emptyForm,
} from "../src/lib/moodTrackerBackup";

const date = "2026-01-02";
const payload = () => ({
  app: "moodtracker",
  version: 1,
  exportedAt: "2026-01-03T20:00:00.000Z",
  scaleDefinitions: SCALES,
  settings: {
    ...DEFAULT_SETTINGS,
    contactName: "SYNTHETIC source contact",
    theme: "light",
  },
  entries: [
    {
      id: "synthetic-source",
      date,
      createdAt: "2026-01-02T20:00:00.000Z",
      updatedAt: "2026-01-02T21:00:00.000Z",
      revision: 4,
      scaleVersion: 1,
      mainSleep: 450,
      additionalSleep: 0,
      mood: -2,
      drive: 2,
      fatigue: 0,
      enjoyment: 3,
      craving: 3,
      use: "none",
      significantChange: false,
      changeNote: "",
      supportedBy: "SYNTHETIC painting",
      note: "SYNTHETIC imported saved day",
    },
  ],
  drafts: [
    {
      date,
      revision: 5,
      updatedAt: "2026-01-02T22:00:00.000Z",
      form: {
        ...emptyForm(date),
        mainHours: "25",
        mainMinutes: "13",
        mood: 0,
        craving: 0,
        note: "SYNTHETIC unfinished",
      },
    },
  ],
});
async function rows(page: Page, storeName: string) {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, storeName);
}
async function chooseFile(page: Page, data: unknown) {
  await page
    .getByLabel("Choose MoodTracker backup", { exact: true })
    .setInputFiles({
      name: "synthetic-moodtracker.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
}
test.beforeEach(async ({ page }) => {
  await page.goto("settings");
  await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the daily Home card is optional and can be enabled without changing navigation", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("link", { name: "Go to my day", exact: true }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(
    nav.getByRole("button", { name: "New registration", exact: true }),
  ).toBeVisible();
  await page.goto("home-customization");
  await page
    .getByRole("button", { name: "Daily check-in: Hidden", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Home layout", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Home layout saved offline",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("./");
  await expect(
    page.getByRole("link", { name: "Go to my day", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Go to my day", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "More", exact: true }).click();
  await page.getByRole("link", { name: /^Daily check-in/ }).click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(
    nav.getByRole("link", { name: "More", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("MoodTracker import previews conflicts, preserves original ratings and raw drafts, and joins the full backup", async ({
  page,
}) => {
  const beforeSettings = await rows(page, "settings");
  await chooseFile(page, payload());
  await expect(
    page.getByText("1 days and 1 drafts; 1 new dates, 0 existing dates.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import MoodTracker", exact: true })
    .click();
  await expect(
    page.getByText("1 dates imported; 0 existing dates kept.", { exact: true }),
  ).toBeVisible();
  const imported = (await rows(page, "featureRecords")).find(
    (row) => row.recordType === "daily-balance",
  );
  expect(imported).toMatchObject({
    date,
    mainSleep: 450,
    mood: -2,
    drive: 2,
    craving: 3,
    cravingScale: 3,
    emotionalIntensity: null,
  });
  const settings = await rows(page, "settings");
  for (const previous of beforeSettings)
    expect(settings).toContainEqual(previous);
  const draft = JSON.parse(
    settings.find((row) => row.key === `draft:daily-balance:${date}`).value,
  );
  expect(draft.value).toMatchObject({
    mainHours: "25",
    mainMinutes: "13",
    record: { craving: 0, cravingScale: 3, note: "SYNTHETIC unfinished" },
  });
  await chooseFile(page, payload());
  await expect(
    page.getByText("1 days and 1 drafts; 0 new dates, 1 existing dates.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import MoodTracker", exact: true })
    .click();
  await expect(
    page.getByText("0 dates imported; 1 existing dates kept.", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(page, "featureRecords")).find((row) => row.id === imported.id),
  ).toEqual(imported);

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export to file", exact: true })
    .click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.version).toBe(6);
  expect(backup.featureRecords).toContainEqual(imported);
  expect(
    backup.settings.find(
      (row: any) => row.key === `draft:daily-balance:${date}`,
    ),
  ).toBeTruthy();
});

test("invalid import is all-or-nothing and incoming conflicts require explicit choice", async ({
  page,
}) => {
  const invalid = payload();
  invalid.entries[0].craving = 4;
  await chooseFile(page, invalid);
  await expect(page.getByText(/This file could not be read/)).toBeVisible();
  expect(await rows(page, "featureRecords")).toEqual([]);
  await chooseFile(page, payload());
  await page
    .getByLabel("Use the MoodTracker day and draft", { exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "Import MoodTracker", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /I understand that days and drafts/ })
    .check();
  await page
    .getByRole("button", { name: "Import MoodTracker", exact: true })
    .click();
  await expect(
    page.getByText("1 dates imported; 0 existing dates kept.", { exact: true }),
  ).toBeVisible();
});
