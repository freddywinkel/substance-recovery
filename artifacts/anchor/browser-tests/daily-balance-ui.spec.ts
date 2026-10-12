import { expect, test, type Page, type Locator } from "@playwright/test";

// All records in this suite are synthetic and scoped to isolated test contexts.
async function rows(page: Page, store = "featureRecords"): Promise<any[]> {
  return page.evaluate(async (name) => {
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
    } finally {
      db.close();
    }
  }, store);
}
async function mood(scope: Page | Locator, value: number) {
  await scope
    .getByRole("group", { name: "Mood", exact: true })
    .getByRole("button", { name: new RegExp(`^\\+?${value} `) })
    .click();
}
async function craving(scope: Page | Locator, value: number) {
  await scope
    .getByRole("group", { name: "Craving", exact: true })
    .getByRole("button", { name: String(value), exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("settings");
  await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("daily partial values and invalid raw sleep survive reload; saved history keeps one day and missing answers", async ({
  page,
}) => {
  await page.goto("daily");
  await mood(page, 0);
  await page
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("0");
  await craving(page, 0);
  await page
    .getByRole("textbox", { name: "Main sleep · Hours", exact: true })
    .fill("25");
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Main sleep · Hours", exact: true }),
  ).toHaveValue("25");
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Use whole numbers" }),
  ).toBeVisible();
  expect(
    (await rows(page)).filter((row) => row.recordType === "daily-balance"),
  ).toHaveLength(0);
  await page
    .getByRole("textbox", { name: "Main sleep · Hours", exact: true })
    .fill("7");
  await page
    .getByRole("textbox", { name: "Main sleep · Minutes", exact: true })
    .fill("30");
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  const saved = (await rows(page)).find(
    (row) => row.recordType === "daily-balance",
  );
  expect(saved).toMatchObject({
    mood: 0,
    emotionalIntensity: 0,
    craving: 0,
    cravingScale: 10,
    mainSleep: 450,
    additionalSleep: null,
    drive: null,
  });
  await page
    .getByRole("button", { name: "No additional sleep", exact: true })
    .click();
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(page)).filter((row) => row.recordType === "daily-balance"),
  ).toEqual([
    expect.objectContaining({
      id: saved.id,
      mainSleep: 450,
      additionalSleep: 0,
    }),
  ]);
  await page.getByRole("button", { name: "Patterns", exact: true }).click();
  const dayRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: saved.date, exact: true }) });
  await expect(dayRow).toContainText("7h 30m");
  await expect(dayRow).toContainText("0/10");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(15);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Edit day" }).click();
  await expect(
    page.getByRole("textbox", { name: "Main sleep · Hours", exact: true }),
  ).toHaveValue("7");
});

test("custom activity keeps partial name and after draft, records independent paired scores and explicitly copies to day", async ({
  page,
}) => {
  await page.goto("daily/moments/new");
  const before = page.getByRole("region", { name: "Before", exact: true });
  await mood(before, -1);
  await before
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("80");
  await craving(before, 8);
  await page
    .getByRole("button", { name: "My own activity", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Activity name", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("textbox", { name: "Activity name", exact: true })
    .fill("SYNTHETIC: paint a small landscape");
  await page
    .getByRole("button", { name: "Save before & start activity", exact: true })
    .click();
  await expect(page).toHaveURL(/\/daily\/moments\/(?!new)[^/?]+$/);
  const after = page.getByRole("region", { name: "After", exact: true });
  await mood(after, 1);
  await after
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("40");
  await craving(after, 3);
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    after.getByRole("spinbutton", {
      name: "Emotional intensity (EIS)",
      exact: true,
    }),
  ).toHaveValue("40");
  await after
    .getByRole("group", { name: "Did you try this activity?", exact: true })
    .getByRole("button", { name: "Yes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save after-check-in", exact: true })
    .click();
  await expect(
    page.getByText("Moment saved locally", { exact: true }),
  ).toBeVisible();
  const moments = (await rows(page)).filter(
    (row) => row.recordType === "balance-moment",
  );
  expect(moments).toHaveLength(1);
  expect(moments[0]).toMatchObject({
    before: { mood: -1, emotionalIntensity: 80, craving: 8 },
    after: { mood: 1, emotionalIntensity: 40, craving: 3 },
    attempted: true,
    status: "completed",
    activity: { kind: "custom", label: "SYNTHETIC: paint a small landscape" },
  });
  await page
    .getByRole("button", { name: "Back to this day", exact: true })
    .click();
  expect(
    (await rows(page)).filter((row) => row.recordType === "daily-balance"),
  ).toHaveLength(0);
  await page
    .getByRole("button", {
      name: "Use latest scores for this check-in",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Emotional intensity (EIS)",
      exact: true,
    }),
  ).toHaveValue("40");
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(page)).find((row) => row.recordType === "daily-balance"),
  ).toMatchObject({ mood: 1, emotionalIntensity: 40, craving: 3 });
  expect(
    (await rows(page)).filter((row) => row.recordType === "balance-moment"),
  ).toHaveLength(1);
});

test("not attempting an activity can still retain after ratings; deleting day preserves moment and confirmed moment deletion removes it", async ({
  page,
}) => {
  await page.goto("daily");
  await mood(page, 1);
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Record a moment or activity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Walking outside", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save before & start activity", exact: true })
    .click();
  const after = page.getByRole("region", { name: "After", exact: true });
  await after
    .getByRole("group", { name: "Did you try this activity?", exact: true })
    .getByRole("button", { name: "No", exact: true })
    .click();
  await after
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Save after-check-in", exact: true })
    .click();
  await expect(
    page.getByText("Moment saved locally", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(page)).find((row) => row.recordType === "balance-moment"),
  ).toMatchObject({
    attempted: false,
    status: "skipped",
    after: { emotionalIntensity: 10 },
  });
  await page
    .getByRole("button", { name: "Back to this day", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete day", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await rows(page)).filter((row) => row.recordType === "daily-balance"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Delete day", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete day", exact: true }),
  ).toHaveCount(0);
  expect(
    (await rows(page)).filter((row) => row.recordType === "daily-balance"),
  ).toHaveLength(0);
  expect(
    (await rows(page)).filter((row) => row.recordType === "balance-moment"),
  ).toHaveLength(1);
  await page.getByText(/View this day's moments/).click();
  await page.getByRole("link", { name: "Open moment", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete moment", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("No moments recorded for this day yet.", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(page)).filter((row) => row.recordType === "balance-moment"),
  ).toHaveLength(0);
});

test("daily and moment views fit phone and tablet; a controlled offline reload keeps partial check-in", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("daily");
  await mood(page, -2);
  await page
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("73");
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("spinbutton", {
      name: "Emotional intensity (EIS)",
      exact: true,
    }),
  ).toHaveValue("73");
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`daily-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("link", { name: "Record a moment or activity", exact: true })
    .click();
  await page.getByRole("button", { name: "Painting", exact: true }).click();
  await page
    .getByRole("button", { name: "Save before & start activity", exact: true })
    .click();
  for (const width of [320, 820]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`moment-${width}.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("record conflicts reload the committed day; draft conflicts adopt the other tab without overwriting its input", async ({
  page,
  context,
}) => {
  await page.goto("daily");
  await mood(page, 0);
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("daily");
  await expect(
    other.getByRole("button", { name: "Save day", exact: true }),
  ).toBeEnabled();
  await mood(page, 2);
  await page.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    page.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  await mood(other, -1);
  await other.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    other
      .getByRole("alert")
      .filter({ hasText: "This record changed or was deleted" }),
  ).toBeVisible();
  await other
    .getByRole("button", {
      name: "Discard my draft and load latest",
      exact: true,
    })
    .click();
  await other.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    other
      .getByRole("group", { name: "Mood", exact: true })
      .getByRole("button", { name: "+2 Very good", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    other.getByRole("button", { name: "Save day", exact: true }),
  ).toBeEnabled();

  await page.reload();
  await other.reload();
  await expect(
    page.getByRole("button", { name: "Save day", exact: true }),
  ).toBeEnabled();
  await expect(
    other.getByRole("button", { name: "Save day", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("82");
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  await other
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("14");
  await expect(
    other
      .getByRole("alert")
      .filter({ hasText: "This draft changed in another tab" }),
  ).toBeVisible();
  await other
    .getByRole("button", {
      name: "Discard my draft and load latest",
      exact: true,
    })
    .click();
  await other.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    other.getByRole("spinbutton", {
      name: "Emotional intensity (EIS)",
      exact: true,
    }),
  ).toHaveValue("82");
  await expect(
    other.getByRole("button", { name: "Save day", exact: true }),
  ).toBeEnabled();
  await other.getByRole("button", { name: "Save day", exact: true }).click();
  await expect(
    other.getByText("Day saved locally", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(other)).find((row) => row.recordType === "daily-balance"),
  ).toMatchObject({ mood: 2, emotionalIntensity: 82 });
});

test("reopening a tool retains the unfinished after-check-in and does not mark it attempted", async ({
  page,
}) => {
  await page.goto("daily/moments/new");
  await page.getByRole("button", { name: "An app tool", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Choose a tool", exact: true })
    .selectOption("/tools/breathing");
  await page
    .getByRole("button", { name: "Save before & open tool", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to activity check-in", exact: true })
    .click();
  const after = page.getByRole("region", { name: "After", exact: true });
  await after
    .getByRole("spinbutton", { name: "Emotional intensity (EIS)", exact: true })
    .fill("43");
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save changes & open tool", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to activity check-in", exact: true })
    .click();
  await expect(
    after.getByRole("spinbutton", {
      name: "Emotional intensity (EIS)",
      exact: true,
    }),
  ).toHaveValue("43");
  const moment = (await rows(page)).find(
    (row) => row.recordType === "balance-moment",
  );
  expect(moment).toMatchObject({
    after: null,
    attempted: null,
    status: "open",
  });
  const persistedDrafts = (await rows(page, "settings")).filter(
    (row) => row.key.startsWith("draft:balance-moment:") && row.value !== "",
  );
  expect(persistedDrafts).toHaveLength(1);
  expect(
    JSON.parse(persistedDrafts[0].value).value.record.after.emotionalIntensity,
  ).toBe(43);
});

test("a backdated draft-only day appears in History and can be resumed after a reload", async ({
  page,
}) => {
  await page.goto("daily?date=2024-02-29");
  await mood(page, -1);
  await page
    .getByRole("textbox", { name: "Main sleep · Hours", exact: true })
    .fill("27");
  await expect(
    page.getByText("Draft saved locally. Not submitted yet.", { exact: true }),
  ).toBeVisible();
  expect(
    (await rows(page)).filter((row) => row.recordType === "daily-balance"),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "History", exact: true }).click();
  const draftDay = page
    .getByRole("button")
    .filter({ hasText: "29 February 2024" });
  await expect(draftDay).toContainText("Draft · not yet submitted");
  await expect(draftDay).toContainText("Continue draft");
  await page.reload();
  await draftDay.click();
  await expect(
    page.getByLabel("Day of this check-in", { exact: true }),
  ).toHaveValue("2024-02-29");
  await expect(
    page.getByRole("textbox", { name: "Main sleep · Hours", exact: true }),
  ).toHaveValue("27");
  await expect(
    page
      .getByRole("group", { name: "Mood", exact: true })
      .getByRole("button", { name: "-1 Low", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
