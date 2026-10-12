import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

if (!process.env.PWA_TEST_ROOT || !process.env.PWA_UPDATE_ROOT) throw new Error('Set PWA_TEST_ROOT and PWA_UPDATE_ROOT to two builds containing the guarded update flow.');
const port = Number(process.env.PWA_TEST_PORT || 8784);
const base = `http://127.0.0.1:${port}/substance-recovery/`;
const output = resolve(process.env.PWA_UPDATE_EVIDENCE || 'test-results/pwa-multitab-update');
await mkdir(output, { recursive: true });
const results = [];

for (const scenario of ['saved-registration', 'failed-registration', 'failed-plan']) {
  const server = spawn(process.execPath, ['scripts/serve-pwa.mjs'], { windowsHide: true, stdio: 'pipe', env: { ...process.env, PWA_TEST_PORT: String(port) } });
  let browser;
  try {
    for (let retry = 0; ; retry++) {
      try { if ((await fetch(base)).ok) break; } catch { /* wait for loopback server */ }
      if (retry >= 50) throw new Error('Update test server did not start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-GB' });
    const editor = await context.newPage(); editor.setDefaultTimeout(10_000);
    await editor.addInitScript(() => sessionStorage.setItem('synthetic-document-loads', String(Number(sessionStorage.getItem('synthetic-document-loads') || 0) + 1)));
    const errors = [], dialogs = [];
    let stackedWarningCheck = null;
    editor.on('pageerror', error => errors.push(error.message));
    editor.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
    await editor.goto(`${base}settings`);
    await editor.getByRole('button', { name: '🇬🇧 English', exact: true }).click();
    await editor.waitForFunction(() => document.documentElement.lang === 'en');
    await editor.evaluate(() => navigator.serviceWorker.ready);
    assert.equal(await editor.evaluate(() => sessionStorage.getItem('synthetic-document-loads')), '1', 'First installation must not reload the active page');
    const plan = scenario === 'failed-plan';
    await editor.goto(`${base}${plan ? 'recovery-plan' : 'craving'}`);
    if (!plan) await editor.getByRole('button', { name: 'Other', exact: true }).first().click();
    const input = plan
      ? editor.getByRole('textbox', { name: 'My warning signs', exact: true })
      : editor.getByPlaceholder("Describe how it's coming on…", { exact: true });
    const key = plan ? 'draft:recovery-plan' : 'activeRegistration';
    async function waitForStored(text) {
      await editor.waitForFunction(async ({ key, text }) => {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('anchor-recovery'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try { return await new Promise((resolve, reject) => { const request = db.transaction('settings').objectStore('settings').get(key); request.onsuccess = () => resolve(request.result?.value.includes(text)); request.onerror = () => reject(request.error); }); }
        finally { db.close(); }
      }, { key, text });
    }
    await input.fill('SYNTHETIC earlier saved input'); await waitForStored('SYNTHETIC earlier saved input');
    await editor.evaluate(() => navigator.serviceWorker.ready);
    await editor.reload(); await input.waitFor();
    await editor.waitForFunction(() => !!navigator.serviceWorker.controller);
    // Cache cleanup belongs only to this worker's precache, never other apps.
    await editor.evaluate(async () => { const cache = await caches.open('unrelated-app-audit-cache'); await cache.put('/other-app/synthetic.txt', new Response('keep')); });
    const updater = await context.newPage(); updater.on('pageerror', error => errors.push(error.message));
    await updater.goto(base); await updater.waitForFunction(() => !!navigator.serviceWorker.controller);
    const beforeBuild = await editor.locator('meta[name="anchor-build"]').getAttribute('content');
    await fetch(`http://127.0.0.1:${port}/__test__/activate-update`, { method: 'POST' });
    await updater.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
    await updater.getByRole('button', { name: 'Update', exact: true }).waitFor({ timeout: 20_000 });
    if (scenario !== 'saved-registration') {
      await editor.evaluate(key => {
        const original = IDBObjectStore.prototype.put;
        window.restoreSyntheticPut = () => { IDBObjectStore.prototype.put = original; };
        IDBObjectStore.prototype.put = function(value, ...args) {
          if (value?.key === key) throw new DOMException('Synthetic quota', 'QuotaExceededError');
          return original.call(this, value, ...args);
        };
      }, key);
    }
    const newest = `SYNTHETIC newest ${scenario}`;
    await input.fill(newest);
    if (scenario === 'saved-registration') await waitForStored(newest);
    else await editor.getByText(plan ? /The draft could not be saved/ : 'Draft changes are not saved on this device yet. Retry before closing the app.', { exact: !plan }).waitFor();
    await updater.getByRole('button', { name: 'Update', exact: true }).click();
    await updater.waitForFunction(before => document.querySelector('meta[name="anchor-build"]')?.getAttribute('content') !== before, beforeBuild, { timeout: 20_000 });
    if (scenario !== 'saved-registration') {
      await editor.getByText(/Update postponed because input has not been safely saved/).waitFor();
      assert.equal(await editor.locator('meta[name="anchor-build"]').getAttribute('content'), beforeBuild);
      assert.equal(await input.inputValue(), newest);
      assert.deepEqual(dialogs, [], 'The guarded reload must not delegate data protection to a browser confirmation');
      if (scenario === 'failed-registration') {
        // Keep both real failure messages usable while the new worker is active.
        // This emulates text resize, not physical-device zoom or installation.
        await editor.setViewportSize({ width: 320, height: 900 });
        await editor.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
        await editor.waitForFunction(() => {
          const panel = document.querySelector('aside[aria-labelledby="pwa-update-title"]');
          const help = document.querySelector('a[href$="help"]');
          const warning = [...document.querySelectorAll('[role="alert"]')].find(element => element.textContent.includes('Draft changes are not saved'));
          if (!panel || !help || !warning) return false;
          const panelBox = panel.getBoundingClientRect(), helpBox = help.getBoundingClientRect(), warningBox = warning.getBoundingClientRect();
          return panelBox.top >= helpBox.bottom && panelBox.bottom <= warningBox.top && panelBox.height > 88;
        });
        stackedWarningCheck = await editor.evaluate(() => {
          const panel = document.querySelector('aside[aria-labelledby="pwa-update-title"]');
          const help = document.querySelector('a[href$="help"]');
          const box = help.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            viewportWidth: innerWidth,
            textSize: getComputedStyle(document.documentElement).fontSize,
            noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
            helpUncovered: hit === help || help.contains(hit),
            keyboardScrollable: panel.tabIndex === 0 && panel.scrollHeight > panel.clientHeight,
            keyboardActions: [],
          };
        });
        assert.equal(stackedWarningCheck.noHorizontalOverflow, true);
        assert.equal(stackedWarningCheck.helpUncovered, true);
        assert.equal(stackedWarningCheck.keyboardScrollable, true);
        const panel = editor.locator('aside[aria-labelledby="pwa-update-title"]');
        await panel.focus(); await editor.keyboard.press('PageDown');
        for (const label of ['Later', 'Update']) {
          await editor.keyboard.press('Tab');
          const button = editor.getByRole('button', { name: label, exact: true });
          // Focus scrolling can finish after the key event, especially while
          // browser suites run in parallel. Assert its settled visible bounds.
          await editor.waitForFunction(label => {
            const panel = document.querySelector('aside[aria-labelledby="pwa-update-title"]');
            const element = [...panel.querySelectorAll('button')].find(button => button.textContent.trim() === label);
            if (!element || element !== document.activeElement) return false;
            const buttonBox = element.getBoundingClientRect(), panelBox = panel.getBoundingClientRect();
            return buttonBox.top >= panelBox.top && buttonBox.bottom <= panelBox.bottom && buttonBox.left >= panelBox.left && buttonBox.right <= panelBox.right;
          }, label, { timeout: 5_000 });
          const state = await button.evaluate(element => {
            const buttonBox = element.getBoundingClientRect(), panelBox = element.closest('aside').getBoundingClientRect();
            return { focused: element === document.activeElement, fullyVisible: buttonBox.top >= panelBox.top && buttonBox.bottom <= panelBox.bottom && buttonBox.left >= panelBox.left && buttonBox.right <= panelBox.right };
          });
          assert.equal(state.focused, true, `${label} must be reachable with Tab`);
          assert.equal(state.fullyVisible, true, `${label} must scroll fully into view`);
          stackedWarningCheck.keyboardActions.push(label);
        }
        await editor.screenshot({ path: resolve(output, 'failed-registration-stacked-320-200.png') });
      }
      await editor.evaluate(() => window.restoreSyntheticPut());
      await editor.getByRole('button', { name: 'Retry', exact: true }).click();
      await waitForStored(newest);
      await editor.getByRole('button', { name: 'Update', exact: true }).click();
    }
    await editor.waitForFunction(before => document.querySelector('meta[name="anchor-build"]')?.getAttribute('content') !== before, beforeBuild, { timeout: 20_000 });
    await input.waitFor(); assert.equal(await input.inputValue(), newest); await waitForStored(newest);
    const afterBuild = await editor.locator('meta[name="anchor-build"]').getAttribute('content');
    assert.equal(await editor.evaluate(async () => (await (await caches.open('unrelated-app-audit-cache')).match('/other-app/synthetic.txt'))?.text()), 'keep');
    await context.setOffline(true); await editor.reload(); await input.waitFor(); assert.equal(await input.inputValue(), newest);
    assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
    await editor.screenshot({ path: resolve(output, `${scenario}.png`) });
    results.push({ scenario, beforeBuild, afterBuild, firstInstallDidNotReload: true, newestInputRetained: true, offlineReloadPassed: true, unrelatedCacheRetained: true, automaticReloadBlockedWhileSaveFailed: scenario !== 'saved-registration', stackedWarningCheck, browser: await browser.version(), errors, dialogs });
  } catch (error) {
    const pages = [];
    for (const page of browser?.contexts()[0]?.pages() || []) {
      pages.push(await page.evaluate(async () => ({
        url: location.href,
        build: document.querySelector('meta[name="anchor-build"]')?.getAttribute('content'),
        body: document.body.innerText,
        focusedElement: document.activeElement?.outerHTML,
        updatePanel: [...document.querySelectorAll('aside[aria-labelledby="pwa-update-title"], aside[aria-labelledby="pwa-update-title"] button')].map(element => ({ text: element.textContent, bounds: element.getBoundingClientRect().toJSON(), scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight })),
        controller: navigator.serviceWorker.controller?.scriptURL,
        registrations: (await navigator.serviceWorker.getRegistrations()).map(registration => ({ active: registration.active?.state, waiting: registration.waiting?.state, installing: registration.installing?.state })),
      })));
    }
    await writeFile(resolve(output, `${scenario}-failure.json`), JSON.stringify({ scenario, error: String(error), pages }, null, 2));
    throw error;
  } finally {
    await browser?.close();
    const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited;
  }
}
await writeFile(resolve(output, 'result.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
