import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let poolInstance: pg.Pool | undefined;
let dbInstance: ReturnType<typeof drizzle> | undefined;

function getPool() {
  if (!poolInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }
    poolInstance = new Pool({ connectionString: databaseUrl });
  }
  return poolInstance;
}

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const p = getPool();
    const value = (p as any)[prop];
    return typeof value === "function" ? value.bind(p) : value;
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const d = getDb();
    const value = (d as any)[prop];
    return typeof value === "function" ? value.bind(d) : value;
  },
});

export * from "./schema";
