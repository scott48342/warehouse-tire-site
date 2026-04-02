const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Top vehicles by sales + wheel upgrade popularity
const HIGH_VALUE_VEHICLES = [
  // TIER 1: Must have (highest volume + wheel market)
  { make: 'Ford', model: 'F-150', priority: 1, category: 'truck' },
  { make: 'Chevrolet', model: 'Silverado 1500', priority: 1, category: 'truck' },
  { make: 'Ram', model: '1500', priority: 1, category: 'truck' },
  { make: 'Toyota', model: 'RAV4', priority: 1, category: 'suv' },
  { make: 'Honda', model: 'CR-V', priority: 1, category: 'suv' },
  { make: 'Tesla', model: 'Model Y', priority: 1, category: 'ev' },
  { make: 'Toyota', model: 'Camry', priority: 1, category: 'sedan' },
  { make: 'Honda', model: 'Civic', priority: 1, category: 'sedan' },
  { make: 'Toyota', model: 'Tacoma', priority: 1, category: 'truck' },
  { make: 'Jeep', model: 'Wrangler', priority: 1, category: 'suv' },
  { make: 'Jeep', model: 'Grand Cherokee', priority: 1, category: 'suv' },
  { make: 'Ford', model: 'Explorer', priority: 1, category: 'suv' },
  
  // TIER 2: High value
  { make: 'GMC', model: 'Sierra 1500', priority: 2, category: 'truck' },
  { make: 'Toyota', model: 'Highlander', priority: 2, category: 'suv' },
  { make: 'Honda', model: 'Accord', priority: 2, category: 'sedan' },
  { make: 'Ford', model: 'Mustang', priority: 2, category: 'performance' },
  { make: 'Chevrolet', model: 'Camaro', priority: 2, category: 'performance' },
  { make: 'Dodge', model: 'Challenger', priority: 2, category: 'performance' },
  { make: 'Dodge', model: 'Charger', priority: 2, category: 'performance' },
  { make: 'Toyota', model: 'Tundra', priority: 2, category: 'truck' },
  { make: 'Ford', model: 'Escape', priority: 2, category: 'suv' },
  { make: 'Chevrolet', model: 'Equinox', priority: 2, category: 'suv' },
  { make: 'Honda', model: 'Pilot', priority: 2, category: 'suv' },
  { make: 'Nissan', model: 'Rogue', priority: 2, category: 'suv' },
  { make: 'Tesla', model: 'Model 3', priority: 2, category: 'ev' },
  { make: 'Subaru', model: 'Outback', priority: 2, category: 'suv' },
  { make: 'Subaru', model: 'Forester', priority: 2, category: 'suv' },
  { make: 'Ford', model: 'F-250', priority: 2, category: 'truck' },
  { make: 'Chevrolet', model: 'Silverado 2500', priority: 2, category: 'truck' },
  { make: 'Chevrolet', model: 'Tahoe', priority: 2, category: 'suv' },
  { make: 'Ford', model: 'Expedition', priority: 2, category: 'suv' },
  { make: 'Ford', model: 'Bronco', priority: 2, category: 'suv' },
  
  // TIER 3: Good to have
  { make: 'BMW', model: '3 Series', priority: 3, category: 'luxury' },
  { make: 'BMW', model: '5 Series', priority: 3, category: 'luxury' },
  { make: 'Mercedes-Benz', model: 'C-Class', priority: 3, category: 'luxury' },
  { make: 'Audi', model: 'A4', priority: 3, category: 'luxury' },
  { make: 'Lexus', model: 'RX', priority: 3, category: 'luxury' },
  { make: 'Mazda', model: 'CX-5', priority: 3, category: 'suv' },
  { make: 'Hyundai', model: 'Tucson', priority: 3, category: 'suv' },
  { make: 'Kia', model: 'Sportage', priority: 3, category: 'suv' },
  { make: 'Chevrolet', model: 'Colorado', priority: 3, category: 'truck' },
  { make: 'Ford', model: 'Ranger', priority: 3, category: 'truck' },
];

async function analyze() {
  const client = await pool.connect();
  
  console.log('='.repeat(80));
  console.log('WAREHOUSE TIRE DIRECT - FULL COVERAGE ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  // 1. Overall stats from legacy tables
  const stats = await client.query(`
    SELECT 
      COUNT(DISTINCT make) as makes,
      COUNT(DISTINCT CONCAT(make, model)) as models,
      COUNT(DISTINCT CONCAT(year, make, model)) as ymm_combos,
      COUNT(*) as total_trims,
      MIN(year) as min_year,
      MAX(year) as max_year
    FROM vehicles
  `);
  const s = stats.rows[0];
  
  console.log('📊 VEHICLES TABLE (Current Production Data)');
  console.log('-'.repeat(50));
  console.log(`Makes: ${s.makes}`);
  console.log(`Models: ${s.models}`);
  console.log(`Y/M/M Combos: ${s.ymm_combos}`);
  console.log(`Total Trims: ${s.total_trims}`);
  console.log(`Year Range: ${s.min_year} - ${s.max_year}`);
  console.log();

  // 2. Fitment and wheel specs coverage
  const fitmentStats = await client.query(`
    SELECT 
      COUNT(DISTINCT vf.vehicle_id) as vehicles_with_fitment,
      COUNT(DISTINCT ws.vehicle_id) as vehicles_with_wheel_specs
    FROM vehicles v
    LEFT JOIN vehicle_fitment vf ON vf.vehicle_id = v.id
    LEFT JOIN vehicle_wheel_specs ws ON ws.vehicle_id = v.id
  `);
  const f = fitmentStats.rows[0];
  
  const wheelSpecsCount = await client.query('SELECT COUNT(*) as cnt FROM vehicle_wheel_specs');
  
  console.log('🔧 DATA COVERAGE');
  console.log('-'.repeat(50));
  console.log(`Vehicles with fitment data (bolt pattern, center bore): ${f.vehicles_with_fitment}/${s.total_trims} (${(f.vehicles_with_fitment/s.total_trims*100).toFixed(1)}%)`);
  console.log(`Vehicles with wheel specs (rim sizes, offsets): ${f.vehicles_with_wheel_specs}/${s.total_trims} (${(f.vehicles_with_wheel_specs/s.total_trims*100).toFixed(1)}%)`);
  console.log(`Total wheel spec records: ${wheelSpecsCount.rows[0].cnt}`);
  console.log();

  // 3. Year distribution (recent years)
  const yearDist = await client.query(`
    SELECT 
      v.year,
      COUNT(DISTINCT CONCAT(v.make, v.model)) as models,
      COUNT(DISTINCT v.id) as trims,
      COUNT(DISTINCT vf.vehicle_id) as with_fitment,
      COUNT(DISTINCT ws.vehicle_id) as with_specs
    FROM vehicles v
    LEFT JOIN vehicle_fitment vf ON vf.vehicle_id = v.id
    LEFT JOIN vehicle_wheel_specs ws ON ws.vehicle_id = v.id
    WHERE v.year >= 2018
    GROUP BY v.year
    ORDER BY v.year DESC
  `);
  
  console.log('📅 RECENT YEAR COVERAGE (2018+)');
  console.log('-'.repeat(70));
  console.log('Year  | Models | Trims | With Fitment | With Specs');
  for (const row of yearDist.rows) {
    console.log(`${row.year}  |  ${String(row.models).padStart(4)}  |  ${String(row.trims).padStart(4)} |     ${String(row.with_fitment).padStart(4)}     |    ${String(row.with_specs).padStart(4)}`);
  }
  console.log();

  // 4. High-value vehicle analysis
  console.log('🎯 HIGH-VALUE VEHICLE COVERAGE');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const vehicle of HIGH_VALUE_VEHICLES) {
    // Check vehicles table with fitment and specs
    const vehicleData = await client.query(`
      SELECT 
        v.year,
        v.trim,
        vf.bolt_pattern,
        vf.center_bore,
        ws.rim_diameter
      FROM vehicles v
      LEFT JOIN vehicle_fitment vf ON vf.vehicle_id = v.id
      LEFT JOIN vehicle_wheel_specs ws ON ws.vehicle_id = v.id
      WHERE LOWER(v.make) = LOWER($1) 
        AND (LOWER(v.model) = LOWER($2) OR v.model ILIKE $3)
        AND v.year >= 2018
      ORDER BY v.year DESC
    `, [vehicle.make, vehicle.model, `%${vehicle.model}%`]);
    
    const yearCount = new Set(vehicleData.rows.map(r => r.year)).size;
    const uniqueTrims = new Set(vehicleData.rows.map(r => `${r.year}-${r.trim}`)).size;
    const withFitment = vehicleData.rows.filter(r => r.bolt_pattern).length > 0 ? 
                        new Set(vehicleData.rows.filter(r => r.bolt_pattern).map(r => `${r.year}-${r.trim}`)).size : 0;
    const withSpecs = vehicleData.rows.filter(r => r.rim_diameter).length > 0 ?
                      new Set(vehicleData.rows.filter(r => r.rim_diameter).map(r => `${r.year}-${r.trim}`)).size : 0;
    const sampleTrims = [...new Set(vehicleData.rows.slice(0, 5).map(r => r.trim))];
    const sampleBolt = vehicleData.rows.find(r => r.bolt_pattern)?.bolt_pattern || null;
    
    let status;
    if (yearCount === 0) {
      status = '❌ MISSING';
    } else if (withFitment === 0 && withSpecs === 0) {
      status = '⚠️ NO DATA';
    } else if (withFitment > 0 && withSpecs > 0) {
      status = '✅ COMPLETE';
    } else if (withFitment > 0 || withSpecs > 0) {
      status = '⚠️ PARTIAL';
    } else {
      status = '⚠️ CHECK';
    }
    
    results.push({
      ...vehicle,
      yearCount,
      uniqueTrims,
      withFitment,
      withSpecs,
      status,
      sampleTrims,
      sampleBolt
    });
  }
  
  // Group by priority and display
  for (const priority of [1, 2, 3]) {
    const label = priority === 1 ? 'TIER 1 (Critical - Must Have)' :
                  priority === 2 ? 'TIER 2 (High Value)' :
                  'TIER 3 (Nice to Have)';
    console.log(`\n${label}:`);
    console.log('-'.repeat(70));
    
    const priorityVehicles = results.filter(r => r.priority === priority);
    for (const v of priorityVehicles) {
      const dataInfo = v.withFitment > 0 || v.withSpecs > 0 
        ? `${v.withFitment} fitment, ${v.withSpecs} specs`
        : v.uniqueTrims > 0 ? `${v.uniqueTrims} trims (no specs)` : 'not found';
      console.log(`${v.status} ${v.make} ${v.model} [${v.category}]: ${v.yearCount} years, ${dataInfo}`);
      if (v.sampleTrims.length > 0) {
        console.log(`    Trims: ${v.sampleTrims.slice(0, 4).join(', ')}${v.sampleBolt ? ` | Bolt: ${v.sampleBolt}` : ''}`);
      }
    }
  }
  
  // 5. Summary statistics
  console.log('\n');
  console.log('='.repeat(80));
  console.log('📈 COVERAGE SUMMARY');
  console.log('='.repeat(80));
  
  for (const priority of [1, 2, 3]) {
    const tier = results.filter(r => r.priority === priority);
    const complete = tier.filter(r => r.status === '✅ COMPLETE').length;
    const partial = tier.filter(r => r.status.includes('PARTIAL')).length;
    const noData = tier.filter(r => r.status.includes('NO DATA')).length;
    const missing = tier.filter(r => r.status === '❌ MISSING').length;
    
    const label = priority === 1 ? 'TIER 1' : priority === 2 ? 'TIER 2' : 'TIER 3';
    console.log(`\n${label} (${tier.length} vehicles):`);
    console.log(`  ✅ Complete: ${complete} (${(complete/tier.length*100).toFixed(0)}%)`);
    console.log(`  ⚠️ Partial: ${partial}`);
    console.log(`  ⚠️ No Data: ${noData}`);
    console.log(`  ❌ Missing: ${missing}`);
  }
  
  // Make coverage analysis
  const makeCoverage = await client.query(`
    SELECT 
      v.make,
      COUNT(DISTINCT v.model) as models,
      COUNT(DISTINCT v.id) as trims,
      COUNT(DISTINCT vf.vehicle_id) as with_fitment,
      COUNT(DISTINCT ws.vehicle_id) as with_specs,
      ROUND(100.0 * COUNT(DISTINCT vf.vehicle_id) / NULLIF(COUNT(DISTINCT v.id), 0), 1) as fitment_pct,
      ROUND(100.0 * COUNT(DISTINCT ws.vehicle_id) / NULLIF(COUNT(DISTINCT v.id), 0), 1) as specs_pct
    FROM vehicles v
    LEFT JOIN vehicle_fitment vf ON vf.vehicle_id = v.id
    LEFT JOIN vehicle_wheel_specs ws ON ws.vehicle_id = v.id
    WHERE v.year >= 2018
    GROUP BY v.make
    ORDER BY COUNT(DISTINCT v.id) DESC
  `);
  
  console.log('\n\nMAKE COVERAGE (2018+ vehicles):');
  console.log('-'.repeat(80));
  console.log('Make                | Models | Trims | Fitment % | Specs %');
  console.log('-'.repeat(80));
  for (const row of makeCoverage.rows) {
    console.log(`${row.make.padEnd(20)}|  ${String(row.models).padStart(4)}  |  ${String(row.trims).padStart(4)} |   ${String(row.fitment_pct || 0).padStart(5)}%  |  ${String(row.specs_pct || 0).padStart(5)}%`);
  }
  
  // 6. Gaps to fill
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🔴 PRIORITY GAPS TO FILL');
  console.log('='.repeat(80));
  
  const criticalGaps = results.filter(r => r.priority === 1 && r.status !== '✅ COMPLETE');
  console.log('\nCritical vehicles needing attention:');
  for (const v of criticalGaps) {
    if (v.status === '❌ MISSING') {
      console.log(`  • ${v.make} ${v.model} - Add to database (not found)`);
    } else if (v.withFitment === 0 && v.withSpecs === 0) {
      console.log(`  • ${v.make} ${v.model} - Need fitment + wheel specs (${v.uniqueTrims} trims exist)`);
    } else if (v.withFitment === 0) {
      console.log(`  • ${v.make} ${v.model} - Need fitment data (bolt pattern, center bore)`);
    } else if (v.withSpecs === 0) {
      console.log(`  • ${v.make} ${v.model} - Need wheel specs (rim sizes, offsets)`);
    }
  }
  
  const tier2Gaps = results.filter(r => r.priority === 2 && r.status !== '✅ COMPLETE');
  console.log('\nTier 2 vehicles needing attention:');
  for (const v of tier2Gaps.slice(0, 10)) {
    console.log(`  • ${v.make} ${v.model} - ${v.status}`);
  }
  if (tier2Gaps.length > 10) {
    console.log(`  ... and ${tier2Gaps.length - 10} more`);
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    overall: {
      makes: parseInt(s.makes),
      models: parseInt(s.models),
      ymmCombos: parseInt(s.ymm_combos),
      trims: parseInt(s.total_trims),
      yearRange: [parseInt(s.min_year), parseInt(s.max_year)],
      vehiclesWithFitment: parseInt(f.vehicles_with_fitment),
      vehiclesWithSpecs: parseInt(f.vehicles_with_wheel_specs)
    },
    highValueVehicles: results,
    makeCoverage: makeCoverage.rows,
    criticalGaps: criticalGaps.map(v => ({
      make: v.make,
      model: v.model,
      category: v.category,
      status: v.status,
      yearsPresent: v.yearCount,
      trimsPresent: v.uniqueTrims,
      hasFitment: v.withFitment > 0,
      hasSpecs: v.withSpecs > 0
    }))
  };
  
  fs.writeFileSync('scripts/full-coverage-report.json', JSON.stringify(report, null, 2));
  console.log('\n📁 Full report saved to: scripts/full-coverage-report.json');
  
  client.release();
  await pool.end();
}

analyze().catch(console.error);
