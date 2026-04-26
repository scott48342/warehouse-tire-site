/**
 * Check remaining Tacoma needs_review records
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const result = await pool.query(`
    SELECT id, year, raw_trim, oem_wheel_sizes, oem_tire_sizes, 
           bolt_pattern, center_bore_mm, certification_errors
    FROM vehicle_fitments
    WHERE make = 'Toyota' AND model = 'tacoma'
      AND certification_status = 'needs_review'
    ORDER BY year
  `);
  
  console.log('=== TACOMA STILL NEEDS_REVIEW ===');
  console.log(`Total: ${result.rows.length}\n`);
  
  for (const r of result.rows) {
    console.log(`${r.year} "${r.raw_trim}":`);
    console.log(`  Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`  Tires: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`  Bolt: ${r.bolt_pattern}, CB: ${r.center_bore_mm}`);
    console.log(`  Errors: ${JSON.stringify(r.certification_errors)}\n`);
  }
  
  // Also verify Tacoma certified counts
  const certCounts = await pool.query(`
    SELECT certification_status, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'Toyota' AND model = 'tacoma'
    GROUP BY certification_status
  `);
  
  console.log('=== TACOMA STATUS COUNTS ===');
  for (const r of certCounts.rows) {
    console.log(`  ${r.certification_status}: ${r.cnt}`);
  }
  
  // Check certified trims by generation
  const certTrims = await pool.query(`
    SELECT 
      CASE 
        WHEN year <= 2004 THEN 'Gen1 (1995-2004)'
        WHEN year <= 2015 THEN 'Gen2 (2005-2015)'
        WHEN year <= 2023 THEN 'Gen3 (2016-2023)'
        ELSE 'Gen4 (2024+)'
      END as generation,
      raw_trim,
      COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'Toyota' AND model = 'tacoma'
      AND certification_status = 'certified'
    GROUP BY generation, raw_trim
    ORDER BY generation, raw_trim
  `);
  
  console.log('\n=== CERTIFIED TRIMS BY GENERATION ===');
  let lastGen = '';
  for (const r of certTrims.rows) {
    if (r.generation !== lastGen) {
      console.log(`\n${r.generation}:`);
      lastGen = r.generation;
    }
    console.log(`  ${r.raw_trim || 'null'}: ${r.cnt}`);
  }
  
  await pool.end();
}

check().catch(console.error);
