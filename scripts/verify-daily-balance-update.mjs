import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

if (!process.env.PWA_TEST_ROOT || !process.env.PWA_UPDATE_ROOT) throw new Error('Provide two actual builds in PWA_TEST_ROOT and PWA_UPDATE_ROOT.');
const port = Number(process.env.PWA_TEST_PORT || 8754);
const expectedPriorVersion = Number(process.env.PWA_EXPECTED_PRIOR_DB_VERSION || 15);
const expectedNextVersion = Number(process.env.PWA_EXPECTED_NEXT_DB_VERSION || 15);
if (![expectedPriorVersion, expectedNextVersion].every(version => Number.isSafeInteger(version) && version > 0)) throw new Error('Expected database versions must be positive integers.');
const base = `http://127.0.0.1:${port}/substance-recovery/`;
const output = resolve(process.env.PWA_UPDATE_EVIDENCE || 'test-results/daily-balance-update');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve-pwa.mjs'], { windowsHide: true, stdio: 'pipe', env: { ...process.env, PWA_TEST_PORT: String(port) } });
const day = '2026-10-11';
let browser;
try {
  for (let retry = 0; ; retry++) {
    try { if ((await fetch(base)).ok) break; } catch { /* loopback startup */ }
    if (retry >= 50) throw new Error('Update test server did not start.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const draftSaved = () => page.getByText('Concept lokaal bewaard. Nog niet afgerond.', { exact: true }).waitFor();
  const snapshot = () => page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('anchor-recovery'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const tx = db.transaction(['featureRecords', 'settings']);
      const read = store => new Promise((resolve, reject) => { const request = tx.objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const [records, settings] = await Promise.all([read('featureRecords'), read('settings')]);
      return { databaseVersion: db.version, records: records.filter(record => ['daily-balance', 'balance-moment'].includes(record.recordType)), drafts: settings.filter(setting => /^draft:(daily-balance|balance-moment):/.test(setting.key) && setting.value) };
    } finally { db.close(); }
  });
  const ratings = async (scope, moodName, eis, craving) => {
    if (moodName) await scope.getByRole('group', { name: 'Stemming', exact: true }).getByRole('button', { name: moodName, exact: true }).click();
    if (eis !== null) await scope.getByRole('spinbutton', { name: 'Emotionele intensiteit (EIS)', exact: true }).fill(String(eis));
    if (craving !== null) await scope.getByRole('group', { name: 'Craving', exact: true }).getByRole('button', { name: String(craving), exact: true }).click();
  };
  await page.goto(`${base}daily?date=${day}`);
  await ratings(page, '+1 Goed', 75, 0);
  const mainSleep = page.getByRole('group', { name: 'Hoofdslaap', exact: true });
  await mainSleep.getByRole('textbox', { name: 'Hoofdslaap · Uren', exact: true }).fill('7');
  await mainSleep.getByRole('textbox', { name: 'Hoofdslaap · Minuten', exact: true }).fill('30');
  await page.getByRole('button', { name: 'Geen extra slaap', exact: true }).click();
  await page.getByRole('button', { name: 'Dag opslaan', exact: true }).click();
  await page.getByText('Dag lokaal opgeslagen', { exact: true }).waitFor();

  await page.goto(`${base}daily/moments/new?date=${day}`);
  await ratings(page.getByRole('region', { name: 'Vooraf', exact: true }), '-1 Laag', 80, 7);
  await page.getByRole('button', { name: 'Buiten wandelen', exact: true }).click();
  await page.getByRole('button', { name: 'Vooraf opslaan & activiteit starten', exact: true }).click();
  await page.waitForURL(url => /\/daily\/moments\/(?!new)/.test(url.pathname));
  let after = page.getByRole('region', { name: 'Achteraf', exact: true });
  await after.getByRole('button', { name: 'Ja', exact: true }).click();
  await ratings(after, '+1 Goed', 60, 3);
  await page.getByRole('button', { name: 'Check-in achteraf opslaan', exact: true }).click();
  await page.getByText('Moment lokaal opgeslagen', { exact: true }).waitFor();

  // A valid saved day and its invalid, newer raw input must both survive.
  await page.goto(`${base}daily?date=${day}`);
  await mainSleep.getByRole('textbox', { name: 'Hoofdslaap · Uren', exact: true }).fill('25');
  await draftSaved();
  await page.goto(`${base}daily/moments/new?date=${day}`);
  await ratings(page.getByRole('region', { name: 'Vooraf', exact: true }), '0 Neutraal', 25, null);
  await page.getByRole('button', { name: 'Schilderen', exact: true }).click();
  await page.getByRole('button', { name: 'Vooraf opslaan & activiteit starten', exact: true }).click();
  await page.waitForURL(url => /\/daily\/moments\/(?!new)/.test(url.pathname));
  after = page.getByRole('region', { name: 'Achteraf', exact: true });
  await ratings(after, '+2 Erg goed', 100, 0);
  const note = after.getByRole('textbox', { name: /Wat merkte je op/ });
  await note.fill('SYNTHETIC unfinished after-check-in');
  await draftSaved();
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => !!navigator.serviceWorker.controller)) await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const beforeBuild = await page.locator('meta[name="anchor-build"]').getAttribute('content');
  await fetch(`http://127.0.0.1:${port}/__test__/activate-update`, { method: 'POST' });
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
  await page.getByRole('button', { name: 'Bijwerken', exact: true }).waitFor({ timeout: 30000 });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    window.restoreSyntheticPut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function(value, ...args) { if (value?.key?.startsWith('draft:balance-moment:')) throw new DOMException('SYNTHETIC full disk', 'QuotaExceededError'); return original.call(this, value, ...args); };
  });
  const latestNote = 'SYNTHETIC newest after-check-in retained across update';
  await note.fill(latestNote);
  await page.getByText(/Het concept kon niet worden bewaard/).waitFor();
  await page.getByRole('button', { name: 'Bijwerken', exact: true }).click();
  await page.getByText(/Bijwerken is uitgesteld omdat invoer/).waitFor();
  assert.equal(await page.locator('meta[name="anchor-build"]').getAttribute('content'), beforeBuild);
  await page.evaluate(() => window.restoreSyntheticPut());
  await page.getByRole('button', { name: 'Opnieuw proberen', exact: true }).click();
  await draftSaved();
  const before = await snapshot();
  assert.equal(before.databaseVersion, expectedPriorVersion);
  assert.equal(before.records.length, 3);
  assert.equal(before.drafts.length, 2);
  const savedDay = before.records.find(record => record.recordType === 'daily-balance');
  assert.equal(savedDay.mainSleep, 450); assert.equal(savedDay.additionalSleep, 0);
  assert.equal(savedDay.craving, 0); assert.equal(savedDay.emotionalIntensity, 75);
  const completed = before.records.find(record => record.status === 'completed');
  assert.deepEqual(completed.before, { mood: -1, emotionalIntensity: 80, craving: 7 });
  assert.deepEqual(completed.after, { mood: 1, emotionalIntensity: 60, craving: 3 });
  await page.screenshot({ path: resolve(output, 'pending-update-keeps-after-draft.png') });
  await page.getByRole('button', { name: 'Bijwerken', exact: true }).click();
  await page.waitForFunction(before => document.querySelector('meta[name="anchor-build"]')?.getAttribute('content') !== before, beforeBuild, { timeout: 30000 });
  await note.waitFor(); assert.equal(await note.inputValue(), latestNote);
  const afterBuild = await page.locator('meta[name="anchor-build"]').getAttribute('content');
  // An explicitly expected compatibility-barrier upgrade changes only the
  // schema version. Every record and raw draft must still match byte for byte.
  const expectedAfter = { ...before, databaseVersion: expectedNextVersion };
  assert.deepEqual(await snapshot(), expectedAfter);
  await context.setOffline(true);
  await page.reload(); await note.waitFor(); assert.equal(await note.inputValue(), latestNote);
  await page.goto(`${base}daily?date=${day}`);
  await draftSaved();
  assert.equal(await mainSleep.getByRole('textbox', { name: 'Hoofdslaap · Uren', exact: true }).inputValue(), '25');
  assert.deepEqual(await snapshot(), expectedAfter);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(output, 'offline-day-and-draft-preserved.png') });
  const result = { beforeBuild, afterBuild, beforeDatabaseVersion: before.databaseVersion, afterDatabaseVersion: expectedNextVersion, savedDayCount: 1, savedMomentCount: 2, rawDraftCount: 2,
    completeRecordsByteForBytePreserved: true, invalidSleepDraftPreserved: true, unfinishedAfterRatingsAndNewestNotePreserved: true,
    failedDraftBlockedUpdate: true, retryThenUpdatePassed: true, offlineReloadPassed: true, runtimeErrors: errors, browser: await browser.version(), physicalInstalledAppTest: false };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser?.close(); server.kill(); }
