import { test, expect, type Locator, type Page } from "@playwright/test";

async function settle(page: Page) {
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every(animation =>
    !Number.isFinite(animation.effect?.getComputedTiming().endTime)
    || animation.playState === "finished",
  ));
}

// Use the browser's rendered CSS colors (including color-mix and alpha), then
// composite ancestor backgrounds before applying the WCAG luminance formula.
async function textContrast(target: Locator) {
  return target.evaluate(element => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const composite = (color: number[], under: number[]) => color.slice(0, 3).map((value, i) =>
      value * color[3] / 255 + under[i] * (1 - color[3] / 255),
    );
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
    let background = [255, 255, 255];
    for (const ancestor of ancestors) background = composite(rgba(getComputedStyle(ancestor).backgroundColor), background);
    const foreground = composite(rgba(getComputedStyle(element).color), background);
    const luminance = (color: number[]) => color.map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    return (values[1] + 0.05) / (values[0] + 0.05);
  });
}

test("light theme small action text and selected mood meet 4.5:1 contrast", async ({ page }) => {
  await page.goto("settings");
  await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("switch").first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("daily");
  await settle(page);
  const selectedMood = page.getByRole("group", { name: "Mood", exact: true })
    .getByRole("button", { name: "+1 Good", exact: true });
  await selectedMood.click();
  const targets = [
    page.getByRole("link", { name: "Help now", exact: true }),
    page.getByRole("button", { name: "Day", exact: true }),
    page.getByRole("link", { name: "Record a moment or activity", exact: true }),
    selectedMood.locator("span").first(),
    selectedMood.locator("span").last(),
    page.getByRole("button", { name: "New registration", exact: true }).locator("span").last(),
  ];
  for (const target of targets) expect(await textContrast(target)).toBeGreaterThanOrEqual(4.5);
  for (const [route, selector] of [
    ["help", "main .min-w-0 > p.mt-1.leading-relaxed"],
    ["recovery-plan", 'main a[href$="action-card"]'],
    ["growth", 'main button[aria-pressed="true"].border-primary'],
    ["tools/self-compassion/brief", 'main button[aria-pressed="true"].border-primary'],
  ]) {
    await page.goto(route);
    await settle(page);
    expect(await textContrast(page.locator(selector))).toBeGreaterThanOrEqual(4.5);
  }
});

test("dark grounding examples, delay safety hint and journal privacy text meet 4.5:1 contrast", async ({ page }) => {
  for (const [route, selector] of [
    ["tools/grounding", "main p.italic"],
    ["delay", 'main p[class*="max-w-[220px]"]'],
    ["journal", "main p.text-center.px-2"],
  ]) {
    await page.goto(route);
    await settle(page);
    expect(await textContrast(page.locator(selector))).toBeGreaterThanOrEqual(4.5);
  }
});

test("privacy content is keyboard reachable and can be scrolled with PageDown", async ({ page }) => {
  await page.goto("privacy");
  const region = page.getByRole("region", { name: "Privacybeleid", exact: true });
  await expect(region).toBeVisible();
  await page.getByRole("button", { name: "Terug", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(region).toBeFocused();
  const before = await region.evaluate(element => element.scrollTop);
  await page.keyboard.press("PageDown");
  await expect.poll(() => region.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
});

test.describe("first navigation to a lazy route", () => {
  test.use({ serviceWorkers: "block" });

  test("waits for delayed headings before moving focus and updating title", async ({ page }) => {
    await page.route(/\/assets\/(More|DailyBalance)-.*\.js$/, async route => {
      await new Promise(resolve => setTimeout(resolve, 350));
      await route.continue();
    });
    await page.goto("");
    await settle(page);
    await page.getByRole("link", { name: "Meer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Meer", exact: true })).toBeFocused();
    await expect(page).toHaveTitle("Meer · Anchor");
    await page.getByRole("link", { name: /^Dagelijkse check-in/ }).click();
    await expect(page.locator("main h1")).toBeFocused();
    await expect(page).toHaveTitle(`${await page.locator("main h1").textContent()} · Anchor`);
  });

  test("does not move focus away from user interaction during a delayed route", async ({ page }) => {
    let releaseChunk!: () => void;
    const chunkGate = new Promise<void>(resolve => { releaseChunk = resolve; });
    let chunkRequested!: () => void;
    const requested = new Promise<void>(resolve => { chunkRequested = resolve; });
    await page.route(/\/assets\/More-.*\.js$/, async route => {
      chunkRequested();
      await chunkGate;
      await route.continue();
    });
    await page.goto("");
    await settle(page);
    await page.getByRole("link", { name: "Meer", exact: true }).click();
    await requested;
    // A keyboard user continues tabbing while the next page is loading.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const activeBefore = await page.evaluateHandle(() => document.activeElement);
    releaseChunk();
    await expect(page.getByRole("heading", { name: "Meer", exact: true })).toBeVisible();
    await expect(page).toHaveTitle("Meer · Anchor");
    expect(await page.evaluate(element => document.activeElement === element, activeBefore)).toBe(true);
    await activeBefore.dispose();
  });
});

async function storedRegistration(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction("settings").objectStore("settings").get("activeRegistration");
        request.onsuccess = () => resolve(request.result?.value ?? "");
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}

for (const language of ["nl", "en"] as const) {
  test(`the ${language} conflict warning leaves Help and its reload action accessible at 320px and 200% text`, async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    if (language === "en") {
      await page.goto("settings");
      await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    }
    const placeholder = language === "nl" ? "Omschrijf hoe het nu opkomt…" : "Describe how it's coming on…";
    await page.goto("craving");
    await page.getByRole("button", { name: language === "nl" ? "Anders" : "Other", exact: true }).first().click();
    const input = page.getByPlaceholder(placeholder, { exact: true });
    await input.fill("SYNTHETIC original");
    await expect.poll(() => storedRegistration(page)).toContain("SYNTHETIC original");
    const newer = await context.newPage();
    await newer.goto("craving");
    await expect(newer.getByPlaceholder(placeholder, { exact: true })).toHaveValue("SYNTHETIC original");
    await newer.getByPlaceholder(placeholder, { exact: true }).fill("SYNTHETIC newer");
    await expect.poll(() => storedRegistration(newer)).toContain("SYNTHETIC newer");
    await input.fill("SYNTHETIC stale window");
    const reload = page.getByRole("button", { name: language === "nl" ? "Opgeslagen versie laden" : "Reload saved version", exact: true });
    await expect(reload).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
    const warning = page.getByRole("region", { name: language === "nl" ? "Waarschuwing over niet-opgeslagen invoer" : "Unsaved input warning", exact: true });
    await warning.focus();
    await page.keyboard.press("PageDown");
    await expect.poll(() => warning.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(reload).toHaveAttribute("aria-describedby", "registration-storage-warning");
    const geometry = await reload.evaluate(element => {
      const button = element.getBoundingClientRect();
      const banner = element.closest('[role="alert"]')!.getBoundingClientRect();
      const help = document.querySelector('a[href$="help"]')!.getBoundingClientRect();
      return { left: button.left, right: button.right, bottom: button.bottom, bannerTop: banner.top, bannerBottom: banner.bottom, helpBottom: help.bottom, width: innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.bannerBottom);
    expect(geometry.bannerTop).toBeGreaterThan(geometry.helpBottom + 100);
    await reload.click();
    await expect(reload).toHaveCount(0);
    await expect(input).toHaveValue("SYNTHETIC newer");
    await newer.close();
  });
}
