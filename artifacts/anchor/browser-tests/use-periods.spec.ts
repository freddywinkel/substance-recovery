import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Every write below belongs to an isolated, synthetic Playwright context.
async function rows(page: Page, store = "featureRecords"): Promise<any[]> {
  return page.evaluate(async (storeName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, store);
}

async function seed(page: Page, values: Record<string, any[]>) {
  await page.evaluate(async (records) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(Object.keys(records), "readwrite");
        for (const [store, entries] of Object.entries(records))
          for (const entry of entries) tx.objectStore(store).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, values);
  await page.reload();
}

async function day(page: Page, daysAgo: number): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }, daysAgo);
}

function planSetting(targets = ["Alcohol"], startDate = "") {
  return {
    key: "recoveryPlan",
    value: JSON.stringify({
      version: 1, warningSigns: [], reasonsForRecovery: [], situationsToAvoid: [],
      trustedContactIds: [], callMessage: "SYNTHETIC support", next24Hours: [], updatedAt: Date.now(),
      prevention: {
        version: 1, revision: 1,
        goals: targets.map((target, index) => ({
          id: `synthetic-goal-${index}`, target, type: "abstinence",
          description: `SYNTHETIC goal ${target}`, startDate, active: true, showProgress: true,
        })),
        signalActions: [], strengths: "", routines: "", careAgreements: "", medicalPrecautions: "",
        afterUse: "", aftercare: "", reviewDate: "", reviewedWith: "", sharingPreferences: "",
        changeReason: "", revisions: [],
      },
    }),
  };
}

function period(id: string, target: string, startDate: string, endDate: string, frequency = "daily", note = "") {
  const now = Date.now();
  return { id, recordType: "use-period", timestamp: now, updatedAt: now, target, startDate, endDate, frequency, note };
}

function quick(id: string, target: string, date: string) {
  const timestamp = new Date(`${date}T12:00:00`).getTime();
  return {
    id, recordType: "quick-registration", timestamp, updatedAt: timestamp,
    occurredAt: timestamp, createdAt: timestamp, registrationType: "relapse",
    intensity: null, target, useOutcome: "used", usePrescribed: false,
    immediateSafety: "safe-for-now", chosenAction: "Pause for 10 minutes", chosenActionOther: "", note: "",
    reflectionStatus: "dismissed", reflectionDueAt: timestamp,
    reflectionStartedAt: null, reflectionCompletedAt: null, linkedDetailedRecordId: null,
  };
}

async function fillPeriod(page: Page, first: string, last: string, frequency = "daily", target = "Alcohol", note = "") {
  await page.getByRole("combobox", { name: "Middel of gedrag", exact: true }).selectOption(target);
  await page.getByLabel("Eerste gebruiksdag", { exact: true }).fill(first);
  await page.getByLabel("Laatste gebruiksdag", { exact: true }).fill(last);
  await page.getByRole("combobox", { name: "Hoe vaak in deze periode?", exact: true }).selectOption(frequency);
  if (note) await page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true }).fill(note);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByText("Gebruik bewaard.", { exact: true })).toBeVisible();
}

async function draftSaved(page: Page) {
  await expect(page.getByText("Concept lokaal bewaard. Nog niet afgerond.", { exact: true })).toBeVisible();
}

test("a fourteen-day daily gap survives help and reload, saves offline, and creates one period", async ({ page, context }, testInfo) => {
  await page.goto("use-periods/new");
  await seed(page, { settings: [planSetting()] });
  const first = await day(page, 13);
  const last = await day(page, 0);
  await page.getByRole("combobox", { name: "Middel of gedrag", exact: true }).selectOption("Alcohol");
  await page.getByRole("button", { name: "Afgelopen 2 weken", exact: true }).click();
  await expect(page.getByLabel("Eerste gebruiksdag", { exact: true })).toHaveValue(first);
  await expect(page.getByLabel("Laatste gebruiksdag", { exact: true })).toHaveValue(last);
  await page.getByRole("combobox", { name: "Hoe vaak in deze periode?", exact: true }).selectOption("daily");
  await page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true }).fill("SYNTHETIC: two weeks without individual entries");
  await draftSaved(page);
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true })).toHaveValue("SYNTHETIC: two weeks without individual entries");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect(page.getByLabel("Eerste gebruiksdag", { exact: true })).toHaveValue(first);
  expect(await rows(page)).toEqual([]);
  await context.setOffline(true);
  await save(page);
  const saved = await rows(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ recordType: "use-period", target: "Alcohol", startDate: first, endDate: last, frequency: "daily" });
  expect(Object.keys(saved[0]).sort()).toEqual(["endDate", "frequency", "id", "note", "recordType", "startDate", "target", "timestamp", "updatedAt"]);
  for (const store of ["cravingLogs", "relapseLogs", "anxietyLogs", "boredomLogs"])
    expect(await rows(page, store)).toEqual([]);
  await page.getByRole("link", { name: "Terug naar Thuis", exact: true }).click();
  const goals = page.getByRole("region", { name: "Mijn doelen en traject", exact: true });
  await expect(goals.getByText("Vastgelegd gebruik: 1", { exact: true })).toBeVisible();
  await expect(goals.getByText("Gemelde gebruiksdagen: 14", { exact: true })).toBeVisible();
  await expect(goals.getByText("0 losse momenten + 1 achteraf vastgelegde perioden", { exact: true })).toBeVisible();
  await goals.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("daily-period-home-nl.png"), fullPage: true });
});

test("some days and unknown frequency preserve uncertainty and only count known boundary days", async ({ page }) => {
  await page.goto("use-periods/new");
  await seed(page, { settings: [planSetting()] });
  const first = await day(page, 20), last = await day(page, 7);
  await fillPeriod(page, first, last, "some-days");
  await save(page);
  await page.goto("./");
  const goals = page.getByRole("region", { name: "Mijn doelen en traject", exact: true });
  await expect(goals.getByText("Vastgelegd gebruik: 1", { exact: true })).toBeVisible();
  await expect(goals.getByText("Gemelde gebruiksdagen: Minstens 2", { exact: true })).toBeVisible();
  const record = (await rows(page))[0];
  await page.goto(`use-periods/${encodeURIComponent(record.id)}/edit`);
  await page.getByRole("combobox", { name: "Hoe vaak in deze periode?", exact: true }).selectOption("unknown");
  await save(page);
  await page.goto("./");
  await expect(goals.getByText("Gemelde gebruiksdagen: Minstens 2", { exact: true })).toBeVisible();
  expect(await rows(page)).toHaveLength(1);
});

test("matching goals include periods, suppress covered moments in the combined total, and retain other targets", async ({ page }) => {
  await page.goto("./");
  const first = await day(page, 20), last = await day(page, 7), inside = await day(page, 12), outside = await day(page, 25);
  await seed(page, {
    settings: [planSetting(["Alcohol", "Cannabis"])],
    featureRecords: [period("synthetic-alcohol-period", "Alcohol", first, last), quick("synthetic-covered-use", "Alcohol", inside), quick("synthetic-outside-use", "Alcohol", outside), quick("synthetic-cannabis-use", "Cannabis", inside)],
  });
  const goals = page.getByRole("region", { name: "Mijn doelen en traject", exact: true });
  const alcohol = goals.locator("div").filter({ has: page.getByRole("heading", { name: "Alcohol", exact: true }) }).last();
  const cannabis = goals.locator("div").filter({ has: page.getByRole("heading", { name: "Cannabis", exact: true }) }).last();
  await expect(alcohol.getByText("Vastgelegd gebruik: 2", { exact: true })).toBeVisible();
  await expect(alcohol.getByText("1 losse momenten + 1 achteraf vastgelegde perioden", { exact: true })).toBeVisible();
  await expect(alcohol.getByText("Gemelde gebruiksdagen: 15", { exact: true })).toBeVisible();
  await expect(alcohol.getByText(/1 eerder vastgelegde momenten vallen binnen/)).toBeVisible();
  await expect(cannabis.getByText("Vastgelegd gebruik: 1", { exact: true })).toBeVisible();
  await expect(cannabis.getByText("1 losse momenten + 0 achteraf vastgelegde perioden", { exact: true })).toBeVisible();
});

test("a period can be corrected and deleted while individual registrations remain", async ({ page }) => {
  await page.goto("use-periods/new");
  const first = await day(page, 20), last = await day(page, 7);
  await seed(page, { settings: [planSetting()], featureRecords: [quick("synthetic-retained-event", "Alcohol", await day(page, 12))] });
  await fillPeriod(page, first, last, "daily", "Alcohol", "SYNTHETIC original period");
  await save(page);
  const original = (await rows(page)).find(row => row.recordType === "use-period");
  await page.goto("use-periods");
  await page.getByRole("link", { name: "Periode bewerken", exact: true }).click();
  await page.getByLabel("Eerste gebruiksdag", { exact: true }).fill(await day(page, 15));
  await page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true }).fill("SYNTHETIC corrected period");
  await save(page);
  const changed = (await rows(page)).find(row => row.recordType === "use-period");
  expect(changed).toMatchObject({ id: original.id, timestamp: original.timestamp, startDate: await day(page, 15), note: "SYNTHETIC corrected period" });
  await page.goto("use-periods");
  await page.getByRole("button", { name: "Periode verwijderen", exact: true }).click();
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  expect((await rows(page)).filter(row => row.recordType === "use-period")).toHaveLength(1);
  await page.getByRole("button", { name: "Periode verwijderen", exact: true }).click();
  await page.getByRole("button", { name: "Ja, verwijderen", exact: true }).click();
  await expect(page.getByText(/Nog geen gebruik achteraf vastgelegd/)).toBeVisible();
  expect(await rows(page)).toMatchObject([{ id: "synthetic-retained-event", recordType: "quick-registration" }]);
  await page.goto("./");
  await expect(page.getByText("1 losse momenten + 0 achteraf vastgelegde perioden", { exact: true })).toBeVisible();
});

test("overlap blocks duplicate use but retains the draft and offers the existing period", async ({ page }) => {
  await page.goto("use-periods/new");
  const first = await day(page, 20), last = await day(page, 7);
  await fillPeriod(page, first, last);
  await save(page);
  const original = (await rows(page))[0];
  await page.getByRole("button", { name: "Nog een periode vastleggen", exact: true }).click();
  await fillPeriod(page, await day(page, 10), await day(page, 5), "unknown", "Alcohol", "SYNTHETIC overlapping draft");
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Er staat al een periode");
  await expect(page.getByRole("link", { name: "Bestaande periode bewerken", exact: true })).toHaveAttribute("href", new RegExp(`${encodeURIComponent(original.id)}/edit$`));
  await expect(page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true })).toHaveValue("SYNTHETIC overlapping draft");
  await draftSaved(page);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true })).toHaveValue("SYNTHETIC overlapping draft");
  expect(await rows(page)).toEqual([original]);
});

test("missing, reversed and future dates cannot save and do not discard input", async ({ page }) => {
  await page.goto("use-periods/new");
  await page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true }).fill("SYNTHETIC retained invalid input");
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Kies een middel of gedrag");
  await fillPeriod(page, await day(page, 5), await day(page, 10));
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("op of na de eerste dag");
  await page.getByLabel("Laatste gebruiksdag", { exact: true }).fill(await day(page, -1));
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("mag niet in de toekomst");
  await draftSaved(page);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true })).toHaveValue("SYNTHETIC retained invalid input");
  expect(await rows(page)).toEqual([]);
});

test("failed writes preserve input and retry saves one period", async ({ page }) => {
  await page.goto("use-periods/new");
  await fillPeriod(page, await day(page, 20), await day(page, 7), "daily", "Alcohol", "SYNTHETIC retry input");
  await draftSaved(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "featureRecords" && !failed) {
        failed = true;
        throw new DOMException("Synthetic write failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Opslaan is niet gelukt");
  await expect(page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true })).toHaveValue("SYNTHETIC retry input");
  expect(await rows(page)).toEqual([]);
  await save(page);
  expect(await rows(page)).toHaveLength(1);
});

test("a deletion in another window cannot be revived by a stale draft, and deliberate discard reloads history", async ({ page, context }) => {
  await page.goto("use-periods/new");
  await fillPeriod(page, await day(page, 20), await day(page, 7), "daily", "Alcohol", "SYNTHETIC original period");
  await save(page);
  const original = (await rows(page))[0];
  await page.goto(`use-periods/${encodeURIComponent(original.id)}/edit`);
  const note = page.getByRole("textbox", { name: "Notitie (optioneel)", exact: true });
  await note.fill("SYNTHETIC unfinished stale correction");
  await draftSaved(page);
  const other = await context.newPage();
  await other.goto("use-periods");
  await other.getByRole("button", { name: "Periode verwijderen", exact: true }).click();
  await other.getByRole("button", { name: "Ja, verwijderen", exact: true }).click();
  await expect(other.getByText(/Nog geen gebruik achteraf vastgelegd/)).toBeVisible();
  await page.getByRole("button", { name: "Gebruik opslaan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("in een ander venster gewijzigd of verwijderd");
  await expect(note).toHaveValue("SYNTHETIC unfinished stale correction");
  expect(await rows(page)).toEqual([]);
  await page.getByRole("button", { name: "Concept wissen en gegevens opnieuw laden", exact: true }).click();
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  await expect(note).toHaveValue("SYNTHETIC unfinished stale correction");
  await page.getByRole("button", { name: "Concept wissen en gegevens opnieuw laden", exact: true }).click();
  await page.getByRole("button", { name: "Ja, concept wissen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gebruik achteraf", exact: true })).toBeVisible();
  await expect(page.getByText(/Nog geen gebruik achteraf vastgelegd/)).toBeVisible();
  expect(await rows(page)).toEqual([]);
  await other.close();
});

test("an optional goal start can stay empty while progress is visible", async ({ page }) => {
  await page.goto("recovery-plan");
  await page.getByRole("button", { name: "Doel toevoegen", exact: true }).click();
  await page.getByRole("combobox", { name: "Middel of gedrag", exact: true }).selectOption("Alcohol");
  await page.getByRole("textbox", { name: "Wat wil ik bereiken?", exact: true }).fill("SYNTHETIC goal without a start date");
  await expect(page.getByLabel("Startdatum (optioneel)", { exact: true })).toHaveValue("");
  await page.getByRole("checkbox", { name: "Toon mijn vastgelegde voortgang", exact: true }).check();
  await page.getByRole("button", { name: "Herstelplan opslaan", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Offline opgeslagen op dit apparaat", exact: true })).toBeVisible();
  await page.goto("./");
  await expect(page.getByRole("region", { name: "Mijn doelen en traject", exact: true }).getByText("SYNTHETIC goal without a start date", { exact: true })).toBeVisible();
});

test("reports omit retrospective use by default and include crossing periods and notes only by choice", async ({ page }, testInfo) => {
  await page.goto("report");
  const first = await day(page, 25), last = await day(page, 5);
  await seed(page, { featureRecords: [
    period("synthetic-crossing-period", "Alcohol", first, last, "some-days", "SYNTHETIC PRIVATE retrospective note"),
    period("synthetic-outside-period", "Cannabis", await day(page, 40), await day(page, 35), "unknown", "SYNTHETIC OUTSIDE note"),
  ] });
  await page.getByLabel("Van", { exact: true }).fill(await day(page, 20));
  await page.getByLabel("Tot en met", { exact: true }).fill(await day(page, 10));
  const report = page.locator(".print-root");
  const checkbox = page.getByRole("checkbox", { name: "Gebruik achteraf (perioden)", exact: true });
  await expect(checkbox).not.toBeChecked();
  await expect(report.getByRole("heading", { name: "Gebruik achteraf (perioden)", exact: true })).toHaveCount(0);
  await expect(report.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Notities bij registraties", exact: true }).check();
  await expect(report.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Notities bij registraties", exact: true }).uncheck();
  await checkbox.check();
  const periods = report.getByRole("region", { name: "Gebruik achteraf (perioden)", exact: true });
  await expect(periods.getByText("Gemelde gebruiksperioden die dit bereik overlappen: 1", { exact: true })).toBeVisible();
  await expect(periods.getByText("Alcohol", { exact: true })).toBeVisible();
  await expect(periods.getByText("Deel binnen dit verslagbereik", { exact: true })).toBeVisible();
  await expect(periods.locator(`time[datetime="${first}"]`)).toBeVisible();
  await expect(periods.locator(`time[datetime="${last}"]`)).toBeVisible();
  await expect(periods.getByText("Op sommige dagen; precieze dagen niet vastgelegd", { exact: true })).toBeVisible();
  await expect(report.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toHaveCount(0);
  await expect(report.getByText("SYNTHETIC OUTSIDE note", { exact: true })).toHaveCount(0);
  const registrationSummary = report.getByRole("region", { name: "Samenvattende aantallen (registraties en ondersteunende acties)", exact: true });
  await expect(registrationSummary.getByText("0", { exact: true })).toHaveCount(2);
  await page.getByRole("checkbox", { name: "Notities bij registraties", exact: true }).check();
  await expect(periods.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(periods.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toBeVisible();
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await testInfo.attach("selected-use-period-report.pdf", { body: pdf, contentType: "application/pdf" });
  await page.emulateMedia({ media: "screen" });
  for (const option of await page.getByRole("checkbox").all())
    if (await option.isChecked()) await option.uncheck();
  await checkbox.check();
  await expect(page.getByRole("button", { name: "Afdrukken of als pdf bewaren", exact: true })).toBeEnabled();
  await expect(report.getByText("Selecteer ten minste één onderdeel voordat je afdrukt.", { exact: true })).toHaveCount(0);
  await expect(report.getByRole("heading", { name: "Registraties", exact: true })).toHaveCount(0);
  await expect(periods.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toHaveCount(0);
  await checkbox.uncheck();
  await expect(report.getByText("SYNTHETIC PRIVATE retrospective note", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Afdrukken of als pdf bewaren", exact: true })).toBeDisabled();
});

test("backup overlap blocks merging without changing data and permits an acknowledged replacement", async ({ page }) => {
  await page.goto("settings");
  const original = period("synthetic-existing-backup-period", "Alcohol", await day(page, 25), await day(page, 12), "daily", "SYNTHETIC original backup period");
  await seed(page, { featureRecords: [original] });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporteren naar bestand", exact: true }).click();
  const payload = JSON.parse((await readFile((await (await download).path())!)).toString());
  expect(payload.featureRecords).toEqual([original]);
  const incoming = period("synthetic-incoming-backup-period", "Alcohol", await day(page, 15), await day(page, 8), "some-days", "SYNTHETIC replacement period");
  payload.featureRecords = [incoming];
  await page.getByLabel("JSON-back-up kiezen", { exact: true }).setInputFiles({
    name: "synthetic-use-periods.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)),
  });
  const panel = page.getByRole("region", { name: "Back-up controleren en herstellen", exact: true });
  await expect(panel.getByRole("alert")).toContainText("overlap");
  await expect(panel.getByRole("button", { name: "Herstel bevestigen", exact: true })).toBeDisabled();
  expect(await rows(page)).toEqual([original]);
  await panel.getByRole("radio", { name: /^Vervangen:/ }).check();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Herstel bevestigen", exact: true })).toBeDisabled();
  await panel.getByRole("checkbox", { name: "Ik begrijp dat huidige gegevens die niet in dit bestand staan worden verwijderd.", exact: true }).check();
  const reloaded = page.waitForEvent("load");
  await panel.getByRole("button", { name: "Herstel bevestigen", exact: true }).click();
  await reloaded;
  await expect(page.getByRole("heading", { name: "Back-up controleren en herstellen", exact: true })).toBeVisible();
  expect(await rows(page)).toEqual([incoming]);
  await page.goto("use-periods");
  await expect(page.getByText("SYNTHETIC replacement period", { exact: true })).toBeVisible();
});

for (const language of ["nl", "en"] as const) {
  test(`${language} retrospective editor, history and report fit a 360px screen`, async ({ page }, testInfo) => {
    await page.goto("use-periods/new");
    await seed(page, { featureRecords: [period("synthetic-responsive-period", "Cocaine / stimulant", await day(page, 20), await day(page, 7), "unknown", "SYNTHETIC responsive note")] });
    if (language === "en") {
      await page.goto("settings");
      await page.getByRole("button", { name: /English/ }).click();
    }
    await page.setViewportSize({ width: 360, height: 780 });
    for (const [route, heading] of [
      ["use-periods/new", language === "nl" ? "Gebruik achteraf vastleggen" : "Record use retrospectively"],
      ["use-periods", language === "nl" ? "Gebruik achteraf" : "Retrospective use"],
      ["report", language === "nl" ? "Afdrukbaar verslag" : "Printable report"],
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (route === "report") await page.getByRole("checkbox", { name: language === "nl" ? "Gebruik achteraf (perioden)" : "Retrospective use (periods)", exact: true }).check();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${language}-${route.replaceAll("/", "-")}-360.png`), fullPage: true });
      if (route === "use-periods/new") {
        await page.getByRole("button", { name: language === "nl" ? "Gebruik opslaan" : "Save use", exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${language}-use-period-editor-bottom-360.png`), fullPage: true });
      }
      if (route === "report") {
        await page.locator(".print-root").getByRole("heading", { name: language === "nl" ? "Gebruik achteraf (perioden)" : "Retrospective use (periods)", exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${language}-use-period-report-preview-360.png`), fullPage: true });
      }
    }
  });
}
