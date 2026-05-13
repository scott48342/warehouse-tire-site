#!/usr/bin/env node
/**
 * Check problem vehicles in the database
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const vehicles = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2023, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2025, make: 'Ford', model: 'Bronco' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'Ram', model: '3500' },
];

async function main() {
  console.log('Checking problem vehicles in database...\n');
  
  for (const v of vehicles) {
    // Check vehicle_fitments (legacy table)
    const vfResult = await pool.query(`
      SELECT id, display_trim, bolt_pattern, oem_tire_sizes 
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
    `, [v.year, v.make, v.model]);
    
    // Check vehicle_fitment_configurations (config table)
    const configResult = await pool.query(`
      SELECT id, display_trim, wheel_diameter, tire_size 
      FROM vehicle_fitment_configurations 
      WHERE year = $1 AND make_key ILIKE $2 AND model_key ILIKE $3
    `, [v.year, v.make, v.model]);
    
    console.log(`${v.year} ${v.make} ${v.model}:`);
    console.log(`  vehicle_fitments: ${vfResult.rows.length} rows`);
    if (vfResult.rows.length > 0) {
      const trims = [...new Set(vfResult.rows.map(r => r.display_trim))];
      console.log(`    Trims: ${trims.join(', ')}`);
      const sizes = vfResult.rows[0].oem_tire_sizes || [];
      console.log(`    Sample tire sizes: ${sizes.slice(0, 3).join(', ') || 'none'}`);
    }
    console.log(`  vehicle_fitment_configurations: ${configResult.rows.length} rows`);
    if (configResult.rows.length > 0) {
      const trims = [...new Set(configResult.rows.map(r => r.display_trim))];
      console.log(`    Trims: ${trims.join(', ')}`);
    }
    console.log('');
  }
  
  await pool.end();
}

main().catch(e => {
  console.error(e);
  pool.end();
  process.exit(1);
});
