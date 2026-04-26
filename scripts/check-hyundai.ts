/**
 * Check incomplete Hyundai/Kia records
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Get all incomplete Hyundai records
  const hyundaiResult = await pool.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'hyundai'
      AND (bolt_pattern IS NULL OR oem_wheel_sizes IS NULL)
    ORDER BY model, year
  `);
  
  // Group by model
  const byModel = new Map<string, { years: Set<number>, records: number }>();
  
  for (const h of hyundaiResult.rows) {
    const key = h.model;
    if (!byModel.has(key)) {
      byModel.set(key, { years: new Set(), records: 0 });
    }
    byModel.get(key)!.years.add(h.year);
    byModel.get(key)!.records++;
  }
  
  console.log('=== Incomplete Hyundai Models ===\n');
  for (const [model, data] of [...byModel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const yearArray = [...data.years].sort((a, b) => a - b);
    const yearRange = yearArray.length > 1 
      ? `${yearArray[0]}-${yearArray[yearArray.length - 1]}` 
      : `${yearArray[0]}`;
    console.log(`${model}: ${data.records} records (${yearRange})`);
  }
  console.log(`\nTotal incomplete Hyundai: ${hyundaiResult.rows.length}`);
  
  // Also check Kia
  const kiaResult = await pool.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'kia'
      AND (bolt_pattern IS NULL OR oem_wheel_sizes IS NULL)
    ORDER BY model, year
  `);
  
  if (kiaResult.rows.length > 0) {
    const byKiaModel = new Map<string, { years: Set<number>, records: number }>();
    for (const k of kiaResult.rows) {
      const key = k.model;
      if (!byKiaModel.has(key)) {
        byKiaModel.set(key, { years: new Set(), records: 0 });
      }
      byKiaModel.get(key)!.years.add(k.year);
      byKiaModel.get(key)!.records++;
    }
    
    console.log('\n=== Incomplete Kia Models ===\n');
    for (const [model, data] of [...byKiaModel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const yearArray = [...data.years].sort((a, b) => a - b);
      const yearRange = yearArray.length > 1 
        ? `${yearArray[0]}-${yearArray[yearArray.length - 1]}` 
        : `${yearArray[0]}`;
      console.log(`${model}: ${data.records} records (${yearRange})`);
    }
    console.log(`\nTotal incomplete Kia: ${kiaResult.rows.length}`);
  } else {
    console.log('\nNo incomplete Kia records found.');
  }
  
  // Also check Genesis
  const genesisResult = await pool.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'genesis'
      AND (bolt_pattern IS NULL OR oem_wheel_sizes IS NULL)
  `);
  
  if (genesisResult.rows.length > 0) {
    console.log(`\nIncomplete Genesis: ${genesisResult.rows.length}`);
  }
  
  await pool.end();
}

main().catch(console.error);
