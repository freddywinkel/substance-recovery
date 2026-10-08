import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import https from "node:https";
import test from "node:test";
import express from "express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "../src/middlewares/clerkProxyMiddleware.ts";

const SYNTHETIC_SECRET = "synthetic-test-only-secret";

function setEnvironment(t, environment, secret) {
  const previousEnvironment = process.env.NODE_ENV;
  const previousSecret = process.env.CLERK_SECRET_KEY;
  process.env.NODE_ENV = environment;
  if (secret === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = secret;
  t.after(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = previousSecret;
  });
}

async function listen(t, server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });
  return server.address().port;
}

async function openProxy(t, upstreamHandler) {
  setEnvironment(t, "production", SYNTHETIC_SECRET);
  const upstreamPort = await listen(t, http.createServer(upstreamHandler));

  // Exercise the real httpxy transport against loopback. Assert the production
  // target before replacing only its network destination; no Clerk call occurs.
  t.mock.method(https, "request", (options, callback) => {
    assert.equal(options.hostname, "frontend-api.clerk.dev");
    assert.equal(options.rejectUnauthorized, true);
    return http.request(
      {
        ...options,
        protocol: "http:",
        host: "127.0.0.1",
        hostname: "127.0.0.1",
        port: upstreamPort,
        agent: false,
      },
      callback,
    );
  });

  const app = express();
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
  app.use(express.json());
  app.use((_req, res) => res.status(404).end("next middleware"));
  return listen(t, http.createServer(app));
}

async function request(port, path, options = {}, body) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      { hostname: "127.0.0.1", port, path, ...options },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

test("Clerk proxy selects the first forwarded host and falls back to Host", () => {
  assert.equal(
    getClerkProxyHost({ headers: { "x-forwarded-host": ["public.test, relay.test"], host: "internal.test" } }),
    "public.test",
  );
  assert.equal(getClerkProxyHost({ headers: { "x-forwarded-host": "  ", host: "fallback.test" } }), "fallback.test");
  assert.equal(getClerkProxyHost({ headers: {} }), undefined);
});

test("Clerk proxy is a no-op outside production", (t) => {
  setEnvironment(t, "development", SYNTHETIC_SECRET);
  let nextCalls = 0;
  clerkProxyMiddleware()({}, {}, () => nextCalls++);
  assert.equal(nextCalls, 1);
});

test("Clerk proxy is a no-op without a secret", (t) => {
  setEnvironment(t, "production", undefined);
  let nextCalls = 0;
  clerkProxyMiddleware()({}, {}, () => nextCalls++);
  assert.equal(nextCalls, 1);
});

test("Clerk proxy streams raw bodies and preserves path, query, headers and cookies", async (t) => {
  let received;
  const port = await openProxy(t, (req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
      res.writeHead(207, {
        "Content-Type": "application/json",
        "Set-Cookie": ["first=one; HttpOnly", "second=two; Secure"],
        "X-Upstream": "synthetic",
      });
      res.end('{"ok":true}');
    });
  });
  const rawBody = '{"unparsed":"a\\nb","unicode":"é"}';
  const response = await request(
    port,
    `${CLERK_PROXY_PATH}/v1/client?redirect_url=https%3A%2F%2Fpublic.test%2Fdone`,
    {
      method: "POST",
      headers: {
        host: "internal.test",
        "x-forwarded-host": "public.test, relay.test",
        "x-forwarded-proto": "https",
        "x-forwarded-for": "192.0.2.1, 192.0.2.2",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(rawBody),
        cookie: "synthetic=session",
        "clerk-secret-key": "untrusted-incoming-value",
      },
    },
    rawBody,
  );
  assert.equal(received.method, "POST");
  assert.equal(received.url, "/v1/client?redirect_url=https%3A%2F%2Fpublic.test%2Fdone");
  assert.equal(received.body, rawBody);
  assert.equal(received.headers.host, "frontend-api.clerk.dev");
  assert.equal(received.headers["clerk-proxy-url"], `https://public.test${CLERK_PROXY_PATH}`);
  assert.equal(received.headers["clerk-secret-key"], SYNTHETIC_SECRET);
  assert.equal(received.headers["x-forwarded-for"], "192.0.2.1");
  assert.equal(received.headers.cookie, "synthetic=session");
  assert.equal(response.status, 207);
  assert.equal(response.body, '{"ok":true}');
  assert.equal(response.headers["x-upstream"], "synthetic");
  assert.deepEqual(response.headers["set-cookie"], ["first=one; HttpOnly", "second=two; Secure"]);
});

test("Clerk proxy uses Host and socket IP when forwarding headers are absent", async (t) => {
  let received;
  const port = await openProxy(t, (req, res) => {
    received = req.headers;
    res.end("ok");
  });
  assert.equal((await request(port, `${CLERK_PROXY_PATH}/v1/client`, { headers: { host: "fallback.test" } })).status, 200);
  assert.equal(received["clerk-proxy-url"], `https://fallback.test${CLERK_PROXY_PATH}`);
  assert.match(received["x-forwarded-for"], /127\.0\.0\.1$/);
  assert.equal((await request(port, "/unrelated")).status, 404);
});

test("Clerk proxy completes a failed connection without exposing request details", async (t) => {
  const port = await openProxy(t, (req) => req.socket.destroy());
  const response = await request(port, `${CLERK_PROXY_PATH}/v1/client?private=synthetic`);
  assert.equal(response.status, 504);
  assert.equal(response.body, "Authentication proxy unavailable.");
  assert.ok(!response.body.includes(SYNTHETIC_SECRET));
  assert.ok(!response.body.includes("private"));
});

test("Clerk proxy handles synchronous transport errors without an unhandled error event", async (t) => {
  const port = await openProxy(t, (_req, res) => res.end("unused"));
  t.mock.method(https, "request", () => {
    throw Object.assign(new Error("synthetic failure"), { code: "HPE_INVALID_HEADER_TOKEN" });
  });
  const response = await request(port, `${CLERK_PROXY_PATH}/v1/client`);
  assert.equal(response.status, 502);
  assert.equal(response.body, "Authentication proxy unavailable.");
});

test("Clerk proxy closes an unfinished upstream response when the client disconnects", async (t) => {
  const upstreamClosed = Promise.withResolvers();
  const port = await openProxy(t, (_req, res) => {
    res.on("close", () => upstreamClosed.resolve());
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("data: synthetic\n\n");
  });
  await new Promise((resolve, reject) => {
    const outgoing = http.get({ hostname: "127.0.0.1", port, path: `${CLERK_PROXY_PATH}/events` }, (res) => {
      res.once("data", (chunk) => {
        assert.match(chunk.toString(), /synthetic/);
        res.destroy();
        resolve();
      });
    });
    outgoing.on("error", reject);
  });
  let timeout;
  try {
    await Promise.race([
      upstreamClosed.promise,
      new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("Upstream did not close")), 2000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
});
