/**
 * Database Connection (Drizzle + Vercel Postgres)
 * 
 * Uses @vercel/postgres for optimized serverless connection pooling.
 * Falls back to node-postgres for local development.
 */

import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { sql } from "@vercel/postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Detect environment - use Vercel Postgres in production, pg Pool locally
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

let db: ReturnType<typeof drizzleVercel> | ReturnType<typeof drizzlePg>;

if (isVercel) {
  // Vercel Postgres - optimized connection pooling for serverless
  db = drizzleVercel(sql, { schema });
} else {
  // Local development - use pg Pool with sensible limits
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : undefined,
  });
  db = drizzlePg(pool, { schema });
}

export { db, schema };
