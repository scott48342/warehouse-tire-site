/**
 * List all vehicles in the vehicle_fitments table
 * Run with: npx tsx scripts/list-vehicles.ts
 */

import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("Missing DATABASE_URL or POSTGRES_URL");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  try {
    // Get all unique year/make/model/modification combinations
    const { rows } = await pool.query(`
      SELECT 
        year,
        make,
        model,
        modification_id,
        display_trim,
        bolt_pattern,
        center_bore_mm
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      ORDER BY year DESC, make, model, display_trim
    `);

    console.log(`Found ${rows.length} vehicle fitment records\n`);
    
    // Output as CSV
    console.log("year,make,model,modification_id,display_trim,bolt_pattern,center_bore_mm");
    for (const row of rows) {
      const line = [
        row.year,
        `"${row.make}"`,
        `"${row.model}"`,
        `"${row.modification_id}"`,
        `"${row.display_trim || ""}"`,
        row.bolt_pattern || "",
        row.center_bore_mm || "",
      ].join(",");
      console.log(line);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
