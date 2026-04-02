const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function analyze() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== TRIM/SUBMODEL ANALYSIS ===\n');
  
  // 1. Vehicles with only 1 trim across all years
  console.log('📋 VEHICLES WITH ONLY 1 TRIM (potential issue):\n');
  const singleTrim = await pool.query(`
    SELECT make, model, COUNT(DISTINCT year) as years, 
           COUNT(*) as records,
           array_agg(DISTINCT display_trim) as trims
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make, model
    HAVING COUNT(DISTINCT display_trim) = 1 AND COUNT(DISTINCT year) >= 5
    ORDER BY COUNT(DISTINCT year) DESC
    LIMIT 30
  `);
  
  for (const row of singleTrim.rows) {
    console.log(`${row.make} ${row.model}: ${row.years} years, only trim: "${row.trims[0]}"`);
  }
  
  // 2. Check high-volume performance vehicles for proper trim splits
  console.log('\n\n🏎️ PERFORMANCE VEHICLE TRIM CHECK:\n');
  const perfVehicles = [
    ['ford', 'mustang'],
    ['chevrolet', 'camaro'],
    ['dodge', 'challenger'],
    ['dodge', 'charger'],
    ['chevrolet', 'corvette'],
    ['ford', 'f-150'],
    ['chevrolet', 'silverado-1500'],
    ['ram', '1500'],
    ['toyota', 'supra'],
    ['nissan', '370z'],
    ['bmw', 'm3'],
    ['bmw', 'm5'],
  ];
  
  for (const [make, model] of perfVehicles) {
    const trims = await pool.query(`
      SELECT array_agg(DISTINCT display_trim) as trims,
             COUNT(DISTINCT display_trim) as trim_count,
             COUNT(DISTINCT year) as years
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2 AND year >= 2000
    `, [make, model]);
    
    const row = trims.rows[0];
    if (row.years > 0) {
      console.log(`${make} ${model}: ${row.trim_count} trims across ${row.years} years`);
      console.log(`  Trims: ${row.trims.slice(0, 5).join(' | ')}${row.trims.length > 5 ? '...' : ''}`);
    }
  }
  
  // 3. Check for "Base" only vehicles that should have more
  console.log('\n\n⚠️ VEHICLES WITH ONLY "Base" TRIM (likely need more):\n');
  const baseOnly = await pool.query(`
    SELECT make, model, COUNT(DISTINCT year) as years
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make, model
    HAVING COUNT(DISTINCT display_trim) = 1 
       AND MAX(display_trim) = 'Base'
       AND COUNT(DISTINCT year) >= 3
    ORDER BY COUNT(DISTINCT year) DESC
  `);
  
  for (const row of baseOnly.rows) {
    console.log(`${row.make} ${row.model}: ${row.years} years with only "Base"`);
  }
  
  // 4. Summary stats
  console.log('\n\n📊 OVERALL TRIM STATS:\n');
  const stats = await pool.query(`
    SELECT 
      COUNT(DISTINCT CONCAT(make, model)) as total_models,
      AVG(trim_count)::numeric(4,1) as avg_trims_per_model
    FROM (
      SELECT make, model, COUNT(DISTINCT display_trim) as trim_count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY make, model
    ) sub
  `);
  console.log(`Total models: ${stats.rows[0].total_models}`);
  console.log(`Avg trims per model: ${stats.rows[0].avg_trims_per_model}`);
  
  const trimDist = await pool.query(`
    SELECT trim_count, COUNT(*) as models
    FROM (
      SELECT make, model, COUNT(DISTINCT display_trim) as trim_count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY make, model
    ) sub
    GROUP BY trim_count
    ORDER BY trim_count
  `);
  console.log('\nTrim distribution:');
  for (const row of trimDist.rows) {
    console.log(`  ${row.trim_count} trim(s): ${row.models} models`);
  }
  
  await pool.end();
}

analyze();
