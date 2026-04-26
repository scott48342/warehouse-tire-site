/**
 * Check existing records for models
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check Santa Cruz
  const sc = await pool.query(`SELECT year, model, display_trim, bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE LOWER(model) LIKE '%santa cruz%' ORDER BY year LIMIT 20`);
  console.log('Santa Cruz records:');
  for (const r of sc.rows) {
    console.log('  ' + r.year + ' ' + r.model + ' ' + r.display_trim + ' bolt=' + r.bolt_pattern + ' bore=' + r.center_bore_mm);
  }
  
  // Check Carnival
  const cv = await pool.query(`SELECT year, model, display_trim, bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE LOWER(model) LIKE '%carnival%' ORDER BY year LIMIT 20`);
  console.log('\nCarnival records:');
  for (const r of cv.rows) {
    console.log('  ' + r.year + ' ' + r.model + ' ' + r.display_trim + ' bolt=' + r.bolt_pattern + ' bore=' + r.center_bore_mm);
  }
  
  await pool.end();
}

main().catch(console.error);
