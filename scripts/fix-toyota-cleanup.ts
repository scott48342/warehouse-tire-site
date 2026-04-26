/**
 * Cleanup script: Mark remaining Toyota records as complete
 * Handles edge cases with non-array data formats
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const { Pool } = pg;

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("=== TOYOTA CLEANUP: Mark all with data as complete ===\n");

  // Mark records that have data as complete (handles both array and string formats)
  const result = await pool.query(`
    UPDATE vehicle_fitments SET
      quality_tier = 'complete',
      updated_at = NOW()
    WHERE LOWER(make) = 'toyota'
      AND oem_wheel_sizes IS NOT NULL
      AND oem_tire_sizes IS NOT NULL
      AND (quality_tier IS NULL OR quality_tier != 'complete')
    RETURNING id, year, model, display_trim
  `);
  
  console.log(`Marked ${result.rowCount} records as complete:`);
  for (const row of result.rows.slice(0, 20)) {
    console.log(`  ${row.year} ${row.model} ${row.display_trim || 'Base'}`);
  }
  if (result.rows.length > 20) {
    console.log(`  ... and ${result.rows.length - 20} more`);
  }

  // Check remaining
  const remaining = await pool.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota'
      AND (oem_wheel_sizes IS NULL OR oem_tire_sizes IS NULL OR quality_tier != 'complete')
  `);
  
  console.log(`\nRemaining records needing data: ${remaining.rows[0].count}`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
