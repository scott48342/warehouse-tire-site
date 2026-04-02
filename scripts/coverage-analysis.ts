import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql } from "drizzle-orm";

async function analyze() {
  // Total unique Y/M/M combinations in fitment DB
  const ymmCount = await db.execute(sql`
    SELECT COUNT(DISTINCT (year, make, model)) as count FROM vehicle_fitments
  `);
  
  // Total fitment records
  const totalRecords = await db.execute(sql`SELECT COUNT(*) as count FROM vehicle_fitments`);
  
  // Unique makes
  const makeCount = await db.execute(sql`SELECT COUNT(DISTINCT make) as count FROM vehicle_fitments`);
  
  // Unique models
  const modelCount = await db.execute(sql`SELECT COUNT(DISTINCT (make, model)) as count FROM vehicle_fitments`);
  
  // Year range
  const yearRange = await db.execute(sql`
    SELECT MIN(year) as min_year, MAX(year) as max_year FROM vehicle_fitments
  `);
  
  // Coverage by year (recent years)
  const byYear = await db.execute(sql`
    SELECT year, COUNT(DISTINCT (make, model)) as models, COUNT(*) as trims
    FROM vehicle_fitments
    WHERE year >= 2020
    GROUP BY year
    ORDER BY year DESC
  `);
  
  // Top makes by coverage
  const topMakes = await db.execute(sql`
    SELECT make, 
           COUNT(DISTINCT model) as models, 
           COUNT(DISTINCT (year, make, model)) as ymm_combos,
           COUNT(*) as total_trims
    FROM vehicle_fitments
    GROUP BY make
    ORDER BY ymm_combos DESC
    LIMIT 20
  `);
  
  // Popular models coverage check
  const popularCheck = await db.execute(sql`
    SELECT make, model, MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as trims
    FROM vehicle_fitments
    WHERE (make = 'ford' AND model IN ('f-150', 'mustang', 'explorer', 'escape', 'bronco'))
       OR (make = 'toyota' AND model IN ('camry', 'corolla', 'rav4', 'tacoma', '4runner'))
       OR (make = 'honda' AND model IN ('civic', 'accord', 'cr-v', 'pilot'))
       OR (make = 'chevrolet' AND model IN ('silverado-1500', 'camaro', 'equinox', 'tahoe', 'corvette'))
       OR (make = 'ram' AND model = '1500')
       OR (make = 'jeep' AND model IN ('wrangler', 'grand-cherokee'))
    GROUP BY make, model
    ORDER BY make, model
  `);
  
  // Models with gaps (have some years but missing others in range)
  const gaps = await db.execute(sql`
    WITH model_years AS (
      SELECT make, model, MIN(year) as min_year, MAX(year) as max_year, 
             COUNT(DISTINCT year) as actual_years,
             MAX(year) - MIN(year) + 1 as expected_years
      FROM vehicle_fitments
      GROUP BY make, model
    )
    SELECT make, model, min_year, max_year, actual_years, expected_years,
           expected_years - actual_years as missing_years
    FROM model_years
    WHERE expected_years - actual_years > 5
    ORDER BY missing_years DESC
    LIMIT 15
  `);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FITMENT COVERAGE ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log("SUMMARY:");
  console.log(`  Total fitment records:     ${Number(totalRecords.rows[0].count).toLocaleString()}`);
  console.log(`  Unique Y/M/M combinations: ${Number(ymmCount.rows[0].count).toLocaleString()}`);
  console.log(`  Unique makes:              ${makeCount.rows[0].count}`);
  console.log(`  Unique make/models:        ${modelCount.rows[0].count}`);
  console.log(`  Year range:                ${yearRange.rows[0].min_year} - ${yearRange.rows[0].max_year}`);
  console.log();
  
  console.log("COVERAGE BY RECENT YEAR:");
  for (const row of byYear.rows as any[]) {
    console.log(`  ${row.year}: ${row.models} models, ${row.trims} trims`);
  }
  console.log();
  
  console.log("TOP 20 MAKES BY Y/M/M COVERAGE:");
  for (const row of topMakes.rows as any[]) {
    console.log(`  ${row.make}: ${row.models} models, ${row.ymm_combos} Y/M/M, ${row.total_trims} trims`);
  }
  console.log();
  
  console.log("POPULAR MODELS CHECK:");
  for (const row of popularCheck.rows as any[]) {
    console.log(`  ${row.make} ${row.model}: ${row.min_year}-${row.max_year} (${row.trims} trims)`);
  }
  console.log();
  
  console.log("MODELS WITH YEAR GAPS (>5 missing years in range):");
  for (const row of gaps.rows as any[]) {
    console.log(`  ${row.make} ${row.model}: ${row.min_year}-${row.max_year}, has ${row.actual_years}/${row.expected_years} years (${row.missing_years} gaps)`);
  }
  
  process.exit(0);
}

analyze().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
