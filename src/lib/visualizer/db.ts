/**
 * Visualizer Database Connection
 * 
 * Uses lazy initialization to avoid build-time errors
 */

import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let _pool: Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.NODE_ENV === "production" || process.env.VERCEL 
        ? { rejectUnauthorized: false } 
        : (process.env.POSTGRES_URL?.includes('sslmode=require') 
            ? { rejectUnauthorized: false } 
            : undefined),
    });
  }
  return _pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Proxy that lazily initializes the DB on first access
export const visualizerDb = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };
