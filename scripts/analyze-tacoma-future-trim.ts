/**
 * Analyze Toyota Tacoma FUTURE_TRIM contamination
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  console.log('Analyzing Toyota Tacoma FUTURE_TRIM contamination...\n');
  
  // Get all needs_review records with FUTURE_TRIM
  const needsReview = await pool.query(`
    SELECT id, year, make, model, raw_trim, 
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_status, certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE make = 'Toyota' 
      AND model = 'tacoma'
      AND certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    ORDER BY year, raw_trim
  `);
  
  console.log(`=== TACOMA NEEDS_REVIEW (FUTURE_TRIM) ===`);
  console.log(`Total: ${needsReview.rows.length}\n`);
  
  // Group by year and trim
  const byYearTrim: Record<string, any[]> = {};
  for (const r of needsReview.rows) {
    const key = `${r.year} | ${r.raw_trim || 'null'}`;
    if (!byYearTrim[key]) byYearTrim[key] = [];
    byYearTrim[key].push(r);
  }
  
  console.log('=== BY YEAR/TRIM ===');
  for (const [key, recs] of Object.entries(byYearTrim).sort()) {
    const errors = recs[0].certification_errors || [];
    const errorMsg = errors[0]?.message || 'unknown';
    console.log(`${key} (${recs.length}) - ${errorMsg.substring(0, 80)}`);
  }
  
  // Get certified Tacoma records for reference
  const certified = await pool.query(`
    SELECT year, raw_trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE make = 'Toyota' 
      AND model = 'tacoma'
      AND certification_status = 'certified'
    ORDER BY year, raw_trim
  `);
  
  console.log(`\n=== CERTIFIED TACOMA RECORDS ===`);
  console.log(`Total: ${certified.rows.length}`);
  
  // Group certified by year range (generations)
  const byGen: Record<string, Set<string>> = {
    'Gen1 (1995-2004)': new Set(),
    'Gen2 (2005-2015)': new Set(),
    'Gen3 (2016-2023)': new Set(),
    'Gen4 (2024+)': new Set()
  };
  
  for (const r of certified.rows) {
    const trim = r.raw_trim || 'Base';
    if (r.year <= 2004) byGen['Gen1 (1995-2004)'].add(trim);
    else if (r.year <= 2015) byGen['Gen2 (2005-2015)'].add(trim);
    else if (r.year <= 2023) byGen['Gen3 (2016-2023)'].add(trim);
    else byGen['Gen4 (2024+)'].add(trim);
  }
  
  console.log('\nCertified trims by generation:');
  for (const [gen, trims] of Object.entries(byGen)) {
    console.log(`  ${gen}: ${[...trims].sort().join(', ') || '(none)'}`);
  }
  
  // Sample contaminated records
  console.log('\n=== SAMPLE CONTAMINATED RECORDS ===');
  const samples = needsReview.rows.slice(0, 10);
  for (const s of samples) {
    console.log(`\n${s.year} "${s.raw_trim}":`);
    console.log(`  Wheels: ${JSON.stringify(s.oem_wheel_sizes)?.substring(0, 100)}`);
    console.log(`  Tires: ${JSON.stringify(s.oem_tire_sizes)}`);
    console.log(`  Bolt: ${s.bolt_pattern}, CB: ${s.center_bore_mm}`);
    const err = s.certification_errors?.[0]?.message || 'unknown';
    console.log(`  Error: ${err}`);
  }
  
  // Analyze what trims appear in what years
  console.log('\n=== ALL TACOMA TRIMS BY YEAR RANGE ===');
  const allTrims = await pool.query(`
    SELECT raw_trim, MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt,
           certification_status
    FROM vehicle_fitments
    WHERE make = 'Toyota' AND model = 'tacoma'
    GROUP BY raw_trim, certification_status
    ORDER BY raw_trim, certification_status
  `);
  
  for (const r of allTrims.rows) {
    const status = r.certification_status === 'certified' ? '✅' : '❌';
    console.log(`${status} "${r.raw_trim || 'null'}": ${r.min_year}-${r.max_year} (${r.cnt})`);
  }
  
  await pool.end();
}

analyze().catch(console.error);
