/**
 * Vehicle Coverage Audit Script
 * 
 * Phase 1: Check current DB coverage
 * Phase 2: Compare against NHTSA master list
 * Phase 3: Identify gaps
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

async function getCurrentCoverage() {
  console.log('=== PHASE 1: CURRENT COVERAGE ===\n');
  
  // Get current coverage stats
  const stats = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT (year::text || '|' || make || '|' || model)) as unique_vehicles,
      COUNT(*) as total_records,
      MIN(year) as min_year,
      MAX(year) as max_year,
      COUNT(DISTINCT make) as unique_makes,
      COUNT(DISTINCT model) as unique_models
    FROM vehicle_fitments
    WHERE year >= 2000
  `);

  console.log('Current DB Coverage (2000+):');
  console.log(JSON.stringify(stats.rows[0], null, 2));

  // Get makes breakdown
  const makes = await db.execute(sql`
    SELECT make, COUNT(DISTINCT model) as models, COUNT(DISTINCT year) as years
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make
    ORDER BY models DESC
  `);

  console.log('\nAll Makes in DB:');
  makes.rows.forEach((r: any) => {
    console.log(`  ${r.make}: ${r.models} models across ${r.years} years`);
  });

  // Get year distribution
  const yearDist = await db.execute(sql`
    SELECT year, COUNT(DISTINCT (make || '|' || model)) as vehicles
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year
    ORDER BY year
  `);

  console.log('\nVehicles per Year:');
  yearDist.rows.forEach((r: any) => {
    console.log(`  ${r.year}: ${r.vehicles} vehicles`);
  });

  return {
    stats: stats.rows[0],
    makes: makes.rows,
    yearDist: yearDist.rows
  };
}

async function main() {
  try {
    const coverage = await getCurrentCoverage();
    
    // Output summary
    console.log('\n=== SUMMARY ===');
    const s = coverage.stats as any;
    console.log(`Total unique Y/M/M combinations: ${s.unique_vehicles}`);
    console.log(`Total fitment records: ${s.total_records}`);
    console.log(`Makes: ${s.unique_makes}`);
    console.log(`Year range: ${s.min_year} - ${s.max_year}`);
    
  } catch (err) {
    console.error('Error:', err);
  }
  
  await pool.end();
  process.exit(0);
}

main();
