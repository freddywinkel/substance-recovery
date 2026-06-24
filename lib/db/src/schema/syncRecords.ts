import {
  pgTable,
  text,
  jsonb,
  bigint,
  bigserial,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// Generic per-record sync backstore. The server is intentionally "dumb": it
// stores one opaque JSONB payload per (userId, kind, recordId) and orders
// changes with a globally monotonic `revision` so clients can pull everything
// newer than their last cursor. Last-write-wins is resolved on
// `clientUpdatedAt` (epoch ms, monotonic per device). Deletes are tombstones
// (deleted=true) so they propagate across devices.
export const syncRecords = pgTable(
  "sync_records",
  {
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    recordId: text("record_id").notNull(),
    payload: jsonb("payload").notNull(),
    clientUpdatedAt: bigint("client_updated_at", { mode: "number" }).notNull(),
    // bigserial gives every write a monotonically increasing revision; the
    // owned sequence is bumped on update via nextval(pg_get_serial_sequence(...)).
    revision: bigserial("revision", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind, t.recordId] }),
    // Pull query: WHERE user_id = ? AND revision > cursor ORDER BY revision.
    index("sync_records_user_revision_idx").on(t.userId, t.revision),
  ],
);

export type SyncRecordRow = typeof syncRecords.$inferSelect;
