import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

if (!process.env.PWA_TEST_ROOT || !process.env.PWA_UPDATE_ROOT) throw new Error('Set PWA_TEST_ROOT and PWA_UPDATE_ROOT to two actual built PWA directories.');
const port = 8754;
const base = `http://127.0.0.1:${port}/substance-recovery/`;
const output = resolve(process.env.PWA_UPDATE_EVIDENCE || 'test-results/pwa-update');
await mkdir(output, {recursive:true});
const server = spawn(process.execPath, ['scripts/serve-pwa.mjs'], { windowsHide: true, stdio: 'pipe', env: {...process.env, PWA_TEST_PORT:String(port)} });
let browser;
try {
  for (let retry = 0; ; retry++) {
    try { if ((await fetch(base)).ok) break; } catch { /* wait for loopback server */ }
    if (retry >= 50) throw new Error('Update test server did not start');
    await new Promise(resolve => setTimeout(resolve,100));
  }
  browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}: {})});
  const context = await browser.newContext({viewport:{width:390,height:844},locale:'nl-NL'});
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto(`${base}journal/new`);
  await page.getByRole('textbox',{name:'Wat houdt je bezig?',exact:true}).fill('SYNTHETIC: saved before app update');
  await page.getByRole('button',{name:'Invoer opslaan',exact:true}).click();
  await page.waitForURL('**/journal');
  await page.goto(`${base}recovery-plan`);
  const warning=page.getByRole('textbox',{name:'Mijn waarschuwingssignalen',exact:true});
  await warning.fill('SYNTHETIC: keep my unfinished plan across this update');
  await page.getByText('Concept lokaal bewaard. Nog niet afgerond.',{exact:true}).waitFor();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  if (!await page.evaluate(()=>!!navigator.serviceWorker.controller)) await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const beforeBuild = await page.locator('meta[name="anchor-build"]').getAttribute('content');
  await fetch(`http://127.0.0.1:${port}/__test__/activate-update`,{method:'POST'});
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
  await page.getByRole('button',{name:'Bijwerken',exact:true}).waitFor({timeout:20000});
  await page.screenshot({path:resolve(output,'update-prompt-with-draft.png')});
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    window.restoreSyntheticPut=()=>{IDBObjectStore.prototype.put=original};
    IDBObjectStore.prototype.put=function(value,...args){if(value?.key==='draft:recovery-plan')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,value,...args)};
  });
  await warning.fill('SYNTHETIC: newest unfinished plan after storage retry');
  await page.getByText(/Het concept kon niet worden bewaard/).waitFor();
  await page.getByRole('button',{name:'Bijwerken',exact:true}).click();
  await page.getByText(/Bijwerken is uitgesteld omdat invoer/).waitFor();
  assert.equal(await page.locator('meta[name="anchor-build"]').getAttribute('content'),beforeBuild);
  await page.evaluate(()=>window.restoreSyntheticPut());
  await page.getByRole('button',{name:'Opnieuw proberen',exact:true}).click();
  await page.getByText('Concept lokaal bewaard. Nog niet afgerond.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Bijwerken',exact:true}).click();
  await page.waitForFunction(before=>document.querySelector('meta[name="anchor-build"]')?.getAttribute('content')!==before,beforeBuild,{timeout:20000});
  await warning.waitFor();
  assert.equal(await warning.inputValue(),'SYNTHETIC: newest unfinished plan after storage retry');
  const afterBuild = await page.locator('meta[name="anchor-build"]').getAttribute('content');
  await page.screenshot({path:resolve(output,'updated-draft-preserved.png')});
  await context.setOffline(true);
  await page.goto(`${base}journal`);
  await page.getByText('SYNTHETIC: saved before app update',{exact:true}).waitFor();
  const journal = await page.evaluate(async()=>{
    const db = await new Promise((resolve,reject)=>{const r=indexedDB.open('anchor-recovery');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    try{return await new Promise((resolve,reject)=>{const r=db.transaction('journal').objectStore('journal').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}
  });
  assert.equal(journal.length,1);assert.equal(journal[0].mood,null);assert.equal(journal[0].cravingIntensity,null);
  assert.deepEqual(errors,[]);
  const result={beforeBuild,afterBuild,failedDraftBlockedUpdate:true,retryThenUpdatePassed:true,draftRetained:true,savedJournalRetainedOffline:true,journalCount:journal.length,runtimeErrors:errors,browser:await browser.version(),physicalInstalledAppTest:false};
  await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await browser?.close(); server.kill(); }
