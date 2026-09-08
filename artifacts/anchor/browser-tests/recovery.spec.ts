import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// All records belong to an isolated test context. No production/user storage is opened.
async function rows(page: Page, store: string) {
  return page.evaluate(async (storeName) => {
    const names = await indexedDB.databases();
    const name =
      names.find((item) => item.name?.includes("anchor"))?.name ??
      names[0]?.name;
    if (!name) throw new Error("Application database missing");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
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

test("plan draft survives Settings, then goal and signal persist in the offline action card", async ({
  page,
  context,
}) => {
  await page.goto("recovery-plan");
  const warning = page.getByRole("textbox", {
    name: "Mijn waarschuwingssignalen",
    exact: true,
  });
  await warning.fill("SYNTHETIC: ik zonder mij af");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Contacten toevoegen of wijzigen in Instellingen",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Steunpersoon toevoegen", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(warning).toHaveValue("SYNTHETIC: ik zonder mij af");
  await page
    .getByRole("button", { name: "Doel toevoegen", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Middel of gedrag", exact: true })
    .selectOption("Alcohol");
  await page
    .getByRole("combobox", { name: "Mijn richting", exact: true })
    .selectOption("reduction");
  await page
    .getByRole("textbox", { name: "Wat wil ik bereiken?", exact: true })
    .fill("SYNTHETIC: mijn eigen afspraak");
  await page.getByText("Van signaal naar actie", { exact: true }).click();
  await page
    .getByRole("button", { name: "Signaal en actie toevoegen", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Ik herken dit signaal", exact: true })
    .fill("SYNTHETIC: ik trek mij terug");
  await page
    .getByRole("textbox", { name: "Mijn eerste stap", exact: true })
    .fill("SYNTHETIC: bel mijn steunpersoon");
  await page
    .getByRole("button", { name: "Herstelplan opslaan", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", {
      name: "Offline opgeslagen op dit apparaat",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(warning).toHaveValue("SYNTHETIC: ik zonder mij af");
  await expect(
    page.getByRole("combobox", { name: "Middel of gedrag", exact: true }),
  ).toHaveValue("Alcohol");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto("action-card");
  await expect(
    page.getByText("SYNTHETIC: bel mijn steunpersoon", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Ik heb nu hulp nodig", exact: true })
    .click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
});

test("quick intensity has keyboard support and can remain unanswered; danger help needs no other answers", async ({
  page,
}) => {
  await page.goto("quick");
  await page
    .getByRole("button", { name: "Er is direct gevaar", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Bel 112", exact: true }),
  ).toBeVisible();
  const zero = page.getByRole("radio", {
    name: "Intensiteit nu 0/10",
    exact: true,
  });
  await zero.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Intensiteit nu 1/10", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End");
  await expect(
    page.getByRole("radio", { name: "Intensiteit nu 10/10", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Laat deze score onbeantwoord", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Trek of drang", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Voor nu veilig", exact: true })
    .click();
  await page
    .getByRole("button", { name: "10 minuten pauzeren", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Snelle registratie opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Snelle registratie opgeslagen", { exact: true }),
  ).toBeVisible();
  const features = await rows(page, "featureRecords");
  const quick = features.filter(
    (item) => item.recordType === "quick-registration",
  );
  expect(quick).toHaveLength(1);
  expect(quick[0].intensity).toBeNull();
});

test("journal note-only save returns to journal and preserves null scores after reload", async ({
  page,
}) => {
  await page.goto("journal/new");
  await page
    .getByRole("textbox", { name: "Wat houdt je bezig?", exact: true })
    .fill("SYNTHETIC note-only journal");
  await page
    .getByRole("button", { name: "Invoer opslaan", exact: true })
    .click();
  await expect(page).toHaveURL(/\/journal$/);
  await page.reload();
  await expect(
    page.getByText("SYNTHETIC note-only journal", { exact: true }),
  ).toBeVisible();
  const journal = await rows(page, "journal");
  expect(journal).toHaveLength(1);
  expect(journal[0]).toMatchObject({
    mood: null,
    cravingIntensity: null,
    note: "SYNTHETIC note-only journal",
  });
});

test("failed draft writes retain visible input and error across navigation, then recover", async ({
  page,
}) => {
  await page.goto("recovery-plan");
  const warning = page.getByRole("textbox", {
    name: "Mijn waarschuwingssignalen",
    exact: true,
  });
  await expect(warning).toBeEditable();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).restoreSyntheticPut = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function (value: any, ...args: any[]) {
      if (value?.key === "draft:recovery-plan")
        throw new DOMException("Synthetic test quota", "QuotaExceededError");
      return original.call(this, value, ...args);
    };
  });
  await warning.fill("SYNTHETIC: keep this failed draft");
  await expect(
    page.getByText(/Het concept kon niet worden bewaard/),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Contacten toevoegen of wijzigen in Instellingen",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Steunpersoon toevoegen", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(warning).toHaveValue("SYNTHETIC: keep this failed draft");
  await expect(
    page.getByText(/Het concept kon niet worden bewaard/),
  ).toBeVisible();
  await page.evaluate(() => (window as any).restoreSyntheticPut());
  await page
    .getByRole("button", { name: "Opnieuw proberen", exact: true })
    .click();
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Herstelplan opslaan", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", {
      name: "Offline opgeslagen op dit apparaat",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(warning).toHaveValue("SYNTHETIC: keep this failed draft");
});

test("backup preview blocks malformed contacts without replacing saved support data", async ({
  page,
}) => {
  await page.goto("settings");
  await page
    .getByRole("button", { name: "Steunpersoon toevoegen", exact: true })
    .click();
  const contact = page.getByRole("group", {
    name: "Contact en afspraken",
    exact: true,
  });
  await contact
    .getByRole("textbox", { name: "Naam", exact: true })
    .fill("SYNTHETIC Support");
  await contact
    .getByRole("textbox", { name: "Telefoonnummer", exact: true })
    .fill("0000000000");
  await contact.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(contact).toHaveCount(0);
  const before = await rows(page, "settings");
  const payload = {
    version: 3,
    journal: [],
    cigaretteLogs: [],
    cravingLogs: [],
    relapseLogs: [],
    anxietyLogs: [],
    boredomLogs: [],
    checkIns: [],
    featureRecords: [],
    settings: [{ key: "emergencyContacts", value: "not valid JSON" }],
  };
  await page
    .getByLabel("JSON-back-up kiezen")
    .setInputFiles({
      name: "synthetic-invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });
  await expect(
    page.getByText("Import geblokkeerd; er is niets gewijzigd.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Herstel bevestigen", exact: true }),
  ).toHaveCount(0);
  const after = await rows(page, "settings");
  expect(after.find((row) => row.key === "emergencyContacts")).toEqual(
    before.find((row) => row.key === "emergencyContacts"),
  );
  await page.reload();
  await expect(
    page.getByText("SYNTHETIC Support", { exact: true }),
  ).toBeVisible();
});

for (const width of [320, 390, 1280]) {
  test(`all routes render without horizontal overflow or runtime errors at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of [
      "",
      "help",
      "action-card",
      "quick",
      "recovery-plan",
      "home-customization",
      "actions",
      "weekly-review",
      "report",
      "trek",
      "craving",
      "relapse",
      "tools",
      "tools/breathing",
      "tools/grounding",
      "tools/urge-surfing",
      "tools/tape",
      "tools/cold-water",
      "tools/self-compassion",
      "tools/distraction",
      "anxiety",
      "boredom",
      "delay",
      "registraties",
      "journal",
      "journal/new",
      "insights",
      "settings",
      "more",
      "privacy",
    ]) {
      await page.goto(route || "./");
      await expect(page.locator("main.app-main")).not.toHaveText("Anchor…");
      await expect(page.locator("main.app-main")).not.toBeEmpty();
      await expect(page.getByRole('heading', {name: 'Dit scherm kon niet worden geopend', exact: true})).toHaveCount(0);
      await expect(page.getByRole('heading', {name: 'Je gegevens zijn nu niet beschikbaar', exact: true})).toHaveCount(0);
      await expect(page.locator('main.app-main h1').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `Horizontal overflow on ${route}`).toBe(false);
      await expect(
        page.getByRole("link", { name: "Nu hulp", exact: true }).first(),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
    expect(
      await page.locator('meta[name="viewport"]').getAttribute("content"),
    ).not.toMatch(/user-scalable=no|maximum-scale=1/);
  });
}

test('200 percent text preserves an unobstructed Save button and reset dialog keyboard focus', async ({page}) => {
  await page.goto('quick');
  await page.getByRole('button',{name:'Trek of drang',exact:true}).click();
  await page.getByRole('button',{name:'Voor nu veilig',exact:true}).click();
  await page.getByRole('button',{name:'10 minuten pauzeren',exact:true}).click();
  await page.evaluate(()=>{document.documentElement.style.fontSize='32px'});
  const save=page.getByRole('button',{name:'Snelle registratie opslaan',exact:true});
  await save.click({trial:true});
  expect(await save.evaluate(el=>el.getBoundingClientRect().bottom <= document.querySelector('footer')!.getBoundingClientRect().top)).toBe(true);
  await page.goto('settings');
  await page.getByRole('button',{name:/^Alle gegevens verwijderen/}).click();
  const dialog=page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^Alle gegevens verwijderen/})).toBeFocused();
});

test('old v9 tab blocks upgrade visibly; closing it preserves data and excludes old writers', async ({page,context}) => {
  const legacy=await context.newPage();
  await legacy.route('**/synthetic-legacy-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic legacy fixture</title><p>Test fixture</p>'}));
  await legacy.goto('synthetic-legacy-fixture');
  await legacy.evaluate(async()=>{
    (window as any).legacyDb=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('anchor-recovery',9);
      request.onupgradeneeded=()=>{
        const db=request.result;
        for(const name of ['journal','cravingLogs','relapseLogs','anxietyLogs','boredomLogs','cigaretteLogs','featureRecords']) {
          const store=db.createObjectStore(name,{keyPath:'id'});store.createIndex('byTimestamp','timestamp');
          if(name==='featureRecords')store.createIndex('byRecordType','recordType');
        }
        db.createObjectStore('checkIns',{keyPath:'id'}).createIndex('byDate','date');
        db.createObjectStore('settings',{keyPath:'key'});db.createObjectStore('syncMeta',{keyPath:'key'});db.createObjectStore('dirtyRecords',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const db=(window as any).legacyDb as IDBDatabase;
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('journal','readwrite');tx.objectStore('journal').put({id:'legacy-fixture',timestamp:1700000000000,mood:3,cravingIntensity:5,note:'SYNTHETIC legacy note',toolUsed:null});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});
  });
  await page.goto('./');
  await expect(page.getByRole('heading',{name:'Sluit andere Anchor-vensters',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Nu hulp',exact:true}).first().click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await legacy.close();
  await page.getByRole('link',{name:'Mijn actiekaart',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'Je gegevens zijn klaar om opnieuw te openen',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Opnieuw openen / herladen',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Mijn eerste stap',exact:true})).toBeVisible();
  expect(await rows(page,'journal')).toMatchObject([{id:'legacy-fixture',mood:3,cravingIntensity:5,note:'SYNTHETIC legacy note'}]);
  const oldError=await page.evaluate(()=>new Promise<string>((resolve)=>{const request=indexedDB.open('anchor-recovery',9);request.onerror=()=>resolve(request.error!.name);request.onsuccess=()=>{request.result.close();resolve('unexpected success')}}));
  expect(oldError).toBe('VersionError');
});

test('downloaded backup restores through explicit replacement and reload without duplicate entries', async ({page}) => {
  await page.goto('journal/new');
  await page.getByRole('textbox',{name:'Wat houdt je bezig?',exact:true}).fill('SYNTHETIC backup original');
  await page.getByRole('button',{name:'Invoer opslaan',exact:true}).click();
  await page.waitForURL('**/journal');
  await page.goto('settings');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exporteren naar bestand',exact:true}).click();
  const download=await downloadPromise;
  const backup=await readFile((await download.path())!);
  const payload=JSON.parse(backup.toString('utf8'));
  expect(payload.version).toBe(3);expect(payload.journal).toHaveLength(1);
  await page.goto('journal/new');
  await page.getByRole('textbox',{name:'Wat houdt je bezig?',exact:true}).fill('SYNTHETIC later entry');
  await page.getByRole('button',{name:'Invoer opslaan',exact:true}).click();
  await page.waitForURL('**/journal');
  expect(await rows(page,'journal')).toHaveLength(2);
  await page.goto('settings');
  await page.getByLabel('JSON-back-up kiezen').setInputFiles({name:'synthetic-valid.json',mimeType:'application/json',buffer:backup});
  await page.getByRole('radio',{name:/^Vervangen:/}).check();
  const confirm=page.getByRole('button',{name:'Herstel bevestigen',exact:true});
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox',{name:/^Ik begrijp dat huidige gegevens/}).check();
  await Promise.all([page.waitForEvent('load'),confirm.click()]);
  await expect(page.getByRole('heading',{name:'Instellingen',exact:true})).toBeVisible();
  expect(await rows(page,'journal')).toEqual(payload.journal);
  await page.goto('journal');
  await expect(page.getByText('SYNTHETIC backup original',{exact:true})).toBeVisible();
  await expect(page.getByText('SYNTHETIC later entry',{exact:true})).toHaveCount(0);
});
