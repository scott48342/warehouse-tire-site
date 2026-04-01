/**
 * Visualizer Database Connection
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

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

export const visualizerDb = drizzle(pool, { schema });
export { schema };
