const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function report() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== COVERAGE REPORT (2000-2026) ===\n');
  
  // Overall stats
  const total = await pool.query(`
    SELECT COUNT(*) as records, 
           COUNT(DISTINCT make) as makes,
           COUNT(DISTINCT CONCAT(make, '|', model)) as models,
           COUNT(DISTINCT year) as years
    FROM vehicle_fitments WHERE year >= 2000 AND year <= 2026
  `);
  const t = total.rows[0];
  console.log(`📊 OVERALL STATS`);
  console.log(`   Records: ${t.records}`);
  console.log(`   Makes: ${t.makes}`);
  console.log(`   Models: ${t.models}`);
  console.log(`   Years covered: ${t.years} (2000-2026 = 27 years)`);
  
  // Records by year
  console.log('\n📅 RECORDS BY YEAR');
  const byYear = await pool.query(`
    SELECT year, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE year >= 2000 AND year <= 2026
    GROUP BY year ORDER BY year
  `);
  let yearLine = '   ';
  byYear.rows.forEach(r => {
    yearLine += `${r.year.toString().slice(-2)}:${r.cnt} `;
  });
  console.log(yearLine);
  
  // Top 20 makes by record count
  console.log('\n🏭 TOP 20 MAKES BY COVERAGE');
  const byMake = await pool.query(`
    SELECT make, COUNT(*) as records, COUNT(DISTINCT model) as models
    FROM vehicle_fitments WHERE year >= 2000 AND year <= 2026
    GROUP BY make ORDER BY records DESC LIMIT 20
  `);
  byMake.rows.forEach(r => {
    console.log(`   ${r.make.padEnd(18)} ${r.records.toString().padStart(4)} records (${r.models} models)`);
  });
  
  // Check for complete coverage (all 27 years) for top models
  console.log('\n✅ HIGH-VOLUME MODELS WITH FULL 27-YEAR COVERAGE');
  const fullCoverage = await pool.query(`
    SELECT make, model, COUNT(DISTINCT year) as years, COUNT(*) as records
    FROM vehicle_fitments 
    WHERE year >= 2000 AND year <= 2026
    GROUP BY make, model
    HAVING COUNT(DISTINCT year) = 27
    ORDER BY COUNT(*) DESC
    LIMIT 25
  `);
  fullCoverage.rows.forEach(r => {
    console.log(`   ${r.make} ${r.model}: ${r.records} records`);
  });
  console.log(`   ... and ${(await pool.query(`SELECT COUNT(*) FROM (SELECT make, model FROM vehicle_fitments WHERE year >= 2000 AND year <= 2026 GROUP BY make, model HAVING COUNT(DISTINCT year) = 27) sub`)).rows[0].count} total models with full coverage`);
  
  // Models with gaps
  console.log('\n⚠️ MODELS WITH YEAR GAPS (top 15 by gap size)');
  const gaps = await pool.query(`
    SELECT make, model, 
           MIN(year) as min_yr, MAX(year) as max_yr,
           COUNT(DISTINCT year) as covered,
           (MAX(year) - MIN(year) + 1) - COUNT(DISTINCT year) as gaps
    FROM vehicle_fitments 
    WHERE year >= 2000 AND year <= 2026
    GROUP BY make, model
    HAVING (MAX(year) - MIN(year) + 1) - COUNT(DISTINCT year) > 0
    ORDER BY gaps DESC
    LIMIT 15
  `);
  gaps.rows.forEach(r => {
    console.log(`   ${r.make} ${r.model}: ${r.min_yr}-${r.max_yr}, ${r.gaps} missing years`);
  });
  
  // Field completeness
  console.log('\n📋 FIELD COMPLETENESS (2000-2026)');
  const fields = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(bolt_pattern) as bolt,
      COUNT(center_bore_mm) as cb,
      COUNT(offset_min_mm) as off_min,
      COUNT(offset_max_mm) as off_max,
      COUNT(thread_size) as thread,
      COUNT(seat_type) as seat,
      COUNT(oem_wheel_sizes) as wheels,
      COUNT(oem_tire_sizes) as tires
    FROM vehicle_fitments WHERE year >= 2000 AND year <= 2026
  `);
  const f = fields.rows[0];
  console.log(`   Bolt Pattern:   ${f.bolt}/${f.total} (${(f.bolt/f.total*100).toFixed(1)}%)`);
  console.log(`   Center Bore:    ${f.cb}/${f.total} (${(f.cb/f.total*100).toFixed(1)}%)`);
  console.log(`   Offset Min:     ${f.off_min}/${f.total} (${(f.off_min/f.total*100).toFixed(1)}%)`);
  console.log(`   Offset Max:     ${f.off_max}/${f.total} (${(f.off_max/f.total*100).toFixed(1)}%)`);
  console.log(`   Thread Size:    ${f.thread}/${f.total} (${(f.thread/f.total*100).toFixed(1)}%)`);
  console.log(`   Seat Type:      ${f.seat}/${f.total} (${(f.seat/f.total*100).toFixed(1)}%)`);
  console.log(`   Wheel Sizes:    ${f.wheels}/${f.total} (${(f.wheels/f.total*100).toFixed(1)}%)`);
  console.log(`   Tire Sizes:     ${f.tires}/${f.total} (${(f.tires/f.total*100).toFixed(1)}%)`);
  
  await pool.end();
}

report();
