import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import fs from "node:fs";
import path from "node:path";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk Frontend API proxy — must be mounted BEFORE body parsers (it streams
// raw bytes). No-op in development.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
// Sync requests can batch many records; raise the body limit above the 100kb
// default. Per-record and per-request caps are enforced in the sync route.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Clerk is optional so the app can boot and serve health/static checks without
// auth secrets. Sync routes stay protected by requireAuth and return 401 when
// Clerk is not configured.
if (process.env.CLERK_SECRET_KEY) {
  // Resolve the publishable key from the incoming request host so the same
  // server can serve multiple Clerk custom domains. getClerkProxyHost is shared
  // with clerkProxyMiddleware so both halves agree on the canonical hostname.
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
} else {
  logger.warn(
    "CLERK_SECRET_KEY is not set; auth middleware is disabled and sync routes will return 401.",
  );
}

app.use("/api", router);

const frontendDist = path.resolve(process.cwd(), "../anchor/dist/public");
const frontendIndex = path.join(frontendDist, "index.html");

if (fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(frontendIndex);
  });
} else {
  logger.warn(
    { frontendDist },
    "Frontend build output not found; API-only mode is active.",
  );
}

export default app;
