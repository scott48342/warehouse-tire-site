#!/usr/bin/env node
/**
 * Check if test vehicles have config table data vs legacy fallback
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

const TEST_VEHICLES = [
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2025, make: 'Ford', model: 'bronco' },
  { year: 2024, make: 'GMC', model: 'Sierra 1500' },
  { year: 2024, make: 'Chevrolet', model: 'tahoe' },
  { year: 2026, make: 'Toyota', model: '4runner' },
];

async function main() {
  console.log('🔍 Checking data sources for test vehicles\n');
  
  for (const v of TEST_VEHICLES) {
    console.log(`📋 ${v.year} ${v.make} ${v.model}`);
    console.log('─'.repeat(50));
    
    // Check config table
    const configResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM vehicle_fitment_configurations 
      WHERE year = $1 
        AND LOWER(make_key) = LOWER($2) 
        AND LOWER(model_key) = LOWER($3)
    `, [v.year, v.make, v.model]);
    const configCount = parseInt(configResult.rows[0].count);
    
    // Check legacy fitments table
    const fitmentResult = await pool.query(`
      SELECT id, display_trim, oem_tire_sizes 
      FROM vehicle_fitments 
      WHERE year = $1 
        AND LOWER(make) = LOWER($2) 
        AND LOWER(model) = LOWER($3)
      LIMIT 5
    `, [v.year, v.make, v.model]);
    
    console.log(`  Config table rows: ${configCount}`);
    console.log(`  Legacy fitment rows: ${fitmentResult.rows.length}`);
    
    if (fitmentResult.rows.length > 0) {
      console.log(`  Sample tire sizes from legacy:`);
      for (const row of fitmentResult.rows.slice(0, 2)) {
        const sizes = typeof row.oem_tire_sizes === 'string' 
          ? JSON.parse(row.oem_tire_sizes) 
          : row.oem_tire_sizes;
        console.log(`    ${row.display_trim || 'Base'}: ${sizes?.join(', ') || 'none'}`);
      }
    }
    
    // Determine which source API will use
    const source = configCount > 0 ? 'CONFIG TABLE' : 'LEGACY FALLBACK';
    console.log(`  → API will use: ${source}`);
    console.log('');
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
