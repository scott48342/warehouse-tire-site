/**
 * Database Pool Utility
 * 
 * Provides a reusable pg Pool for direct SQL queries.
 * For Drizzle ORM, use `import { db } from "@/lib/fitment-db/db"` instead.
 */

import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

/**
 * Get or create a database connection pool
 */
export function getDbPool(): pg.Pool | null {
  if (_pool) return _pool;
  
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[db/pool] No database URL configured");
    return null;
  }
  
  _pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === "production" || process.env.VERCEL 
      ? { rejectUnauthorized: false } 
      : (connectionString.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : undefined),
  });
  
  return _pool;
}

/**
 * End the pool connection (for cleanup)
 */
export async function endDbPool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
