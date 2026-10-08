import { test, expect, type Page } from "@playwright/test";

// Each test uses Playwright's isolated context and synthetic data only.
async function featureRecords(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const request = db
          .transaction("featureRecords")
          .objectStore("featureRecords")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

async function keepMoment(page: Page, text: string, favourite: boolean) {
  await page.goto("moments/new");
  await page
    .getByRole("textbox", {
      name: "Wat voelde prettig, gaf ruimte of wil je onthouden?",
      exact: true,
    })
    .fill(text);
  const reminder = page.getByRole("checkbox", {
    name: "Als herinnering op Thuis tonen",
    exact: true,
  });
  await expect(reminder).not.toBeChecked();
  if (favourite) await reminder.check();
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(page.getByText("Moment bewaard.", { exact: true })).toBeVisible();
}

test("Home and Tools expose self-criticism; stopping and immediate help need no answers or records", async ({
  page,
}) => {
  await page.goto("./");
  const home = page.getByRole("region", { name: "Wat ik opbouw", exact: true });
  await home
    .getByRole("link", { name: "Ik zit vast in zelfkritiek", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tools\/self-criticism$/);
  await expect(
    page.getByRole("heading", { name: "Ruimte bij zelfkritiek", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(await featureRecords(page)).toEqual([]);
  await page
    .getByRole("link", { name: "Stoppen voor nu", exact: true })
    .first()
    .click();
  await expect(home).toBeVisible();
  expect(await featureRecords(page)).toEqual([]);

  await page.goto("tools");
  await page
    .getByRole("link", { name: /^Ik zit vast in zelfkritiek/ })
    .click();
  await expect(page).toHaveURL(/\/tools\/self-criticism$/);
  await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute(
    "href",
    /\/tools$/,
  );
  await expect(
    page.getByRole("link", { name: "Mijn actiekaart", exact: true }),
  ).toHaveAttribute("href", /\/action-card$/);
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  expect(await featureRecords(page)).toEqual([]);
});

test("support choices reach the existing tools and only chosen growth reminders without changing records", async ({
  page,
}) => {
  const privateMoment = "SYNTHETIC: this moment was not chosen as a reminder";
  const reminder = "SYNTHETIC: a reminder I deliberately chose";
  await keepMoment(page, privateMoment, false);
  await keepMoment(page, reminder, true);
  const before = await featureRecords(page);
  expect(before).toHaveLength(2);

  await page.goto("tools/self-criticism");
  await page.getByRole("link", { name: /^Even landen/ }).click();
  await expect(page).toHaveURL(/\/tools\/grounding$/);
  await expect(
    page.getByRole("heading", { name: "5-4-3-2-1 Aarding", exact: true }),
  ).toBeVisible();

  await page.goto("tools/self-criticism");
  await page.getByRole("link", { name: /^Vriendelijkere woorden/ }).click();
  await expect(page).toHaveURL(/\/tools\/self-compassion\/brief$/);
  await expect(
    page.getByRole("heading", {
      name: "Even vriendelijk voor mezelf",
      exact: true,
    }),
  ).toBeVisible();

  await page.goto("tools/self-criticism");
  await page.getByRole("link", { name: /^Mijn groei terugzien/ }).click();
  await expect(page).toHaveURL(/\/growth\?favourites=1$/);
  await expect(
    page.getByRole("button", { name: "Mijn herinneringen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(reminder, { exact: true })).toBeVisible();
  await expect(page.getByText(privateMoment, { exact: true })).toHaveCount(0);
  expect(await featureRecords(page)).toEqual(before);
});

test("Contact zoeken opens help with the saved support person and does not place a call", async ({
  page,
}) => {
  await page.goto("settings");
  await page
    .getByRole("button", { name: "Steunpersoon toevoegen", exact: true })
    .click();
  const form = page.getByRole("group", {
    name: "Contact en afspraken",
    exact: true,
  });
  await form.getByRole("textbox", { name: "Naam", exact: true }).fill(
    "SYNTHETIC support person",
  );
  await form
    .getByRole("textbox", { name: "Telefoonnummer", exact: true })
    .fill("+31 6 0000 0000");
  await form.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(form).toHaveCount(0);

  await page.goto("tools/self-criticism");
  await page.getByRole("link", { name: /^Contact zoeken/ }).click();
  await expect(page).toHaveURL(/\/help$/);
  const contact = page.getByText("SYNTHETIC support person", { exact: true });
  await contact.scrollIntoViewIfNeeded();
  await expect(contact).toBeVisible();
  // Inspect the option without activating any telephone or message link.
  await expect(page.locator('a[href="tel:+31600000000"]')).toHaveText("Bellen");
  expect(await featureRecords(page)).toEqual([]);
});

for (const language of ["nl", "en"] as const) {
  test(`${language} self-criticism choices fit 320px without horizontal overflow`, async ({
    page,
  }, testInfo) => {
    if (language === "en") {
      await page.goto("settings");
      await page.getByRole("button", { name: /English/ }).click();
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("tools/self-criticism");
    await expect(
      page.getByRole("heading", {
        name: language === "nl" ? "Ruimte bij zelfkritiek" : "When I’m self-critical",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`self-criticism-${language}-320-intro.png`),
      fullPage: true,
    });
    const choices = page.getByRole("region", {
      name: language === "nl" ? "Wat past nu?" : "What fits right now?",
      exact: true,
    });
    await choices.scrollIntoViewIfNeeded();
    await expect(choices.getByRole("link")).toHaveCount(4);
    for (const choice of await choices.getByRole("link").all()) {
      const box = await choice.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`self-criticism-${language}-320-choices.png`),
      fullPage: true,
    });
    expect(await featureRecords(page)).toEqual([]);
  });
}
