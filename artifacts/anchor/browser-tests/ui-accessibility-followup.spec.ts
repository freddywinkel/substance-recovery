import { test, expect } from "@playwright/test";

test("a failed journey-date save survives Help and can be applied after returning", async ({ page }) => {
  await page.goto("settings");
  const date = page.getByLabel("Begin van hersteltraject", { exact: true });
  await expect(date).toBeEditable();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).restoreDateWrite = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (value?.key === "sobrietyStartDate") throw new DOMException("Synthetic test failure", "QuotaExceededError");
      return original.call(this, value, ...args);
    };
  });
  await date.fill("2026-09-01");
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(date).toHaveValue("2026-09-01");
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).restoreDateWrite());
  await page.getByRole("button", { name: "Datum opslaan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Datum opslaan", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(date).toHaveValue("2026-09-01");
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toHaveCount(0);
});

test("an unapplied future date remains a draft and keeps its validation after returning", async ({ page }) => {
  await page.goto("settings");
  const date = page.getByLabel("Begin van hersteltraject", { exact: true });
  await expect(date).toBeEditable();
  await date.fill("2099-01-01");
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(date).toHaveValue("2099-01-01");
  await page.getByRole("button", { name: "Datum opslaan", exact: true }).click();
  await expect(page.getByText("Kies een geldige datum die niet in de toekomst ligt.", { exact: true })).toBeVisible();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(date).toHaveAttribute("aria-describedby", "journey-date-description journey-date-error");
  await date.fill("2026-08-01");
  await page.getByRole("button", { name: "Datum opslaan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Datum opslaan", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(date).toHaveValue("2026-08-01");
});

for (const language of ["nl", "en"] as const) {
  test(`quick radio group retains its description and one keyboard entry point in ${language}`, async ({ page }) => {
    if (language === "en") {
      await page.goto("settings");
      await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    }
    await page.goto("quick");
    const group = page.getByRole("radiogroup", { name: language === "nl" ? "Intensiteit nu" : "Intensity now", exact: true });
    const radios = group.getByRole("radio");
    await radios.first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(radios.last()).toBeFocused();
    await expect(radios.last()).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(radios.first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(radios.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(radios.first()).toBeFocused();
    await page.keyboard.press("Space");
    await expect(radios.first()).toHaveAttribute("aria-checked", "true");
    await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
    await expect(page.locator("#quick-intensity-help")).toBeVisible();
    await expect(group).toHaveAttribute("aria-describedby", "quick-intensity-help");
    await page.keyboard.press("Tab");
    expect(await group.evaluate(element => element.contains(document.activeElement))).toBe(false);
  });
}

test("affected pages expose one visible main landmark, including quick confirmation", async ({ page }) => {
  for (const route of ["quick", "actions", "weekly-review", "report", "more"]) {
    await page.goto(route);
    await expect(page.locator("main.app-main h1").first()).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
  }
  await page.goto("quick");
  await page.getByRole("button", { name: "Trek of drang", exact: true }).click();
  await page.getByRole("button", { name: "Voor nu veilig", exact: true }).click();
  await page.getByRole("button", { name: "10 minuten pauzeren", exact: true }).click();
  await page.getByRole("button", { name: "Snelle registratie opslaan", exact: true }).click();
  await expect(page.getByText("Snelle registratie opgeslagen", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
});
