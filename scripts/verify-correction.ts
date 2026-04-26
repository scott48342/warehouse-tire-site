/**
 * Verify FUTURE_TRIM correction results
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  // Check Lexus LX
  const lx = await pool.query(`
    SELECT year, raw_trim, bolt_pattern, center_bore_mm, 
           oem_wheel_sizes, oem_tire_sizes, certification_status
    FROM vehicle_fitments 
    WHERE make = 'Lexus' AND model = 'lx'
    ORDER BY year, raw_trim
  `);
  
  console.log('=== LEXUS LX VERIFICATION ===');
  console.log(`Total records: ${lx.rows.length}`);
  
  // Group by generation
  const byGen: Record<string, any[]> = {
    'LX 450 (1996-1997)': [],
    'LX 470 (1998-2007)': [],
    'LX 570 (2008-2021)': [],
    'LX 600 era (2022+)': []
  };
  
  for (const r of lx.rows) {
    if (r.year <= 1997) byGen['LX 450 (1996-1997)'].push(r);
    else if (r.year <= 2007) byGen['LX 470 (1998-2007)'].push(r);
    else if (r.year <= 2021) byGen['LX 570 (2008-2021)'].push(r);
    else byGen['LX 600 era (2022+)'].push(r);
  }
  
  for (const [gen, records] of Object.entries(byGen)) {
    console.log(`\n${gen}: ${records.length} records`);
    const trims = new Set(records.map(r => r.raw_trim));
    console.log(`  Trims: ${[...trims].join(', ')}`);
    if (records.length > 0) {
      const sample = records[0];
      console.log(`  Bolt: ${sample.bolt_pattern}, CB: ${sample.center_bore_mm}mm`);
      console.log(`  Status: ${records[0].certification_status}`);
    }
  }
  
  // Overall counts
  const counts = await pool.query(`
    SELECT certification_status, COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY certification_status
    ORDER BY certification_status
  `);
  console.log('\n=== OVERALL CERTIFICATION STATUS ===');
  let totalCertified = 0;
  let totalNeedsReview = 0;
  for (const r of counts.rows) {
    const status = r.certification_status || 'null';
    console.log(`  ${status}: ${r.cnt}`);
    if (status === 'certified') totalCertified = parseInt(r.cnt);
    if (status === 'needs_review') totalNeedsReview = parseInt(r.cnt);
  }
  const total = totalCertified + totalNeedsReview;
  const pctCertified = ((totalCertified / total) * 100).toFixed(1);
  console.log(`\n  Certification rate: ${pctCertified}%`);
  
  // FUTURE_TRIM remaining
  const future = await pool.query(`
    SELECT make, model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    GROUP BY make, model
    ORDER BY cnt DESC
    LIMIT 15
  `);
  console.log('\n=== REMAINING FUTURE_TRIM BY MODEL ===');
  let totalFuture = 0;
  for (const r of future.rows) {
    console.log(`  ${r.make} ${r.model}: ${r.cnt}`);
    totalFuture += parseInt(r.cnt);
  }
  console.log(`\n  Total FUTURE_TRIM remaining: ${totalFuture}`);
  
  await pool.end();
}

verify().catch(console.error);
