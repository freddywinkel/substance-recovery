import { Router, type IRouter } from "express";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, syncRecords } from "@workspace/db";
import { SyncRecordsBody, SyncRecordsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import {
  MAX_CHANGES_PER_REQUEST,
  clampPullLimit,
  isOriginAllowed,
  isSyncableKind,
  validateChangePayload,
} from "../lib/sync";

const router: IRouter = Router();

router.post("/sync", requireAuth, async (req, res): Promise<void> => {
  // CSRF defense for the cookie-authenticated mutation.
  if (!isOriginAllowed(req.headers.origin, getClerkProxyHost(req))) {
    res.status(403).json({ error: "Forbidden origin" });
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SyncRecordsBody.safeParse(req.body);
  if (!parsed.success) {
    // Never log payloads — only the validation message.
    req.log.warn({ error: parsed.error.message }, "sync: invalid body");
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { changes, cursor, limit } = parsed.data;

  if (changes.length > MAX_CHANGES_PER_REQUEST) {
    res.status(400).json({ error: "Too many changes in one request" });
    return;
  }

  for (const change of changes) {
    if (!isSyncableKind(change.kind)) {
      res.status(400).json({ error: `Unsupported kind: ${change.kind}` });
      return;
    }
    const check = validateChangePayload(
      change.kind,
      change.recordId,
      change.deleted,
      change.payload,
    );
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }
  }

  const cursorNum = (() => {
    const n = Number(cursor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  })();
  const pullLimit = clampPullLimit(limit);

  const result = await db.transaction(async (tx) => {
    for (const change of changes) {
      // LWW: only overwrite when the incoming change is strictly newer. Every
      // applied write bumps `revision` from the table's owned sequence so other
      // devices see it on their next pull. Sequence gaps (on no-op conflicts)
      // are expected and harmless.
      await tx.execute(sql`
        INSERT INTO sync_records
          (user_id, kind, record_id, payload, client_updated_at, deleted)
        VALUES (
          ${userId},
          ${change.kind},
          ${change.recordId},
          ${JSON.stringify(change.payload ?? {})}::jsonb,
          ${change.clientUpdatedAt},
          ${change.deleted}
        )
        ON CONFLICT (user_id, kind, record_id) DO UPDATE
          SET payload = EXCLUDED.payload,
              client_updated_at = EXCLUDED.client_updated_at,
              deleted = EXCLUDED.deleted,
              revision = nextval(pg_get_serial_sequence('sync_records', 'revision'))
          WHERE EXCLUDED.client_updated_at > sync_records.client_updated_at
      `);
    }

    const rows = await tx
      .select()
      .from(syncRecords)
      .where(
        and(eq(syncRecords.userId, userId), gt(syncRecords.revision, cursorNum)),
      )
      .orderBy(asc(syncRecords.revision))
      .limit(pullLimit + 1);

    const hasMore = rows.length > pullLimit;
    const page = hasMore ? rows.slice(0, pullLimit) : rows;
    const nextCursor = page.length
      ? String(page[page.length - 1].revision)
      : String(cursorNum);

    return { page, hasMore, nextCursor };
  });

  const response = SyncRecordsResponse.parse({
    records: result.page.map((r) => ({
      kind: r.kind,
      recordId: r.recordId,
      payload: r.payload,
      clientUpdatedAt: r.clientUpdatedAt,
      deleted: r.deleted,
      revision: r.revision,
    })),
    cursor: result.nextCursor,
    hasMore: result.hasMore,
    serverTime: Date.now(),
  });

  req.log.info(
    { pushed: changes.length, pulled: response.records.length, hasMore: response.hasMore },
    "sync",
  );

  res.json(response);
});

export default router;
