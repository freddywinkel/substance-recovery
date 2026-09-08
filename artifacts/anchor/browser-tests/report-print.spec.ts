import { test, expect } from "@playwright/test";

test("a long selected prevention plan prints across pages without app-shell clipping", async ({
  page,
}, testInfo) => {
  await page.goto("report");
  await page
    .getByRole("heading", { name: "Afdrukbaar verslag", exact: true })
    .waitFor();
  await page.evaluate(async () => {
    const now = Date.now();
    const detail = Array.from(
      { length: 18 },
      (_, index) =>
        `SYNTHETIC ${index + 1}: een concrete persoonlijke afspraak om met mijn steunpersoon te bespreken.`,
    ).join("\n");
    const recoveryPlan = {
      version: 1,
      warningSigns: ["SYNTHETIC begin van het plan"],
      reasonsForRecovery: [],
      situationsToAvoid: [],
      trustedContactIds: [],
      callMessage: "",
      next24Hours: [],
      updatedAt: now,
      prevention: {
        version: 1,
        revision: 1,
        goals: [],
        signalActions: [],
        strengths: detail,
        routines: detail,
        careAgreements: detail,
        medicalPrecautions: "SYNTHETIC medische afspraken",
        afterUse: "SYNTHETIC na gebruik",
        aftercare: "SYNTHETIC einde van het volledige plan",
        reviewDate: "",
        reviewedWith: "",
        sharingPreferences: "",
        changeReason: "",
        revisions: [],
      },
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({
          key: "recoveryPlan",
          value: JSON.stringify(recoveryPlan),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  await page
    .getByRole("checkbox", {
      name: /Mijn huidige terugvalpreventieplan toevoegen/,
    })
    .check();
  await page.emulateMedia({ media: "print" });
  const report = page.locator(".print-root");
  await expect(
    report.getByText("SYNTHETIC einde van het volledige plan", { exact: true }),
  ).toBeVisible();
  const dimensions = await report.evaluate((element) => {
    const ancestors = [];
    for (let node = element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      ancestors.push({
        overflow: style.overflowY,
        height: node.getBoundingClientRect().height,
      });
    }
    return {
      height: element.getBoundingClientRect().height,
      viewport: innerHeight,
      bodyHeight: document.body.getBoundingClientRect().height,
      ancestors,
    };
  });
  expect(dimensions.height).toBeGreaterThan(dimensions.viewport);
  expect(dimensions.bodyHeight).toBeGreaterThanOrEqual(dimensions.height);
  expect(
    dimensions.ancestors.every((ancestor) => ancestor.overflow === "visible"),
  ).toBe(true);
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  // Chromium writes explicit page objects. The word boundary excludes /Pages.
  const pageCount = [...pdf.toString("latin1").matchAll(/\/Type\s*\/Page\b/g)]
    .length;
  expect(pageCount).toBeGreaterThan(1);
  await testInfo.attach("complete-plan.pdf", {
    body: pdf,
    contentType: "application/pdf",
  });
});
