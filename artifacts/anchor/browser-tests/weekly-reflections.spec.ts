import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Synthetic records in isolated Playwright contexts only.
async function rows(page: Page, store = "featureRecords"): Promise<any[]> {
  return page.evaluate(async (storeName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db
          .transaction(storeName)
          .objectStore(storeName)
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, store);
}
const remember = "Wat wil ik van deze week onthouden?";
const ownChoice = "Waarin koos ik voor mezelf?";
const room = "Waar wil ik komende week ruimte voor maken?";
const activity = "Eén fijne activiteit (optioneel)";
const saved = "Weekreflectie op dit apparaat opgeslagen.";
async function waitDraft(page: Page) {
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
}
async function save(page: Page) {
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
}

test("the supportive plan remains optional and can be added or cleared without losing reflection", async ({
  page,
}) => {
  await page.goto("weekly-review");
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: keep this reflection");
  await page
    .getByText("Patronen en een ondersteunend plan (optioneel)", {
      exact: true,
    })
    .click();
  const plan = page.getByRole("textbox", {
    name: "Eén plan voor de volgende week",
    exact: true,
  });
  await plan.fill("SYNTHETIC: incomplete planning attempt");
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Kies één waargenomen patroon.",
  );
  const noPlan = page.getByRole("radio", {
    name: "Geen patroon of ondersteunend plan kiezen",
    exact: true,
  });
  await expect(noPlan).not.toBeChecked();
  await noPlan.check();
  await expect(plan).toHaveValue("");
  await save(page);
  const first = (await rows(page))[0];
  await page
    .getByRole("radio", {
      name: "Mijn eigen waarneming, ook zonder registraties",
      exact: true,
    })
    .check();
  await page
    .getByRole("textbox", { name: "Wat merkte je deze week?", exact: true })
    .fill("SYNTHETIC: quiet evenings helped me rest");
  await plan.fill("SYNTHETIC: leave one evening open");
  await save(page);
  expect(await rows(page)).toMatchObject([
    {
      id: first.id,
      rememberFromWeek: first.rememberFromWeek,
      chosenPattern: "SYNTHETIC: quiet evenings helped me rest",
      nextWeekPlan: "SYNTHETIC: leave one evening open",
    },
  ]);
  await noPlan.check();
  await save(page);
  expect(await rows(page)).toMatchObject([
    {
      id: first.id,
      chosenPattern: "",
      nextWeekPlan: "",
      rememberFromWeek: first.rememberFromWeek,
    },
  ]);
});

test("a reflection without problem registrations survives help, week changes and reload, then saves offline", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("weekly-review");
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: together in the garden");
  await page
    .getByRole("textbox", { name: ownChoice, exact: true })
    .fill("SYNTHETIC: I chose a rest");
  await page
    .getByRole("textbox", { name: room, exact: true })
    .fill("SYNTHETIC: time for music");
  await page
    .getByRole("textbox", { name: activity, exact: true })
    .fill("SYNTHETIC: play the piano");
  await waitDraft(page);
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: activity, exact: true }),
  ).toHaveValue("SYNTHETIC: play the piano");
  await page.getByRole("button", { name: "Vorige week", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Huidige week", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: ownChoice, exact: true }),
  ).toHaveValue("SYNTHETIC: I chose a rest");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: room, exact: true }),
  ).toHaveValue("SYNTHETIC: time for music");
  expect(await rows(page)).toEqual([]);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await save(page);
  expect(await rows(page)).toMatchObject([
    {
      recordType: "weekly-review",
      chosenPattern: "",
      nextWeekPlan: "",
      rememberFromWeek: "SYNTHETIC: together in the garden",
      choseForMyself: "SYNTHETIC: I chose a rest",
      makeRoomForNextWeek: "SYNTHETIC: time for music",
      pleasantActivity: "SYNTHETIC: play the piano",
    },
  ]);
  await page
    .getByRole("heading", { name: "Wat ik wil meenemen", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("weekly-reflection-nl.png"),
    fullPage: true,
  });
});

test("one enjoyable activity is enough, while blank and skipped reviews create nothing", async ({
  page,
}) => {
  await page.goto("weekly-review");
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Schrijf iets bij één van de vragen",
  );
  expect(await rows(page)).toEqual([]);
  await page
    .getByRole("link", { name: "Stoppen voor nu", exact: true })
    .click();
  await page.goto("weekly-review");
  await page
    .getByRole("textbox", { name: activity, exact: true })
    .fill("SYNTHETIC: coffee outside");
  await save(page);
  const original = (await rows(page))[0];
  await page
    .getByRole("textbox", { name: activity, exact: true })
    .fill("SYNTHETIC: unfinished edit");
  await waitDraft(page);
  await page
    .getByRole("button", { name: "Concept wissen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Concept wissen en terugzetten", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: activity, exact: true }),
  ).toHaveValue(original.pleasantActivity);
  await page
    .getByRole("textbox", { name: activity, exact: true })
    .fill("SYNTHETIC: drawing outside");
  await save(page);
  expect(await rows(page)).toMatchObject([
    {
      id: original.id,
      timestamp: original.timestamp,
      pleasantActivity: "SYNTHETIC: drawing outside",
    },
  ]);
  await page
    .getByRole("button", {
      name: "Opgeslagen weekreflectie verwijderen",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  expect(await rows(page)).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Opgeslagen weekreflectie verwijderen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Weekreflectie verwijderen", exact: true })
    .click();
  await expect(
    page.getByText("Weekreflectie verwijderd.", { exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toEqual([]);
  expect(
    (await rows(page, "settings")).filter(
      (row) => row.key.startsWith("draft:weekly-review:") && row.value,
    ),
  ).toEqual([]);
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: a new reflection");
  await save(page);
  expect((await rows(page))[0].id).not.toBe(original.id);
});

test("a failed write and failed cleanup retain input and retry the same weekly record", async ({
  page,
}) => {
  await page.goto("weekly-review");
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: retained week");
  await waitDraft(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let writeFailed = false,
      cleanupFailed = false;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "featureRecords" && !writeFailed) {
        writeFailed = true;
        throw new DOMException("Synthetic write failure", "QuotaExceededError");
      }
      if (
        this.name === "settings" &&
        String(args[0]?.key).startsWith("draft:weekly-review:") &&
        args[0]?.value === "" &&
        !cleanupFailed
      ) {
        cleanupFailed = true;
        throw new DOMException(
          "Synthetic cleanup failure",
          "QuotaExceededError",
        );
      }
      return original.apply(this, args);
    };
  });
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Opslaan is niet gelukt");
  expect(await rows(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await expect(
    page.getByText(/Je reflectie is opgeslagen, maar het concept/),
  ).toBeVisible();
  const committed = await rows(page);
  expect(committed).toHaveLength(1);
  await page
    .getByRole("button", { name: "Opnieuw proberen", exact: true })
    .click();
  await waitDraft(page);
  await save(page);
  expect(await rows(page)).toEqual(committed);
});

test("a newer weekly reflection is not overwritten and confirmed recovery loads it", async ({
  page,
  context,
}) => {
  await page.goto("weekly-review");
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: first version");
  await save(page);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toHaveValue("SYNTHETIC: first version");
  const other = await context.newPage();
  await other.goto("weekly-review");
  await other
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: newer saved version");
  await save(other);
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: stale unfinished edit");
  await waitDraft(page);
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "nieuwere versie is niet overschreven",
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toHaveValue("SYNTHETIC: stale unfinished edit");
  await page
    .getByRole("button", { name: "Weekreflectie opslaan", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Huidige opgeslagen versie openen",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toHaveValue("SYNTHETIC: stale unfinished edit");
  await page
    .getByRole("button", {
      name: "Huidige opgeslagen versie openen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Mijn bewerking wissen en laden",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toHaveValue("SYNTHETIC: newer saved version");
  await page
    .getByRole("textbox", { name: ownChoice, exact: true })
    .fill("SYNTHETIC: deliberate fresh edit");
  await save(page);
  expect(await rows(page)).toMatchObject([
    {
      rememberFromWeek: "SYNTHETIC: newer saved version",
      choseForMyself: "SYNTHETIC: deliberate fresh edit",
    },
  ]);
  await other.close();
});

test("an older weekly plan remains editable and reflection plus draft survive a replacement backup", async ({
  page,
}) => {
  await page.goto("weekly-review");
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toBeEnabled();
  const legacy = await page.evaluate(async () => {
    const start = new Date();
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const record = {
      id: "synthetic-legacy-week",
      recordType: "weekly-review",
      timestamp: Date.now() - 5000,
      updatedAt: Date.now() - 5000,
      periodStart: start.getTime(),
      periodEnd: end.getTime() - 1,
      chosenPattern: "SYNTHETIC: old observation",
      nextWeekPlan: "SYNTHETIC: old support plan",
      linkedGoalId: null,
      reviewedEntryIds: [],
    };
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("anchor-recovery");
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("featureRecords", "readwrite");
      tx.objectStore("featureRecords").put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return record;
  });
  await page.reload();
  await page
    .getByText("Patronen en een ondersteunend plan (optioneel)", {
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Eén plan voor de volgende week",
      exact: true,
    }),
  ).toHaveValue(legacy.nextWeekPlan);
  await expect(
    page.getByRole("textbox", {
      name: "Wat merkte je deze week?",
      exact: true,
    }),
  ).toHaveValue(legacy.chosenPattern);
  await page
    .getByRole("textbox", { name: remember, exact: true })
    .fill("SYNTHETIC: new reflection beside the old plan");
  await save(page);
  expect(await rows(page)).toMatchObject([
    {
      id: legacy.id,
      timestamp: legacy.timestamp,
      chosenPattern: legacy.chosenPattern,
      nextWeekPlan: legacy.nextWeekPlan,
    },
  ]);
  await page
    .getByRole("textbox", { name: room, exact: true })
    .fill("SYNTHETIC: still unfinished");
  await waitDraft(page);
  await page.goto("settings");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporteren naar bestand", exact: true })
    .click();
  const bytes = await readFile((await (await downloaded).path())!);
  const backup = JSON.parse(bytes.toString());
  expect(backup.version).toBe(5);
  await page.getByLabel("JSON-back-up kiezen").setInputFiles({
    name: "synthetic-weekly.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page.getByRole("radio", { name: /^Vervangen:/ }).check();
  await page
    .getByRole("checkbox", {
      name: "Ik begrijp dat huidige gegevens die niet in dit bestand staan worden verwijderd.",
      exact: true,
    })
    .check();
  const reloaded = page.waitForEvent("load");
  await page
    .getByRole("button", { name: "Herstel bevestigen", exact: true })
    .click();
  await reloaded;
  await expect(
    page.getByRole("heading", {
      name: "Back-up controleren en herstellen",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("weekly-review");
  await expect(
    page.getByRole("textbox", { name: remember, exact: true }),
  ).toHaveValue("SYNTHETIC: new reflection beside the old plan");
  await expect(
    page.getByRole("textbox", { name: room, exact: true }),
  ).toHaveValue("SYNTHETIC: still unfinished");
  expect(await rows(page)).toHaveLength(1);
});

test("English reflection is usable at 320px with no symptom or plan answers", async ({
  page,
}, testInfo) => {
  await page.goto("settings");
  await page.getByRole("button", { name: /English/ }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("weekly-review");
  await page
    .getByRole("textbox", {
      name: "What do I want to remember from this week?",
      exact: true,
    })
    .fill("SYNTHETIC: a calm afternoon");
  await page
    .getByRole("button", { name: "Save weekly reflection", exact: true })
    .click();
  await expect(
    page.getByText("Weekly reflection saved on this device.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("heading", { name: "What I want to take with me", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("weekly-reflection-en-320.png"),
    fullPage: true,
  });
});
