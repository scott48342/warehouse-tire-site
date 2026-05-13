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
  console.log('Checking certification_status for test vehicles:');
  console.log('─'.repeat(60));
  
  const vehicles = [
    { year: 2025, make: 'Ford', model: 'bronco' },
    { year: 2024, make: 'GMC', model: 'sierra-1500' },
    { year: 2026, make: 'Toyota', model: '4runner' },
    { year: 2024, make: 'Toyota', model: 'Tacoma' },
  ];
  
  for (const v of vehicles) {
    const result = await pool.query(`
      SELECT make, model, display_trim, certification_status, oem_tire_sizes
      FROM vehicle_fitments 
      WHERE year = $1 
        AND LOWER(make) = LOWER($2) 
        AND LOWER(model) = LOWER($3)
      LIMIT 3
    `, [v.year, v.make, v.model]);
    
    console.log(`\n${v.year} ${v.make} ${v.model}:`);
    if (result.rows.length === 0) {
      console.log('  No records found!');
    } else {
      for (const row of result.rows) {
        const sizes = typeof row.oem_tire_sizes === 'string' 
          ? JSON.parse(row.oem_tire_sizes) 
          : row.oem_tire_sizes;
        console.log(`  Trim: ${row.display_trim}`);
        console.log(`  Status: ${row.certification_status || 'NULL'}`);
        console.log(`  Sizes: ${sizes?.slice(0, 3).join(', ')}${sizes?.length > 3 ? '...' : ''}`);
      }
    }
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
