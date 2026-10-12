import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

if (!process.env.PWA_TEST_ROOT) throw new Error('Provide the actual candidate build in PWA_TEST_ROOT.');
const port = Number(process.env.PWA_TEST_PORT || 8787);
const base = `http://127.0.0.1:${port}/substance-recovery/`;
const output = resolve(process.env.PWA_RESET_EVIDENCE || 'test-results/storage-reset');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve-pwa.mjs'], { windowsHide: true, stdio: 'pipe', env: { ...process.env, PWA_TEST_PORT: String(port) } });
let browser;
try {
  for (let retry = 0; ; retry++) {
    try { if ((await fetch(base)).ok) break; } catch { /* loopback startup */ }
    if (retry >= 50) throw new Error('Reset test server did not start.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
  const editor = await context.newPage();
  const settings = await context.newPage();
  const errors = [];
  for (const page of [editor, settings]) {
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
  }
  const snapshot = () => settings.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('anchor-recovery'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const names = Array.from(db.objectStoreNames);
      const tx = db.transaction(names);
      const values = await Promise.all(names.map(name => new Promise((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); })));
      return { version: db.version, stores: Object.fromEntries(names.map((name, index) => [name, values[index]])) };
    } finally { db.close(); }
  });
  const note = editor.getByRole('textbox', { name: 'Wat houdt je bezig?', exact: true });
  const saved = page => page.getByText('Concept lokaal bewaard. Nog niet afgerond.', { exact: true }).waitFor();
  const blocked = () => editor.getByRole('heading', { name: 'Je lokale gegevens zijn gewist of hersteld', exact: true }).waitFor();

  await editor.goto(`${base}journal/new`);
  await note.fill('SYNTHETIC original draft before erase'); await saved(editor);
  await settings.goto(`${base}settings`);
  const build = await settings.locator('meta[name="anchor-build"]').getAttribute('content');
  await settings.getByRole('button', { name: /Alle gegevens verwijderen|Alles wissen|Alle gegevens wissen/ }).click();
  await settings.getByRole('alertdialog').getByRole('button', { name: 'Alles verwijderen', exact: true }).click();
  await settings.waitForLoadState('domcontentloaded');
  await settings.getByRole('heading', { name: 'Instellingen', exact: true }).waitFor();
  // The other window retains both its cached generation and the old form.
  await note.fill('SYNTHETIC must never resurrect after erase'); await blocked();
  const afterErase = await snapshot();
  assert.equal(afterErase.version, 15);
  assert.equal(JSON.stringify(afterErase).includes('SYNTHETIC'), false);
  assert.equal(await editor.locator('textarea[aria-label="Wat houdt je bezig?"]').inputValue(), 'SYNTHETIC must never resurrect after erase');
  await editor.screenshot({ path: resolve(output, 'erase-stale-window-blocked.png') });
  await editor.getByRole('button', { name: 'Opnieuw openen / herladen', exact: true }).click();
  await note.waitFor(); assert.equal(await note.inputValue(), '');
  await note.fill('SYNTHETIC fresh draft after full reload'); await saved(editor);
  assert.equal(JSON.stringify(await snapshot()).includes('SYNTHETIC fresh draft after full reload'), true);

  const backup = { version: 6, dataVersion: 3, exportedAt: Date.now(), journal: [{ id: 'synthetic-restored', timestamp: Date.now(), mood: 1, cravingIntensity: 0, note: 'SYNTHETIC restored journal', toolUsed: null }], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [], cigaretteLogs: [], featureRecords: [], settings: [] };
  // Reload the settings window after its own erase, then restore through its UI.
  await settings.reload();
  await settings.getByLabel('JSON-back-up kiezen', { exact: true }).setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await settings.getByRole('radio', { name: /^Vervangen:/ }).check();
  await settings.getByRole('checkbox', { name: 'Ik begrijp dat huidige gegevens die niet in dit bestand staan worden verwijderd.', exact: true }).check();
  await settings.getByRole('button', { name: 'Herstel bevestigen', exact: true }).click();
  await settings.waitForLoadState('domcontentloaded');
  await settings.getByRole('heading', { name: 'Instellingen', exact: true }).waitFor();
  await note.fill('SYNTHETIC must never overwrite restored data'); await blocked();
  const afterRestore = await snapshot();
  assert.deepEqual(afterRestore.stores.journal, backup.journal);
  assert.equal(afterRestore.stores.settings.some(row => row.key === 'draft:journal-entry' && row.value), false);
  assert.equal(JSON.stringify(afterRestore).includes('must never'), false);
  await editor.screenshot({ path: resolve(output, 'restore-stale-window-blocked.png') });
  await editor.getByRole('button', { name: 'Opnieuw openen / herladen', exact: true }).click();
  await note.waitFor(); assert.equal(await note.inputValue(), '');
  await note.fill('SYNTHETIC new entry after restore and reload');
  await editor.getByRole('button', { name: 'Invoer opslaan', exact: true }).click();
  await editor.waitForURL('**/journal');
  const final = await snapshot();
  assert.equal(final.stores.journal.length, 2);
  assert.equal(final.stores.journal.some(row => row.note === 'SYNTHETIC restored journal'), true);
  assert.deepEqual(errors, []);
  const result = { build, databaseVersion: final.version, browser: await browser.version(), twoRealWindows: true, eraseBlocksStaleDraft: true, restoreBlocksStaleDraft: true, staleFormRetainedInMemoryUntilReload: true, fullReloadAllowsNewWrites: true, restoredJournalRetained: true, runtimeErrors: errors, physicalDeviceVerified: false };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
