import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.PWA_TEST_PORT || 8752);
const base = `/${(process.env.BASE_PATH || "/substance-recovery/").replace(/^\/+|\/+$/g, "")}/`;
let directory = path.resolve(
  process.env.PWA_TEST_ROOT || "artifacts/anchor/dist/public",
);
const nextDirectory = process.env.PWA_UPDATE_ROOT
  ? path.resolve(process.env.PWA_UPDATE_ROOT)
  : null;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url || "/", "http://127.0.0.1").pathname,
    );
    // Test-only switch, enabled only when explicitly launching two build directories.
    if (
      nextDirectory &&
      req.method === "POST" &&
      pathname === "/__test__/activate-update"
    ) {
      directory = nextDirectory;
      res.writeHead(200);
      res.end("updated");
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    if (!pathname.startsWith(base)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const relative = pathname.slice(base.length) || "index.html";
    let file = path.resolve(directory, relative);
    if (file !== directory && !file.startsWith(directory + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let status = 200;
    let data;
    try {
      data = await fs.readFile(file);
    } catch {
      if (path.extname(relative)) {
        res.writeHead(404);
        res.end("Asset not found");
        return;
      }
      file = path.join(directory, "404.html");
      data = await fs
        .readFile(file)
        .catch(() => fs.readFile(path.join(directory, "index.html")));
      status = 404;
    }
    res.writeHead(status, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(500);
    res.end("Preview server error");
  }
});
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`PWA preview: http://127.0.0.1:${port}${base}\n`),
);
