/**
 * Summary of vehicles in vehicle_fitments table
 * Run with: npx tsx scripts/list-vehicles-summary.ts
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
    // Get summary by year/make/model
    const { rows } = await pool.query(`
      SELECT 
        year,
        make,
        model,
        COUNT(*) as trim_count,
        array_agg(DISTINCT bolt_pattern) as bolt_patterns,
        string_agg(DISTINCT display_trim, ', ') as trims
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY year, make, model
      ORDER BY year DESC, make, model
    `);

    console.log(`\n=== VEHICLES WITH FITMENT DATA (${rows.length} unique Y/M/M) ===\n`);
    
    for (const row of rows) {
      console.log(`${row.year} ${row.make} ${row.model}`);
      console.log(`  Bolt Pattern: ${row.bolt_patterns.join(", ")}`);
      console.log(`  Trims (${row.trim_count}): ${row.trims}`);
      console.log(`  Search URL: /api/wheels/fitment-search?year=${row.year}&make=${encodeURIComponent(row.make)}&model=${encodeURIComponent(row.model)}`);
      console.log();
    }

    // Also show breakdown by make
    const { rows: byMake } = await pool.query(`
      SELECT 
        make,
        COUNT(DISTINCT model) as models,
        COUNT(DISTINCT year || make || model) as ymm_count
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY make
      ORDER BY ymm_count DESC
    `);

    console.log(`\n=== BY MAKE ===\n`);
    for (const row of byMake) {
      console.log(`${row.make}: ${row.ymm_count} Y/M/M combos, ${row.models} models`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
