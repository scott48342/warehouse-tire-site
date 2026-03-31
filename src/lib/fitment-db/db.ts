/**
 * Database Connection (Drizzle + node-postgres)
 * 
 * Uses node-postgres (pg) for both local and Vercel deployments.
 * The Vercel Postgres integration was migrated to Neon, so we use
 * the standard pg Pool with the POSTGRES_URL connection string.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create a connection pool with sensible serverless defaults
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Enable SSL for production (Neon requires SSL)
  ssl: process.env.NODE_ENV === "production" || process.env.VERCEL 
    ? { rejectUnauthorized: false } 
    : (process.env.POSTGRES_URL?.includes('sslmode=require') 
        ? { rejectUnauthorized: false } 
        : undefined),
});

const db = drizzle(pool, { schema });

export { db, schema };
