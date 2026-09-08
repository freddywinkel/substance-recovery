import { test, expect } from "@playwright/test";

const cases = [
  { route: "craving", choice: "Anders", explanation: "Omschrijf hoe het nu opkomt…" },
  { route: "trek", choice: "Zoeken of beschikbaarheid controleren" },
  { route: "anxiety", choice: "Gedachtenmolen" },
  { route: "boredom", choice: "Verveeld" },
  { route: "relapse", choice: "Geen directe zorg" },
] as const;

for (const scenario of cases) {
  test(`${scenario.route}: unfinished answer survives direct Help, Back and reload`, async ({ page }) => {
    await page.goto(scenario.route);
    const choice = page.getByRole("button", { name: scenario.choice, exact: true });
    await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    if ("explanation" in scenario) {
      await page.getByPlaceholder(scenario.explanation, { exact: true }).fill("SYNTHETIC unfinished explanation");
    }
    await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
    await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
    await page.goBack();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    if ("explanation" in scenario) {
      await expect(page.getByPlaceholder(scenario.explanation, { exact: true })).toHaveValue("SYNTHETIC unfinished explanation");
    }
  });
}
