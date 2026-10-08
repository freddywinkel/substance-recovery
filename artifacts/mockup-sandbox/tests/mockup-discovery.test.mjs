import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mockupPreviewPlugin } from "../mockupPreviewPlugin.ts";

test("mockup discovery includes nested TSX and excludes private, hidden and non-TSX files", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "anchor-mockups-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const addFile = async (relative) => {
    const file = path.join(root, "src/components/mockups", relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      "export default function Mockup() { return null; }\n",
    );
  };
  for (const file of [
    "One.tsx",
    "nested/Two.tsx",
    "_private/Hidden.tsx",
    "nested/_Hidden.tsx",
    ".hidden/Hidden.tsx",
    ".Hidden.tsx",
    "Three.ts",
    "Four.txt",
  ]) {
    await addFile(file);
  }
  await mkdir(path.join(root, "src/components/mockups/Directory.tsx"));
  const plugin = mockupPreviewPlugin();
  plugin.configResolved({ root });
  await plugin.buildStart();
  const generated = path.join(root, "src/.generated/mockup-components.ts");
  const source = await readFile(generated, "utf8");
  assert.match(
    source,
    /"\.\/components\/mockups\/One\.tsx": \(\) => import\("\.\.\/components\/mockups\/One\.tsx"\)/,
  );
  assert.match(source, /"\.\/components\/mockups\/nested\/Two\.tsx"/);
  assert.equal((source.match(/=> import/g) || []).length, 2);
  assert.doesNotMatch(source, /Hidden|Three|Four|\\\\/);
  await rm(path.join(root, "src/components/mockups/One.tsx"));
  await addFile("New.tsx");
  await plugin.buildStart();
  const refreshed = await readFile(generated, "utf8");
  assert.doesNotMatch(refreshed, /One\.tsx/);
  assert.match(refreshed, /New\.tsx/);
});

test("mockup discovery creates an empty module when the mockup directory is absent", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "anchor-mockups-empty-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugin = mockupPreviewPlugin();
  plugin.configResolved({ root });
  await plugin.buildStart();
  assert.doesNotMatch(
    await readFile(
      path.join(root, "src/.generated/mockup-components.ts"),
      "utf8",
    ),
    /=> import/,
  );
});
