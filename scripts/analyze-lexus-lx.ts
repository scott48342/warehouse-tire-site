/**
 * Analyze Lexus LX FUTURE_TRIM contamination
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  console.log('Analyzing Lexus LX FUTURE_TRIM contamination...');
  
  // Get all Lexus LX (lowercase) needs_review records
  const needsReview = await pool.query(`
    SELECT id, year, make, model, raw_trim as trim, 
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_status, certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE make = 'Lexus' 
      AND model = 'lx'
      AND certification_status = 'needs_review'
    ORDER BY year, raw_trim
  `);
  
  console.log('\n=== LEXUS LX NEEDS_REVIEW RECORDS ===');
  console.log('Total:', needsReview.rows.length);
  
  // Group by year and trim
  const byYearTrim: Record<string, any[]> = {};
  for (const r of needsReview.rows) {
    const key = `${r.year} | ${r.trim || 'null'}`;
    if (!byYearTrim[key]) byYearTrim[key] = [];
    byYearTrim[key].push(r);
  }
  
  console.log('\n=== BY YEAR/TRIM ===');
  for (const [key, recs] of Object.entries(byYearTrim).sort()) {
    const errors = recs[0].certification_errors || [];
    console.log(`${key} (${recs.length}) - ${JSON.stringify(errors)}`);
  }
  
  // Also check certified LX records for reference
  const certified = await pool.query(`
    SELECT year, raw_trim as trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE make = 'Lexus' 
      AND model = 'lx'
      AND certification_status = 'certified'
    ORDER BY year, raw_trim
  `);
  
  console.log('\n=== CERTIFIED LX RECORDS (reference) ===');
  console.log('Total:', certified.rows.length);
  
  const certByYear: Record<number, any[]> = {};
  for (const r of certified.rows) {
    if (!certByYear[r.year]) certByYear[r.year] = [];
    certByYear[r.year].push({
      trim: r.trim || 'Base',
      wheels: r.oem_wheel_sizes,
      tires: r.oem_tire_sizes,
      bolt: r.bolt_pattern,
      cb: r.center_bore_mm
    });
  }
  
  for (const [year, data] of Object.entries(certByYear).sort()) {
    console.log(`\n${year}:`);
    for (const d of data) {
      console.log(`  ${d.trim}: ${JSON.stringify(d.wheels)} / ${JSON.stringify(d.tires)}`);
      console.log(`    Bolt: ${d.bolt}, CB: ${d.cb}`);
    }
  }
  
  // Analyze what trims exist in data
  const allTrims = await pool.query(`
    SELECT DISTINCT raw_trim, year, certification_status, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'Lexus' AND model = 'lx'
    GROUP BY raw_trim, year, certification_status
    ORDER BY year, raw_trim
  `);
  
  console.log('\n=== TRIMS BY YEAR ===');
  let lastYear = 0;
  for (const r of allTrims.rows) {
    if (r.year !== lastYear) {
      console.log(`\n${r.year}:`);
      lastYear = r.year;
    }
    const status = r.certification_status === 'needs_review' ? '❌' : '✅';
    console.log(`  ${status} ${r.raw_trim || 'null'}: ${r.cnt}`);
  }
  
  // Sample contaminated records
  console.log('\n=== SAMPLE CONTAMINATED RECORDS ===');
  const samples = needsReview.rows.slice(0, 8);
  for (const s of samples) {
    console.log(`\n${s.year} ${s.trim}:`);
    console.log('  Wheels:', JSON.stringify(s.oem_wheel_sizes));
    console.log('  Tires:', JSON.stringify(s.oem_tire_sizes));
    console.log('  Errors:', JSON.stringify(s.certification_errors));
  }
  
  await pool.end();
  process.exit(0);
}

analyze().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
