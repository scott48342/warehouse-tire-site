#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

async function main() {
  // Check 2025 Ford Bronco - exactly how the API would query it
  console.log('Testing API lookup patterns:');
  console.log('─'.repeat(60));
  
  // Pattern 1: Exact ILIKE match (what getLegacyFallback probably uses)
  const result1 = await pool.query(`
    SELECT make, model, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE year = 2025 
      AND LOWER(make) = 'ford' 
      AND LOWER(model) = 'bronco'
    LIMIT 3
  `);
  console.log(`Pattern 1 (LOWER exact): ${result1.rows.length} rows`);
  
  // Pattern 2: ILIKE match
  const result2 = await pool.query(`
    SELECT make, model, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE year = 2025 
      AND make ILIKE 'ford' 
      AND model ILIKE 'bronco'
    LIMIT 3
  `);
  console.log(`Pattern 2 (ILIKE): ${result2.rows.length} rows`);
  
  // What are the actual distinct make/model values?
  const distinctResult = await pool.query(`
    SELECT DISTINCT make, model
    FROM vehicle_fitments 
    WHERE year = 2025 
      AND LOWER(make) LIKE '%ford%' 
      AND LOWER(model) LIKE '%bronco%'
  `);
  console.log('\nDistinct make/model values in DB:');
  for (const row of distinctResult.rows) {
    console.log(`  make="${row.make}", model="${row.model}"`);
  }
  
  // Check 2024 GMC Sierra 1500
  console.log('\n' + '─'.repeat(60));
  console.log('Testing 2024 GMC Sierra 1500:');
  const sierra = await pool.query(`
    SELECT DISTINCT make, model
    FROM vehicle_fitments 
    WHERE year = 2024 
      AND LOWER(make) LIKE '%gmc%' 
      AND LOWER(model) LIKE '%sierra%'
  `);
  console.log('Distinct make/model:');
  for (const row of sierra.rows) {
    console.log(`  make="${row.make}", model="${row.model}"`);
  }
  
  // Check 2026 Toyota 4Runner
  console.log('\n' + '─'.repeat(60));
  console.log('Testing 2026 Toyota 4Runner:');
  const runner = await pool.query(`
    SELECT DISTINCT make, model
    FROM vehicle_fitments 
    WHERE year = 2026 
      AND LOWER(make) LIKE '%toyota%' 
      AND LOWER(model) LIKE '%4runner%'
  `);
  console.log('Distinct make/model:');
  for (const row of runner.rows) {
    console.log(`  make="${row.make}", model="${row.model}"`);
  }
  
  // Also try without hyphen
  const runner2 = await pool.query(`
    SELECT DISTINCT make, model
    FROM vehicle_fitments 
    WHERE year = 2026 
      AND LOWER(make) LIKE '%toyota%' 
      AND (LOWER(model) LIKE '%4runner%' OR LOWER(model) LIKE '%4-runner%')
  `);
  console.log('With hyphen variant:');
  for (const row of runner2.rows) {
    console.log(`  make="${row.make}", model="${row.model}"`);
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
