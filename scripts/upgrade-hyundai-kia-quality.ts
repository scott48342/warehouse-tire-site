/**
 * Upgrade Hyundai and Kia records from 'high' to 'complete' quality tier
 * These records already have bolt_pattern and oem_wheel_sizes
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  // Check current state
  const hyundaiHigh = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE LOWER(make) = 'hyundai' 
      AND quality_tier = 'high'
      AND bolt_pattern IS NOT NULL
      AND oem_wheel_sizes IS NOT NULL
  `);
  console.log(`\nHyundai 'high' tier with complete data: ${hyundaiHigh.rows[0].cnt}`);
  
  const kiaHigh = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE LOWER(make) = 'kia' 
      AND quality_tier = 'high'
      AND bolt_pattern IS NOT NULL
      AND oem_wheel_sizes IS NOT NULL
  `);
  console.log(`Kia 'high' tier with complete data: ${kiaHigh.rows[0].cnt}`);
  
  if (!dryRun) {
    // Upgrade Hyundai
    const hyundaiResult = await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'complete', updated_at = NOW()
      WHERE LOWER(make) = 'hyundai' 
        AND quality_tier = 'high'
        AND bolt_pattern IS NOT NULL
        AND oem_wheel_sizes IS NOT NULL
    `);
    console.log(`\n✓ Upgraded ${hyundaiResult.rowCount} Hyundai records to 'complete'`);
    
    // Upgrade Kia
    const kiaResult = await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'complete', updated_at = NOW()
      WHERE LOWER(make) = 'kia' 
        AND quality_tier = 'high'
        AND bolt_pattern IS NOT NULL
        AND oem_wheel_sizes IS NOT NULL
    `);
    console.log(`✓ Upgraded ${kiaResult.rowCount} Kia records to 'complete'`);
  } else {
    console.log('\n[DRY] Would upgrade these records to complete tier');
  }
  
  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
