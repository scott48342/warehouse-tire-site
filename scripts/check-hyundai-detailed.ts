/**
 * Detailed check of Hyundai/Kia records
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== Hyundai Analysis ===\n');
  
  // Total
  const total = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'hyundai'`);
  console.log('Total Hyundai records:', total.rows[0].cnt);
  
  // Quality tier breakdown
  const byQuality = await pool.query(`
    SELECT quality_tier, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE LOWER(make) = 'hyundai'
    GROUP BY quality_tier
    ORDER BY cnt DESC
  `);
  console.log('\nBy quality_tier:');
  for (const r of byQuality.rows) {
    console.log(`  ${r.quality_tier || 'NULL'}: ${r.cnt}`);
  }
  
  // Missing data breakdown
  const missingBolt = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'hyundai' AND bolt_pattern IS NULL`);
  const missingWheel = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'hyundai' AND oem_wheel_sizes IS NULL`);
  const missingTire = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'hyundai' AND oem_tire_sizes IS NULL`);
  
  console.log('\nMissing data:');
  console.log('  Missing bolt_pattern:', missingBolt.rows[0].cnt);
  console.log('  Missing oem_wheel_sizes:', missingWheel.rows[0].cnt);
  console.log('  Missing oem_tire_sizes:', missingTire.rows[0].cnt);
  
  // Show models NOT marked as complete
  const notComplete = await pool.query(`
    SELECT year, model, display_trim, quality_tier, bolt_pattern, 
           CASE WHEN oem_wheel_sizes IS NOT NULL THEN 'yes' ELSE 'no' END as has_wheel,
           CASE WHEN oem_tire_sizes IS NOT NULL THEN 'yes' ELSE 'no' END as has_tire
    FROM vehicle_fitments
    WHERE LOWER(make) = 'hyundai'
      AND (quality_tier != 'complete' OR quality_tier IS NULL)
    ORDER BY model, year
    LIMIT 50
  `);
  
  console.log('\nFirst 50 not marked complete:');
  for (const r of notComplete.rows) {
    console.log(`  ${r.year} ${r.model} ${r.display_trim} - tier=${r.quality_tier || 'NULL'}, bolt=${r.bolt_pattern || 'NULL'}, wheel=${r.has_wheel}, tire=${r.has_tire}`);
  }
  
  // Same for Kia
  console.log('\n=== Kia Analysis ===\n');
  
  const kiaTotal = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'kia'`);
  console.log('Total Kia records:', kiaTotal.rows[0].cnt);
  
  const kiaByQuality = await pool.query(`
    SELECT quality_tier, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE LOWER(make) = 'kia'
    GROUP BY quality_tier
    ORDER BY cnt DESC
  `);
  console.log('\nBy quality_tier:');
  for (const r of kiaByQuality.rows) {
    console.log(`  ${r.quality_tier || 'NULL'}: ${r.cnt}`);
  }
  
  const kiaMissingBolt = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'kia' AND bolt_pattern IS NULL`);
  const kiaMissingWheel = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'kia' AND oem_wheel_sizes IS NULL`);
  
  console.log('\nMissing data:');
  console.log('  Missing bolt_pattern:', kiaMissingBolt.rows[0].cnt);
  console.log('  Missing oem_wheel_sizes:', kiaMissingWheel.rows[0].cnt);
  
  await pool.end();
}

main().catch(console.error);
