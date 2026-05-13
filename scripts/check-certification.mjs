#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const vehicles = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2023, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2025, make: 'Ford', model: 'Bronco' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'Ram', model: '3500' },
];

async function main() {
  console.log('Checking certification status of problem vehicles...\n');
  
  for (const v of vehicles) {
    const result = await pool.query(`
      SELECT display_trim, certification_status, quality_tier, oem_tire_sizes 
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
      LIMIT 5
    `, [v.year, v.make, v.model]);
    
    console.log(`${v.year} ${v.make} ${v.model}:`);
    if (result.rows.length === 0) {
      console.log('  NO DATA');
    } else {
      for (const row of result.rows) {
        console.log(`  "${row.display_trim}" → status: ${row.certification_status}, tier: ${row.quality_tier}`);
      }
    }
    console.log('');
  }
  
  // Summary of certification statuses
  const summary = await pool.query(`
    SELECT certification_status, COUNT(*) as count 
    FROM vehicle_fitments 
    GROUP BY certification_status
  `);
  console.log('Overall certification status counts:');
  for (const row of summary.rows) {
    console.log(`  ${row.certification_status}: ${row.count}`);
  }
  
  await pool.end();
}

main();
