/**
 * Database Connection Export
 * 
 * Re-exports the Drizzle database instance for general use.
 * Also includes auth schema exports for garage and other auth tables.
 * 
 * For fitment-specific queries, continue using @/lib/fitment-db/db.
 * For auth/garage queries, use this module.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./auth-schema";

// Create a connection pool (shared with fitment-db)
const pool = new Pool({
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

// Export Drizzle instance with auth schema
export const db = drizzle(pool, { schema: authSchema });

// Re-export auth schema for convenience
export * from "./auth-schema";
