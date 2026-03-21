/**
 * Database Connection (Drizzle + Vercel Postgres)
 */

import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./schema";

// Drizzle instance with full schema
export const db = drizzle(sql, { schema });

// Re-export schema for convenience
export { schema };
