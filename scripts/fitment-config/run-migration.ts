/**
 * Run migration to create vehicle_fitment_configurations table
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

// Create a dedicated pool for migration with explicit SSL
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("POSTGRES_URL not found in environment");
  process.exit(1);
}

console.log("Connecting to:", connectionString.substring(0, 40) + "...");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "vehicle_fitment_configurations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicle_fitment_id" uuid,
  "year" integer NOT NULL,
  "make_key" varchar(100) NOT NULL,
  "model_key" varchar(100) NOT NULL,
  "modification_id" varchar(255),
  "display_trim" varchar(255),
  "configuration_key" varchar(100) NOT NULL,
  "configuration_label" varchar(255),
  "wheel_diameter" integer NOT NULL,
  "wheel_width" decimal(4, 1),
  "wheel_offset_mm" decimal(5, 1),
  "tire_size" varchar(50) NOT NULL,
  "axle_position" varchar(10) NOT NULL DEFAULT 'square',
  "is_default" boolean NOT NULL DEFAULT false,
  "is_optional" boolean NOT NULL DEFAULT false,
  "source" varchar(50) NOT NULL,
  "source_confidence" varchar(20) NOT NULL DEFAULT 'low',
  "source_notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
)
`;

const INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS "fitment_configs_fitment_id_idx" ON "vehicle_fitment_configurations" ("vehicle_fitment_id")`,
  `CREATE INDEX IF NOT EXISTS "fitment_configs_vehicle_lookup_idx" ON "vehicle_fitment_configurations" ("year", "make_key", "model_key")`,
  `CREATE INDEX IF NOT EXISTS "fitment_configs_wheel_dia_idx" ON "vehicle_fitment_configurations" ("year", "make_key", "model_key", "wheel_diameter")`,
];

async function runMigration() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("RUNNING MIGRATION: vehicle_fitment_configurations");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  try {
    // Create table
    console.log("Creating table...");
    await db.execute(sql.raw(MIGRATION_SQL));
    console.log("✓ Table created\n");
    
    // Create indexes
    console.log("Creating indexes...");
    for (const indexSql of INDEX_SQL) {
      try {
        await db.execute(sql.raw(indexSql));
        console.log(`  ✓ ${indexSql.match(/IF NOT EXISTS "([^"]+)"/)?.[1] || 'index'}`);
      } catch (err: any) {
        // Index might already exist
        if (err.message?.includes('already exists')) {
          console.log(`  ⚠ ${indexSql.match(/IF NOT EXISTS "([^"]+)"/)?.[1] || 'index'} (already exists)`);
        } else {
          throw err;
        }
      }
    }
    console.log("\n✓ All indexes created");
    
    // Verify table exists
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'vehicle_fitment_configurations'
    `);
    
    if (result.rows.length > 0) {
      console.log("\n✅ MIGRATION SUCCESSFUL: Table verified");
    } else {
      console.log("\n❌ MIGRATION FAILED: Table not found");
    }
    
  } catch (err) {
    console.error("\n❌ MIGRATION ERROR:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
