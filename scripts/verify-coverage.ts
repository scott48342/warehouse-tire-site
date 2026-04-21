/**
 * Verify coverage and data integrity
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

async function main() {
  console.log('=== VERIFICATION REPORT ===\n');
  
  // 1. Overall stats
  const stats = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT (year::text || '|' || make || '|' || model)) as unique_vehicles,
      COUNT(*) as total_records,
      COUNT(DISTINCT make) as unique_makes,
      COUNT(DISTINCT model) as unique_models,
      MIN(year) as min_year,
      MAX(year) as max_year
    FROM vehicle_fitments
    WHERE year >= 2000
  `);
  
  const s = stats.rows[0] as any;
  console.log('Overall Stats:');
  console.log(`  Unique Y/M/M: ${s.unique_vehicles}`);
  console.log(`  Total records: ${s.total_records}`);
  console.log(`  Makes: ${s.unique_makes}`);
  console.log(`  Models: ${s.unique_models}`);
  console.log(`  Years: ${s.min_year} - ${s.max_year}`);
  
  // 2. Breakdown by source
  const bySource = await db.execute(sql`
    SELECT source, COUNT(*) as cnt, COUNT(DISTINCT (year::text || '|' || make || '|' || model)) as unique_vehicles
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY source
    ORDER BY cnt DESC
  `);
  
  console.log('\nBy Source:');
  bySource.rows.forEach((r: any) => console.log(`  ${r.source}: ${r.cnt} records (${r.unique_vehicles} unique vehicles)`));
  
  // 3. Check for records without bolt patterns
  const noBolt = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE year >= 2000 AND (bolt_pattern IS NULL OR bolt_pattern = '')
  `);
  console.log(`\nRecords without bolt pattern: ${(noBolt.rows[0] as any).cnt}`);
  
  // 4. Sample of gap-filled records
  const gapFilled = await db.execute(sql`
    SELECT year, make, model, display_trim, bolt_pattern, source
    FROM vehicle_fitments
    WHERE source = 'catalog-gap-fill'
    ORDER BY make, model, year
    LIMIT 15
  `);
  
  console.log('\nSample of gap-filled records:');
  gapFilled.rows.forEach((r: any) => {
    console.log(`  ${r.year} ${r.make} ${r.model} (${r.display_trim}) - ${r.bolt_pattern}`);
  });
  
  // 5. Verify major makes have coverage for recent years
  const recentCoverage = await db.execute(sql`
    SELECT make, COUNT(DISTINCT year) as years, COUNT(DISTINCT model) as models
    FROM vehicle_fitments
    WHERE year >= 2020
    GROUP BY make
    ORDER BY models DESC
    LIMIT 20
  `);
  
  console.log('\nMajor makes coverage (2020+):');
  recentCoverage.rows.forEach((r: any) => {
    console.log(`  ${r.make}: ${r.models} models across ${r.years} years`);
  });
  
  // 6. Check for any orphaned/invalid data
  const invalid = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE year < 2000 OR year > 2030 OR make IS NULL OR model IS NULL
  `);
  console.log(`\nInvalid records: ${(invalid.rows[0] as any).cnt}`);
  
  // 7. Regression check - verify existing high-quality data wasn't touched
  const originalRecords = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE source NOT IN ('catalog-gap-fill', 'nhtsa-gap-fill', 'manual')
    AND year >= 2000
  `);
  console.log(`\nOriginal source records preserved: ${(originalRecords.rows[0] as any).cnt}`);
  
  console.log('\n=== VERIFICATION COMPLETE ===');
  
  await pool.end();
}

main().catch(console.error);
