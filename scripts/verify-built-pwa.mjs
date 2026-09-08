import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(process.env.PWA_DIST || "artifacts/anchor/dist/public");
const rawBase = process.env.BASE_PATH || "/substance-recovery/";
const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

function fail(message) {
  throw new Error(`Built PWA verification failed: ${message}`);
}

function read(name) {
  const path = resolve(dist, name);
  if (!existsSync(path)) fail(`missing ${name}`);
  return readFileSync(path, "utf8");
}

const html = read("index.html");
if (read("404.html") !== html) fail("SPA fallback must match index.html");
const serviceWorker = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));

for (const required of [
  `src="${base}assets/`,
  `href="${base}assets/`,
  `href="${base}manifest.webmanifest"`,
  `href="${base}apple-touch-icon.png"`,
  `content="${base}opengraph.jpg"`,
]) {
  if (!html.includes(required)) fail(`index.html is missing ${required}`);
}

if (/https:\/\/fonts\.(googleapis|gstatic)\.com/i.test(html)) {
  fail("index.html still makes an external font request");
}

if (manifest.start_url !== base || manifest.scope !== base) {
  fail("manifest start_url and scope must match the GitHub Pages base path");
}
if (manifest.display !== "standalone") fail("manifest is not standalone");

for (const icon of manifest.icons ?? []) {
  if (!icon?.src || !existsSync(resolve(dist, icon.src))) {
    fail(`manifest icon is missing: ${String(icon?.src)}`);
  }
}

for (const required of ["index.html", "manifest.webmanifest", "assets/"]) {
  if (!serviceWorker.includes(required)) {
    fail(`service worker does not precache ${required}`);
  }
}

const localAssetRefs = [...html.matchAll(/(?:src|href)="([^"?#]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith(base))
  .map((path) => path.slice(base.length))
  .filter((path) => !path.endsWith("/"));
for (const asset of localAssetRefs) {
  if (!existsSync(resolve(dist, asset)))
    fail(`referenced asset is missing: ${asset}`);
}

console.log(`Verified GitHub Pages PWA artifact at ${base}`);
