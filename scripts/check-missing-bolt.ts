/**
 * Check records missing bolt pattern for Hyundai and Kia
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const missing = await pool.query(`
    SELECT year, model, display_trim, bolt_pattern, quality_tier
    FROM vehicle_fitments
    WHERE LOWER(make) = 'hyundai' AND bolt_pattern IS NULL
    ORDER BY model, year
  `);
  console.log('Hyundai missing bolt_pattern:');
  for (const r of missing.rows) {
    console.log('  ' + r.year + ' ' + r.model + ' ' + r.display_trim);
  }
  
  const kiaMissing = await pool.query(`
    SELECT year, model, display_trim, bolt_pattern, quality_tier
    FROM vehicle_fitments
    WHERE LOWER(make) = 'kia' AND bolt_pattern IS NULL
    ORDER BY model, year
  `);
  console.log('\nKia missing bolt_pattern:');
  for (const r of kiaMissing.rows) {
    console.log('  ' + r.year + ' ' + r.model + ' ' + r.display_trim);
  }
  
  await pool.end();
}

main().catch(console.error);
