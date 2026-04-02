const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function analyze() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Luxury/niche makes to check
  const luxuryMakes = [
    'acura', 'audi', 'bmw', 'bentley', 'cadillac', 'infiniti', 'jaguar',
    'lamborghini', 'land-rover', 'lexus', 'lincoln', 'maserati', 'mercedes-benz',
    'porsche', 'tesla', 'volvo', 'alfa-romeo', 'aston-martin', 'ferrari',
    'genesis', 'lotus', 'mclaren', 'mini', 'rolls-royce'
  ];
  
  console.log('=== LUXURY/NICHE VEHICLE GAP ANALYSIS ===\n');
  
  const gaps = [];
  
  for (const make of luxuryMakes) {
    const models = await pool.query(`
      SELECT model, 
             MIN(year) as min_yr, 
             MAX(year) as max_yr,
             COUNT(DISTINCT year) as yr_count,
             array_agg(DISTINCT year ORDER BY year) as years
      FROM vehicle_fitments 
      WHERE make = $1 AND year >= 2000
      GROUP BY model
      ORDER BY model
    `, [make]);
    
    if (models.rows.length === 0) continue;
    
    for (const row of models.rows) {
      const years = row.years;
      const missing = [];
      
      // Check for internal gaps (2000 to max year)
      const startYear = Math.max(2000, row.min_yr);
      for (let y = startYear; y <= row.max_yr; y++) {
        if (!years.includes(y)) missing.push(y);
      }
      
      if (missing.length > 0) {
        gaps.push({
          make,
          model: row.model,
          range: `${row.min_yr}-${row.max_yr}`,
          missing: missing.length,
          missingYears: missing.slice(0, 10).join(', ') + (missing.length > 10 ? '...' : '')
        });
      }
    }
  }
  
  // Sort by number of missing years (most gaps first)
  gaps.sort((a, b) => b.missing - a.missing);
  
  console.log('Vehicles with internal gaps:\n');
  console.log('MAKE            MODEL                RANGE       MISSING  YEARS');
  console.log('─'.repeat(75));
  
  let totalGaps = 0;
  for (const g of gaps) {
    console.log(
      `${g.make.padEnd(15)} ${g.model.padEnd(20)} ${g.range.padEnd(11)} ${String(g.missing).padEnd(8)} ${g.missingYears}`
    );
    totalGaps += g.missing;
  }
  
  console.log('─'.repeat(75));
  console.log(`Total gaps: ${totalGaps} year-vehicles across ${gaps.length} models`);
  
  // Count records by make
  console.log('\n=== RECORDS BY LUXURY MAKE ===\n');
  const counts = await pool.query(`
    SELECT make, COUNT(*) as cnt, COUNT(DISTINCT model) as models
    FROM vehicle_fitments 
    WHERE make = ANY($1) AND year >= 2000
    GROUP BY make
    ORDER BY cnt DESC
  `, [luxuryMakes]);
  
  for (const row of counts.rows) {
    console.log(`${row.make}: ${row.cnt} records (${row.models} models)`);
  }
  
  await pool.end();
}

analyze();
