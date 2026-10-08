import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Isolated synthetic browser storage only; never inspect a user's records.
async function rows(page: Page, name = "featureRecords") {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anchor-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, name);
}
const prompt = "Wat voelde prettig, gaf ruimte of wil je onthouden?";
async function keepMoment(page: Page, text: string, favourite = false) {
  await page.goto("moments/new");
  await page.getByRole("textbox", { name: prompt, exact: true }).fill(text);
  if (favourite)
    await page
      .getByRole("checkbox", {
        name: "Als herinnering op Thuis tonen",
        exact: true,
      })
      .check();
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Moment bewaard.", { exact: true }),
  ).toBeVisible();
}

test("a moment needs no symptoms; a draft survives help and an offline save makes one record", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("moments/new");
  const note = page.getByRole("textbox", { name: prompt, exact: true });
  await expect(note).toBeEnabled();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByRole("combobox")).toHaveValue("");
  await expect(
    page.getByText(/Wat heeft dit uitgelokt|craving_q|Hoe sterk is je craving/),
  ).toHaveCount(0);
  await note.fill("SYNTHETIC: samen gelachen tijdens de lunch");
  await page.getByRole("combobox").selectOption("connection");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Nu hulp", exact: true }).click();
  await expect(page.locator('a[href="tel:112"]').first()).toBeVisible();
  await page.goBack();
  await expect(note).toHaveValue("SYNTHETIC: samen gelachen tijdens de lunch");
  await page.reload();
  await expect(page.getByRole("combobox")).toHaveValue("connection");
  expect(await rows(page)).toHaveLength(0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Moment bewaard.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Klaar voor nu", exact: true }).click();
  await expect(
    page.getByText("SYNTHETIC: samen gelachen tijdens de lunch", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await rows(page)).toMatchObject([
    { recordType: "growth-moment", category: "connection", favourite: false },
  ]);
  await page.screenshot({
    path: testInfo.outputPath("growth-mobile-nl.png"),
    fullPage: true,
  });
});

test("only chosen favourites appear on Home; edit, unfavourite and confirmed deletion persist", async ({
  page,
}, testInfo) => {
  await keepMoment(page, "SYNTHETIC: ik nam ruimte voor mezelf");
  const original = (await rows(page))[0];
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Wat ik opbouw", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(original.note, { exact: true })).toHaveCount(0);
  await page
    .getByRole("link", { name: "Herinner me aan mijn groei", exact: true })
    .click();
  await expect(page.getByText(/Nog geen herinneringen gekozen/)).toBeVisible();
  await page
    .getByRole("button", { name: "Alle momenten", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Als herinnering op Thuis tonen",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Niet meer als herinnering op Thuis tonen",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("link", { name: "Moment bewerken", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: prompt, exact: true })
    .fill("SYNTHETIC: ik koos bewust rust");
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Moment bewaard.", { exact: true }),
  ).toBeVisible();
  const edited = (await rows(page))[0];
  expect(edited.id).toBe(original.id);
  expect(edited.timestamp).toBe(original.timestamp);
  await page.goto("./");
  const card = page.getByRole("region", { name: "Wat ik opbouw", exact: true });
  await expect(card.getByText(edited.note, { exact: true })).toBeVisible();
  await card.screenshot({ path: testInfo.outputPath("growth-home-card.png") });
  await page.goto("growth");
  await page
    .getByRole("button", {
      name: "Niet meer als herinnering op Thuis tonen",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Als herinnering op Thuis tonen",
      exact: true,
    }),
  ).toBeEnabled();
  await page.goto("./");
  await expect(page.getByText(edited.note, { exact: true })).toHaveCount(0);
  await page.goto("growth");
  await page
    .getByRole("button", { name: "Moment verwijderen", exact: true })
    .click();
  expect(await rows(page)).toHaveLength(1);
  await page.getByRole("button", { name: "Annuleren", exact: true }).click();
  await page
    .getByRole("button", { name: "Moment verwijderen", exact: true })
    .click();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await expect(
    page.getByText(
      "Hier is nog niets opgeslagen. Je hoeft nu niets te bedenken.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(0);
});

test("skip does not create records, and clearing a draft does not delete saved memories", async ({
  page,
}) => {
  await keepMoment(page, "SYNTHETIC: keep this saved moment");
  await page.goto("moments/new");
  await page
    .getByRole("button", { name: "Vandaag weet ik niets", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Wat ik opbouw", exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(1);
  await page.goto("moments/new");
  const note = page.getByRole("textbox", { name: prompt, exact: true });
  await note.fill("SYNTHETIC unfinished");
  await page.getByRole("button", { name: "Overslaan", exact: true }).click();
  await page.goto("moments/new");
  await expect(note).toHaveValue("SYNTHETIC unfinished");
  await page
    .getByRole("button", { name: "Concept wissen", exact: true })
    .click();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await expect(note).toHaveValue("");
  expect(await rows(page)).toHaveLength(1);
});

test("discarding another moment starts a new identity without reusing the saved moment", async ({
  page,
}) => {
  await keepMoment(page, "SYNTHETIC: saved moment A");
  const first = (await rows(page))[0];
  await page
    .getByRole("button", { name: "Nog een moment bewaren", exact: true })
    .click();
  const note = page.getByRole("textbox", { name: prompt, exact: true });
  await note.fill("SYNTHETIC: discarded draft B");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Concept wissen", exact: true })
    .click();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await expect(note).toHaveValue("");
  await note.fill("SYNTHETIC: saved moment C");
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Moment bewaard.", { exact: true }),
  ).toBeVisible();
  const saved = await rows(page);
  expect(saved).toHaveLength(2);
  expect(saved.find((entry) => entry.id === first.id)).toEqual(first);
  expect(saved.find((entry) => entry.id !== first.id)).toMatchObject({
    recordType: "growth-moment",
    note: "SYNTHETIC: saved moment C",
  });
  expect(
    saved.some((entry) => entry.note === "SYNTHETIC: discarded draft B"),
  ).toBe(false);
});

test("failed save and failed cleanup keep input; retry never duplicates a moment", async ({
  page,
}) => {
  await page.goto("moments/new");
  const note = page.getByRole("textbox", { name: prompt, exact: true });
  await note.fill("SYNTHETIC retained input");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failedWrite = false,
      failedCleanup = false;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "featureRecords" && !failedWrite) {
        failedWrite = true;
        throw new DOMException("Synthetic write failure", "QuotaExceededError");
      }
      if (
        this.name === "settings" &&
        args[0]?.key === "draft:growth-moment:new" &&
        args[0]?.value === "" &&
        !failedCleanup
      ) {
        failedCleanup = true;
        throw new DOMException(
          "Synthetic cleanup failure",
          "QuotaExceededError",
        );
      }
      return original.apply(this, args);
    };
  });
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText(
      "Opslaan is niet gelukt. Je invoer staat hier nog. Probeer opnieuw.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(0);
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText(/Het is opgeslagen, maar het concept/),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(1);
  const original = (await rows(page))[0];
  await page
    .getByRole("button", { name: "Opnieuw proberen", exact: true })
    .click();
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Moment bewaard.", { exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toEqual([original]);
});

test("brief compassion is optional, personal words persist and can be deleted without tracking a tool use", async ({
  page,
}, testInfo) => {
  await page.goto("tools/self-compassion/brief");
  await expect(
    page.getByRole("heading", {
      name: "Even vriendelijk voor mezelf",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Met een kleine handeling", exact: true })
    .click();
  await expect(
    page.getByText(/Misschien wil je comfortabeler zitten/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Stoppen voor nu", exact: true })
    .click();
  expect(await rows(page)).toHaveLength(0);
  await page.goto("tools/self-compassion/brief");
  await page
    .getByText("Mijn eigen zin (optioneel)", { exact: true })
    .first()
    .click();
  const words = page.getByRole("textbox", {
    name: "Mijn eigen zin (optioneel)",
    exact: true,
  });
  await words.fill("SYNTHETIC: ik mag rustig verder");
  await page
    .getByRole("button", { name: "Mijn zin bewaren", exact: true })
    .click();
  await expect(
    page.getByText("Je eigen zin is bewaard.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("paragraph")
      .filter({ hasText: /^SYNTHETIC: ik mag rustig verder$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("brief-compassion-nl.png"),
    fullPage: true,
  });
  await page
    .getByText("Mijn eigen zin (optioneel)", { exact: true })
    .first()
    .click();
  await words.fill("SYNTHETIC: ik hoef niets te bewijzen");
  await page
    .getByRole("button", { name: "Mijn zin bewaren", exact: true })
    .click();
  await expect(
    page.getByText("Je eigen zin is bewaard.", { exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toMatchObject([
    {
      recordType: "compassion-note",
      text: "SYNTHETIC: ik hoef niets te bewijzen",
    },
  ]);
  await page
    .getByRole("button", {
      name: "Mijn opgeslagen zin verwijderen",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await expect(
    page.getByText("Je opgeslagen zin is verwijderd.", { exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(0);
});

test("a stale edit stays intact until confirmed discard loads the latest version", async ({
  page,
  context,
}) => {
  await keepMoment(page, "SYNTHETIC: original moment");
  const original = (await rows(page))[0];
  await page.goto(`moments/${encodeURIComponent(original.id)}/edit`);
  const note = page.getByRole("textbox", { name: prompt, exact: true });
  await note.fill("SYNTHETIC: my unfinished edit");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();

  const other = await context.newPage();
  await other.goto("growth");
  await other
    .getByRole("button", {
      name: "Als herinnering op Thuis tonen",
      exact: true,
    })
    .click();
  await expect(
    other.getByRole("button", {
      name: "Niet meer als herinnering op Thuis tonen",
      exact: true,
    }),
  ).toBeEnabled();
  const latest = (await rows(other))[0];
  expect(latest.favourite).toBe(true);
  expect(latest.updatedAt).toBeGreaterThan(original.updatedAt);

  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText(/De nieuwere opgeslagen versie is niet overschreven/),
  ).toBeVisible();
  await expect(note).toHaveValue("SYNTHETIC: my unfinished edit");
  await page.reload();
  await expect(note).toHaveValue("SYNTHETIC: my unfinished edit");
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Huidige opgeslagen versie openen",
      exact: true,
    })
    .click();
  const confirmation = page.getByRole("group", {
    name: "Je eigen onafgemaakte bewerking wissen en de huidige opgeslagen versie laden?",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Annuleren", exact: true })
    .click();
  await expect(note).toHaveValue("SYNTHETIC: my unfinished edit");
  expect(await rows(page)).toEqual([latest]);
  await page
    .getByRole("button", {
      name: "Huidige opgeslagen versie openen",
      exact: true,
    })
    .click();
  await confirmation
    .getByRole("button", {
      name: "Mijn bewerking wissen en laden",
      exact: true,
    })
    .click();
  await expect(note).toHaveValue(original.note);
  await expect(
    page.getByRole("checkbox", {
      name: "Als herinnering op Thuis tonen",
      exact: true,
    }),
  ).toBeChecked();
  await note.fill("SYNTHETIC: fresh deliberate edit");
  await page
    .getByRole("button", { name: "Moment opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Moment bewaard.", { exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toMatchObject([
    {
      id: original.id,
      favourite: true,
      note: "SYNTHETIC: fresh deliberate edit",
    },
  ]);
  await other.close();
});

test("deleting personal words clears their draft and permits a new phrase in the same millisecond", async ({
  page,
}) => {
  const now = Date.now();
  await page.addInitScript((timestamp) => {
    Date.now = () => timestamp;
  }, now);
  await page.goto("tools/self-compassion/brief");
  const expand = () =>
    page
      .getByText("Mijn eigen zin (optioneel)", { exact: true })
      .first()
      .click();
  const words = page.getByRole("textbox", {
    name: "Mijn eigen zin (optioneel)",
    exact: true,
  });
  await expand();
  await words.fill("SYNTHETIC: words to delete");
  await page
    .getByRole("button", { name: "Mijn zin bewaren", exact: true })
    .click();
  await expect(
    page.getByText("Je eigen zin is bewaard.", { exact: true }),
  ).toBeVisible();
  const previous = (await rows(page))[0];
  await words.fill("SYNTHETIC: unfinished words to delete too");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Mijn opgeslagen zin verwijderen",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await expect(
    page.getByText("Je opgeslagen zin is verwijderd.", { exact: true }),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(0);
  const draft = (await rows(page, "settings")).find(
    (entry) => entry.key === "draft:compassion-note",
  );
  expect(draft?.value ?? "").toBe("");
  await expand();
  await expect(words).toHaveValue("");
  await words.fill("SYNTHETIC: a deliberately new phrase");
  await page
    .getByRole("button", { name: "Mijn zin bewaren", exact: true })
    .click();
  await expect(
    page.getByText("Je eigen zin is bewaard.", { exact: true }),
  ).toBeVisible();
  const replacement = (await rows(page))[0];
  expect(replacement.text).toBe("SYNTHETIC: a deliberately new phrase");
  expect(replacement.timestamp).toBeGreaterThan(previous.timestamp);
});

test("brief compassion is offered only after a safe-for-now quick registration", async ({
  page,
}) => {
  for (const safety of [
    "Ik heb ondersteuning nodig",
    "Er is direct gevaar",
    "Voor nu veilig",
  ]) {
    await page.goto("quick");
    await page
      .getByRole("button", { name: "Angst of spanning", exact: true })
      .click();
    await page.getByRole("button", { name: safety, exact: true }).click();
    await page
      .getByRole("button", { name: "10 minuten pauzeren", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Snelle registratie opslaan", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Snelle registratie opgeslagen",
        exact: true,
      }),
    ).toBeVisible();
    const compassion = page.getByRole("button", {
      name: "Even vriendelijk voor mezelf",
      exact: true,
    });
    if (safety === "Voor nu veilig") {
      await expect(compassion).toBeVisible();
      await compassion.click();
      await expect(
        page.getByRole("heading", {
          name: "Even vriendelijk voor mezelf",
          exact: true,
        }),
      ).toBeVisible();
    } else {
      await expect(compassion).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: "Zet directe veiligheid voorop",
          exact: true,
        }),
      ).toBeVisible();
    }
  }
});

test("the growth Home widget preserves its saved visibility setting", async ({
  page,
}) => {
  await page.goto("home-customization");
  await page
    .getByRole("button", { name: "Wat ik opbouw: Getoond", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Indeling van Thuis opslaan", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Indeling offline opgeslagen",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("./");
  await expect(
    page.getByRole("region", { name: "Wat ik opbouw", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Wat ik opbouw", exact: true }),
  ).toHaveCount(0);
  await page.goto("home-customization");
  await page
    .getByRole("button", { name: "Wat ik opbouw: Verborgen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Indeling van Thuis opslaan", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Indeling offline opgeslagen",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("./");
  await expect(
    page.getByRole("region", { name: "Wat ik opbouw", exact: true }),
  ).toBeVisible();
});

test("new memories and unfinished words survive a downloaded backup and replacement", async ({
  page,
}) => {
  await keepMoment(page, "SYNTHETIC: backup memory", true);
  await page.goto("tools/self-compassion/brief");
  await page
    .getByText("Mijn eigen zin (optioneel)", { exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Mijn eigen zin (optioneel)", exact: true })
    .fill("SYNTHETIC: unfinished words");
  await expect(
    page.getByText("Concept lokaal bewaard. Nog niet afgerond.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("settings");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporteren naar bestand", exact: true })
    .click();
  const bytes = await readFile((await (await downloaded).path())!);
  const payload = JSON.parse(bytes.toString());
  expect(payload.version).toBe(5);
  expect(payload.featureRecords).toHaveLength(1);
  await page.getByLabel("JSON-back-up kiezen").setInputFiles({
    name: "synthetic-growth.json",
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
  await page.goto("growth");
  await expect(
    page.getByText("SYNTHETIC: backup memory", { exact: true }),
  ).toBeVisible();
  await page.goto("tools/self-compassion/brief");
  await page
    .getByText("Mijn eigen zin (optioneel)", { exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Mijn eigen zin (optioneel)",
      exact: true,
    }),
  ).toHaveValue("SYNTHETIC: unfinished words");
});

test("English screens render at 320px without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.goto("settings");
  await page.getByRole("button", { name: /English/ }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  for (const [route, heading] of [
    ["moments/new", "Keep a moment"],
    ["growth", "My growth"],
    ["tools/self-compassion/brief", "A little kindness to myself"],
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("brief-compassion-en-320.png"),
    fullPage: true,
  });
});
