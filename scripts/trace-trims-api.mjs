#!/usr/bin/env node
/**
 * Trace the trims API resolution path
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Import the normalization functions
function normalizeMake(make) {
  return make
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const vehicles = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
];

async function main() {
  console.log('Tracing trims API resolution...\n');
  
  for (const v of vehicles) {
    const normalizedMake = normalizeMake(v.make);
    const modelSlug = slugify(v.model);
    
    console.log(`${v.year} ${v.make} ${v.model}:`);
    console.log(`  normalizedMake: "${normalizedMake}"`);
    console.log(`  model slug: "${modelSlug}"`);
    
    // Try the exact query the canonicalResolver uses
    const result = await pool.query(`
      SELECT display_trim, modification_id, certification_status
      FROM vehicle_fitments 
      WHERE year = $1 
        AND make ILIKE $2 
        AND model ILIKE $3 
        AND certification_status = 'certified'
      LIMIT 5
    `, [v.year, normalizedMake, v.model]);
    
    console.log(`  ILIKE query (normalized make, exact model): ${result.rows.length} rows`);
    
    // Also try with exact make
    const result2 = await pool.query(`
      SELECT display_trim, modification_id, certification_status
      FROM vehicle_fitments 
      WHERE year = $1 
        AND make ILIKE $2 
        AND model ILIKE $3 
        AND certification_status = 'certified'
      LIMIT 5
    `, [v.year, v.make, v.model]);
    
    console.log(`  ILIKE query (exact make, exact model): ${result2.rows.length} rows`);
    
    // Check what make values actually exist
    const makes = await pool.query(`
      SELECT DISTINCT make FROM vehicle_fitments WHERE year = $1 AND model ILIKE $2
    `, [v.year, v.model]);
    console.log(`  Actual make values in DB: ${makes.rows.map(r => r.make).join(', ')}`);
    
    console.log('');
  }
  
  await pool.end();
}

main();
