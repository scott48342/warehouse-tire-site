const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function analyze() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Get all makes/models with their year coverage
  const res = await pool.query(`
    SELECT make, model, 
           array_agg(DISTINCT year ORDER BY year) as years,
           MIN(year) as min_yr, MAX(year) as max_yr,
           COUNT(DISTINCT year) as yr_count
    FROM vehicle_fitments
    GROUP BY make, model
    ORDER BY make, model
  `);
  
  console.log('=== VEHICLES WITH INTERNAL YEAR GAPS ===\n');
  
  let gapCount = 0;
  for (const row of res.rows) {
    const years = row.years;
    const gaps = [];
    
    // Check for internal gaps (missing years between min and max)
    for (let y = row.min_yr; y <= row.max_yr; y++) {
      if (!years.includes(y)) gaps.push(y);
    }
    
    if (gaps.length > 0) {
      console.log(`${row.make} ${row.model} (${row.min_yr}-${row.max_yr}): gaps at ${gaps.join(', ')}`);
      gapCount++;
    }
  }
  
  if (gapCount === 0) console.log('No internal year gaps found!');
  
  // Total records
  const total = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  console.log('\nTotal records: ' + total.rows[0].count);
  
  // Show vehicles that don't start at 2000 or end at 2026 (potential edge gaps)
  console.log('\n=== VEHICLES NOT COVERING 2000-2026 (potential missing years) ===\n');
  
  const edgeGaps = res.rows.filter(r => {
    // Exclude known discontinued vehicles
    const discontinued = [
      'camaro:2002', // 2003-2009 not produced
      'pt-cruiser:2010', // ended 2010
      'scion', // brand ended
    ];
    return (r.min_yr > 2000 || r.max_yr < 2026);
  }).slice(0, 30);
  
  for (const row of edgeGaps) {
    console.log(`${row.make} ${row.model}: ${row.min_yr}-${row.max_yr} (${row.yr_count} years)`);
  }
  
  await pool.end();
}

analyze();
