require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== MODERN DOMESTIC VEHICLE AUDIT (2000-2026) ===\n');
    
    // Overall stats
    const total = await client.query(`
      SELECT COUNT(*) as cnt, COUNT(DISTINCT make) as makes, COUNT(DISTINCT model) as models
      FROM vehicle_fitments WHERE year >= 2000 AND year <= 2026
    `);
    console.log(`Total records: ${total.rows[0].cnt}`);
    console.log(`Makes: ${total.rows[0].makes}`);
    console.log(`Models: ${total.rows[0].models}\n`);
    
    // Domestic makes coverage
    const domesticMakes = ['Chevrolet', 'Ford', 'Dodge', 'GMC', 'Jeep', 'Ram', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler'];
    
    console.log('--- DOMESTIC MAKE COVERAGE ---\n');
    for (const make of domesticMakes) {
      const result = await client.query(`
        SELECT 
          COUNT(*) as records,
          COUNT(DISTINCT model) as models,
          COUNT(DISTINCT year) as years,
          MIN(year) as min_year,
          MAX(year) as max_year
        FROM vehicle_fitments 
        WHERE make ILIKE $1 AND year >= 2000 AND year <= 2026
      `, [make]);
      const r = result.rows[0];
      if (r.records > 0) {
        console.log(`${make}: ${r.records} records, ${r.models} models, ${r.min_year}-${r.max_year}`);
      } else {
        console.log(`${make}: NO RECORDS`);
      }
    }
    
    // Popular modern domestic vehicles - check coverage
    console.log('\n\n--- POPULAR MODEL COVERAGE CHECK ---\n');
    
    const popularModels = [
      // Ford trucks/SUVs
      { make: 'Ford', model: 'F-150', years: '2000-2026' },
      { make: 'Ford', model: 'F-250', years: '2000-2026' },
      { make: 'Ford', model: 'F-350', years: '2000-2026' },
      { make: 'Ford', model: 'Ranger', years: '2000-2012,2019-2026' },
      { make: 'Ford', model: 'Bronco', years: '2021-2026' },
      { make: 'Ford', model: 'Bronco Sport', years: '2021-2026' },
      { make: 'Ford', model: 'Explorer', years: '2000-2026' },
      { make: 'Ford', model: 'Expedition', years: '2000-2026' },
      { make: 'Ford', model: 'Escape', years: '2001-2026' },
      { make: 'Ford', model: 'Edge', years: '2007-2026' },
      // Ford cars
      { make: 'Ford', model: 'Mustang', years: '2000-2026' },
      { make: 'Ford', model: 'Focus', years: '2000-2018' },
      { make: 'Ford', model: 'Fusion', years: '2006-2020' },
      { make: 'Ford', model: 'Taurus', years: '2000-2019' },
      // Chevy trucks/SUVs
      { make: 'Chevrolet', model: 'Silverado 1500', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Silverado 2500HD', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Silverado 3500HD', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Colorado', years: '2004-2026' },
      { make: 'Chevrolet', model: 'Tahoe', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Suburban', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Traverse', years: '2009-2026' },
      { make: 'Chevrolet', model: 'Equinox', years: '2005-2026' },
      { make: 'Chevrolet', model: 'Blazer', years: '2019-2026' },
      { make: 'Chevrolet', model: 'Trailblazer', years: '2002-2009,2021-2026' },
      // Chevy cars
      { make: 'Chevrolet', model: 'Camaro', years: '2010-2024' },
      { make: 'Chevrolet', model: 'Corvette', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Malibu', years: '2000-2026' },
      { make: 'Chevrolet', model: 'Impala', years: '2000-2020' },
      { make: 'Chevrolet', model: 'Cruze', years: '2011-2019' },
      // Dodge
      { make: 'Dodge', model: 'Challenger', years: '2008-2026' },
      { make: 'Dodge', model: 'Charger', years: '2006-2026' },
      { make: 'Dodge', model: 'Durango', years: '2000-2026' },
      // Ram
      { make: 'Ram', model: '1500', years: '2011-2026' },
      { make: 'Ram', model: '2500', years: '2011-2026' },
      { make: 'Ram', model: '3500', years: '2011-2026' },
      // GMC
      { make: 'GMC', model: 'Sierra 1500', years: '2000-2026' },
      { make: 'GMC', model: 'Sierra 2500HD', years: '2000-2026' },
      { make: 'GMC', model: 'Yukon', years: '2000-2026' },
      { make: 'GMC', model: 'Acadia', years: '2007-2026' },
      { make: 'GMC', model: 'Canyon', years: '2004-2026' },
      // Jeep
      { make: 'Jeep', model: 'Wrangler', years: '2000-2026' },
      { make: 'Jeep', model: 'Grand Cherokee', years: '2000-2026' },
      { make: 'Jeep', model: 'Cherokee', years: '2000-2026' },
      { make: 'Jeep', model: 'Gladiator', years: '2020-2026' },
      { make: 'Jeep', model: 'Compass', years: '2007-2026' },
      // Cadillac
      { make: 'Cadillac', model: 'Escalade', years: '2000-2026' },
      { make: 'Cadillac', model: 'CT5', years: '2020-2026' },
      { make: 'Cadillac', model: 'XT5', years: '2017-2026' },
    ];
    
    const missing = [];
    const partial = [];
    const complete = [];
    
    for (const v of popularModels) {
      const result = await client.query(`
        SELECT MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt,
               COUNT(DISTINCT display_trim) as trims
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND model ILIKE $2 AND year >= 2000 AND year <= 2026
      `, [v.make, v.model]);
      
      const r = result.rows[0];
      if (r.cnt === '0' || r.cnt === 0) {
        missing.push(v);
      } else {
        // Check if coverage is reasonable
        const expectedYears = v.years.includes(',') ? 20 : 
          (parseInt(v.years.split('-')[1]) - parseInt(v.years.split('-')[0]) + 1);
        const actualYears = r.max_year - r.min_year + 1;
        
        if (actualYears < expectedYears * 0.7) {
          partial.push({ ...v, actual: `${r.min_year}-${r.max_year}`, count: r.cnt, trims: r.trims });
        } else {
          complete.push({ ...v, actual: `${r.min_year}-${r.max_year}`, count: r.cnt, trims: r.trims });
        }
      }
    }
    
    console.log(`✅ COMPLETE (${complete.length}):`);
    complete.forEach(v => console.log(`   ${v.make} ${v.model}: ${v.actual} (${v.count} records, ${v.trims} trims)`));
    
    console.log(`\n⚠️  PARTIAL (${partial.length}):`);
    partial.forEach(v => console.log(`   ${v.make} ${v.model}: ${v.actual} (${v.count} records) - expected ${v.years}`));
    
    console.log(`\n❌ MISSING (${missing.length}):`);
    missing.forEach(v => console.log(`   ${v.make} ${v.model} (${v.years})`));
    
    // Check trim coverage for key performance vehicles
    console.log('\n\n--- PERFORMANCE TRIM CHECK ---\n');
    
    const perfVehicles = [
      { make: 'Ford', model: 'Mustang', expectedTrims: ['Base', 'GT', 'EcoBoost', 'Shelby GT350', 'Shelby GT500', 'Mach 1', 'Dark Horse'] },
      { make: 'Chevrolet', model: 'Camaro', expectedTrims: ['Base', 'LT', 'SS', 'ZL1', '1LE'] },
      { make: 'Chevrolet', model: 'Corvette', expectedTrims: ['Base', 'Z06', 'ZR1', 'Grand Sport', 'Stingray'] },
      { make: 'Dodge', model: 'Challenger', expectedTrims: ['SXT', 'R/T', 'Scat Pack', 'Hellcat', 'Demon', 'Redeye'] },
      { make: 'Dodge', model: 'Charger', expectedTrims: ['SXT', 'R/T', 'Scat Pack', 'Hellcat', 'Redeye'] },
    ];
    
    for (const car of perfVehicles) {
      const result = await client.query(`
        SELECT ARRAY_AGG(DISTINCT display_trim ORDER BY display_trim) as trims,
               COUNT(DISTINCT display_trim) as trim_count
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND model ILIKE $2 AND year >= 2000 AND year <= 2026
      `, [car.make, car.model]);
      
      const actualTrims = result.rows[0]?.trims?.filter(t => t) || [];
      console.log(`${car.make} ${car.model} (${result.rows[0].trim_count} trims):`);
      console.log(`   Has: ${actualTrims.slice(0, 10).join(', ')}${actualTrims.length > 10 ? '...' : ''}`);
      
      const missing = car.expectedTrims.filter(t => 
        !actualTrims.some(a => a && a.toLowerCase().includes(t.toLowerCase().split(' ')[0]))
      );
      if (missing.length > 0) {
        console.log(`   ⚠️  Missing: ${missing.join(', ')}`);
      }
    }
    
    // Data quality check
    console.log('\n\n--- DATA QUALITY CHECK ---\n');
    
    const quality = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE bolt_pattern IS NULL OR bolt_pattern = '') as missing_bolt,
        COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as missing_hub,
        COUNT(*) FILTER (WHERE offset_min_mm IS NULL OR offset_max_mm IS NULL) as missing_offset,
        COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null') as missing_tires,
        COUNT(*) FILTER (WHERE thread_size IS NULL OR thread_size = '') as missing_thread
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
        AND make IN ('Ford', 'Chevrolet', 'Dodge', 'Ram', 'GMC', 'Jeep', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler')
    `);
    
    const q = quality.rows[0];
    console.log(`Total domestic records (2000-2026): ${q.total}`);
    console.log(`Missing bolt_pattern: ${q.missing_bolt} (${(q.missing_bolt/q.total*100).toFixed(1)}%)`);
    console.log(`Missing center_bore_mm: ${q.missing_hub} (${(q.missing_hub/q.total*100).toFixed(1)}%)`);
    console.log(`Missing offset range: ${q.missing_offset} (${(q.missing_offset/q.total*100).toFixed(1)}%)`);
    console.log(`Missing oem_tire_sizes: ${q.missing_tires} (${(q.missing_tires/q.total*100).toFixed(1)}%)`);
    console.log(`Missing thread_size: ${q.missing_thread} (${(q.missing_thread/q.total*100).toFixed(1)}%)`);
    
    // Sample some records to verify data accuracy
    console.log('\n\n--- SAMPLE DATA VERIFICATION ---\n');
    console.log('Spot-checking fitment specs against known values:\n');
    
    const spotChecks = [
      { year: 2024, make: 'Ford', model: 'F-150', expected: { bolt: '6x135', hub: '87.1' } },
      { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', expected: { bolt: '6x139.7', hub: '78.1' } },
      { year: 2024, make: 'Ram', model: '1500', expected: { bolt: '6x139.7', hub: '77.8' } },
      { year: 2024, make: 'Jeep', model: 'Wrangler', expected: { bolt: '5x127', hub: '71.5' } },
      { year: 2024, make: 'Ford', model: 'Mustang', expected: { bolt: '5x114.3', hub: '70.5' } },
      { year: 2024, make: 'Chevrolet', model: 'Corvette', expected: { bolt: '5x120', hub: '70.3' } },
      { year: 2024, make: 'Dodge', model: 'Challenger', expected: { bolt: '5x115', hub: '71.5' } },
    ];
    
    for (const check of spotChecks) {
      const result = await client.query(`
        SELECT bolt_pattern, center_bore_mm, display_trim
        FROM vehicle_fitments
        WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
        LIMIT 1
      `, [check.year, check.make, check.model]);
      
      if (result.rows.length === 0) {
        console.log(`❌ ${check.year} ${check.make} ${check.model}: NO DATA`);
      } else {
        const r = result.rows[0];
        const boltOk = r.bolt_pattern === check.expected.bolt;
        const hubOk = Math.abs(parseFloat(r.center_bore_mm) - parseFloat(check.expected.hub)) < 1;
        const status = boltOk && hubOk ? '✅' : '⚠️';
        console.log(`${status} ${check.year} ${check.make} ${check.model}: bolt=${r.bolt_pattern} (expect ${check.expected.bolt}), hub=${r.center_bore_mm}mm (expect ${check.expected.hub}mm)`);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
