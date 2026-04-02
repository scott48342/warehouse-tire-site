import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'vehicle_fitments'
    ORDER BY ordinal_position
  `);
  console.log("Columns:", (cols.rows as any[]).map(r => r.column_name).join(", "));
  process.exit(0);
}

main().catch(console.error);
