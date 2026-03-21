/**
 * Database Connection (Drizzle + node-postgres)
 * 
 * Uses standard pg Pool for better compatibility across environments.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

// Drizzle instance with full schema
export const db = drizzle(pool, { schema });

// Re-export schema for convenience
export { schema };
