import { test, expect } from "@playwright/test";

test("large journal history loads in batches while search and offline storage retain every entry", async ({ page, context }) => {
  await page.goto("journal");
  await expect(page.locator("main h1")).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction("journal", "readwrite");
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      for (let index = 0; index < 1000; index++) tx.objectStore("journal").put({
        id: `synthetic-history-${index}`,
        timestamp: Date.now() - index * 86_400_000,
        mood: null,
        cravingIntensity: null,
        toolUsed: null,
        note: index === 999 ? "SYNTHETIC oldest searchable needle" : `SYNTHETIC journal ${index}`,
        trigger: "",
        coping: "",
        favourite: false,
      });
      await done;
    } finally { db.close(); }
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const deletes = page.getByRole("button", { name: "Notitie verwijderen", exact: true });
  await expect(deletes).toHaveCount(50);
  await expect(page.getByRole("status").filter({ hasText: "50 van 1000 notities" })).toBeVisible();
  await page.getByRole("button", { name: "Meer notities tonen", exact: true }).click();
  await expect(deletes).toHaveCount(100);
  const search = page.getByRole("textbox");
  await search.fill("oldest searchable needle");
  await expect(deletes).toHaveCount(1);
  await expect(page.getByText("SYNTHETIC oldest searchable needle", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Meer notities tonen", exact: true })).toHaveCount(0);
  await search.fill("");
  await expect(deletes).toHaveCount(50);
  await context.setOffline(true);
  await page.reload();
  await search.fill("oldest searchable needle");
  await expect(page.getByText("SYNTHETIC oldest searchable needle", { exact: true })).toBeVisible();
  expect(await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const count = db.transaction("journal").objectStore("journal").count();
        count.onsuccess = () => resolve(count.result);
        count.onerror = () => reject(count.error);
      });
    } finally { db.close(); }
  })).toBe(1000);
});
