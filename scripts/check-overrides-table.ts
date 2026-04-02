import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  // Check if fitment_overrides table exists
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fitment_overrides'
  `);
  
  if (tables.rows.length === 0) {
    console.log("fitment_overrides table DOES NOT EXIST");
    console.log("\nCreating table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fitment_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope TEXT NOT NULL CHECK (scope IN ('global', 'year', 'make', 'model', 'modification')),
        year INTEGER,
        make TEXT,
        model TEXT,
        modification_id TEXT,
        display_trim TEXT,
        bolt_pattern TEXT,
        center_bore_mm NUMERIC,
        thread_size TEXT,
        seat_type TEXT,
        offset_min_mm NUMERIC,
        offset_max_mm NUMERIC,
        force_quality BOOLEAN DEFAULT false,
        notes TEXT,
        reason TEXT,
        created_by TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    console.log("Table created!");
  } else {
    // Check columns
    const cols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'fitment_overrides'
      ORDER BY ordinal_position
    `);
    console.log("fitment_overrides columns:", (cols.rows as any[]).map(r => r.column_name).join(", "));
  }
  
  process.exit(0);
}

main().catch(console.error);
