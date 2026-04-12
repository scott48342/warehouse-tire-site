/**
 * Find the original source of legacy 15"/16" tire sizes
 * 
 * Traces back through inheritance to find where bad data entered the system
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

async function findSource() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        FINDING ORIGINAL SOURCE OF LEGACY TIRE SIZES           ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Find the OLDEST records with 15" tire sizes for major vehicles
  const { rows: oldestLegacy } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE model IN ('corvette', 'silverado-1500', 'f-150', 'sierra-1500', 'camaro', '1500')
      AND oem_tire_sizes::text LIKE '%R15%'
    ORDER BY year ASC
    LIMIT 30
  `);

  console.log("OLDEST records with R15 tires for modern vehicles:\n");
  
  const byModel = new Map<string, typeof oldestLegacy>();
  for (const r of oldestLegacy) {
    const key = `${r.make}/${r.model}`;
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key)!.push(r);
  }

  for (const [model, records] of byModel) {
    console.log(`\n--- ${model.toUpperCase()} ---`);
    for (const r of records.slice(0, 5)) {
      console.log(`${r.year} "${r.display_trim}"`);
      console.log(`  Source: ${r.source}`);
      console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    }
  }

  // Check if there are records from before 2000 that have the same tire sizes
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("        CHECKING FOR CLASSIC VEHICLE SOURCE RECORDS             ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: classics } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE year < 2000
      AND model IN ('corvette', 'silverado-1500', 'silverado', 'c-k', 'c/k', 'camaro')
    ORDER BY year ASC
    LIMIT 20
  `);

  console.log(`Classic vehicles (pre-2000): ${classics.length} records\n`);
  for (const r of classics.slice(0, 10)) {
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }

  // Check the specific tire size 225/75R15 - where does it appear?
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        TRACING 225/75R15 AND 235/75R15 ORIGINS                 ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: size15Origin } = await pool.query(`
    SELECT 
      year, make, model, display_trim, source,
      oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text LIKE '%225/75R15%' 
       OR oem_tire_sizes::text LIKE '%235/75R15%'
    ORDER BY year ASC
    LIMIT 30
  `);

  console.log(`Records containing 225/75R15 or 235/75R15: ${size15Origin.length}\n`);
  
  // Group by decade
  const byDecade: Record<string, number> = {};
  for (const r of size15Origin) {
    const decade = Math.floor(r.year / 10) * 10;
    byDecade[decade + "s"] = (byDecade[decade + "s"] || 0) + 1;
  }
  
  console.log("By decade:");
  for (const [decade, count] of Object.entries(byDecade).sort()) {
    console.log(`  ${decade}: ${count}`);
  }

  console.log("\nEarliest examples:");
  for (const r of size15Origin.slice(0, 10)) {
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log("");
  }

  // Check what the ACTUAL 2020+ data sources look like for trucks
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        CHECKING 'cache-import' RECORDS FOR SILVERADO           ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: cacheImport } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE model = 'silverado-1500'
      AND source = 'cache-import'
    ORDER BY year DESC
    LIMIT 10
  `);

  console.log(`Silverado records from cache-import: ${cacheImport.length}\n`);
  for (const r of cacheImport) {
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }

  // Find records with CORRECT modern tire sizes
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        SILVERADO RECORDS WITH CORRECT MODERN TIRES (17+)       ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: correctSilverado } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE model = 'silverado-1500'
      AND year >= 2019
      AND oem_tire_sizes::text ~ 'R(17|18|20|22)'
      AND oem_tire_sizes::text NOT LIKE '%R15%'
      AND oem_tire_sizes::text NOT LIKE '%R16%'
    ORDER BY year DESC
    LIMIT 10
  `);

  console.log(`Silverado 2019+ with correct tire sizes (17"+): ${correctSilverado.length}\n`);
  for (const r of correctSilverado) {
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }

  await pool.end();
}

findSource().catch(console.error);
