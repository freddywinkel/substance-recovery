import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Europe/Amsterdam" });

test("cigarette counter updates elapsed time and the calendar day without another entry", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-12T23:59:10+02:00") });
  await page.goto("./");
  await page.getByRole("button", { name: "Log sigaret", exact: true }).click();
  await expect(page.getByRole("button", { name: "1 Vandaag", exact: true })).toBeVisible();
  await expect(page.getByText("<1m", { exact: true })).toBeVisible();

  // Advance the real component's timer across midnight without changing logs
  // or navigating. The persisted timestamp must remain the original event.
  await page.clock.fastForward(80_000);
  await expect(page.getByRole("button", { name: "0 Vandaag", exact: true })).toBeVisible();
  await expect(page.getByText("1m", { exact: true })).toBeVisible();
  const rows = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Array<{ timestamp: number }>>((resolve, reject) => {
        const request = db.transaction("cigaretteLogs").objectStore("cigaretteLogs").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].timestamp).toBeLessThan(new Date("2026-10-13T00:00:00+02:00").getTime());
});
