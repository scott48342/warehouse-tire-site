/**
 * Coverage Analysis Script
 * Analyzes vehicle fitment data quality for the "Accept Limited Coverage" strategy
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Top 50 best-selling vehicles in US (based on 2023-2024 sales data)
const HIGH_VALUE_VEHICLES = [
  // Full-size trucks
  { make: 'Ford', model: 'F-150', priority: 1 },
  { make: 'Chevrolet', model: 'Silverado 1500', priority: 1 },
  { make: 'Ram', model: '1500', priority: 1 },
  { make: 'GMC', model: 'Sierra 1500', priority: 1 },
  { make: 'Toyota', model: 'Tundra', priority: 2 },
  { make: 'Nissan', model: 'Titan', priority: 2 },
  
  // HD Trucks
  { make: 'Ford', model: 'F-250', priority: 2 },
  { make: 'Ford', model: 'F-350', priority: 2 },
  { make: 'Chevrolet', model: 'Silverado 2500 HD', priority: 2 },
  { make: 'Chevrolet', model: 'Silverado 3500 HD', priority: 2 },
  { make: 'Ram', model: '2500', priority: 2 },
  { make: 'Ram', model: '3500', priority: 2 },
  
  // Mid-size trucks
  { make: 'Toyota', model: 'Tacoma', priority: 1 },
  { make: 'Chevrolet', model: 'Colorado', priority: 2 },
  { make: 'Ford', model: 'Ranger', priority: 2 },
  { make: 'GMC', model: 'Canyon', priority: 2 },
  { make: 'Nissan', model: 'Frontier', priority: 2 },
  { make: 'Honda', model: 'Ridgeline', priority: 3 },
  
  // Compact/Mid SUVs (highest volume)
  { make: 'Toyota', model: 'RAV4', priority: 1 },
  { make: 'Honda', model: 'CR-V', priority: 1 },
  { make: 'Tesla', model: 'Model Y', priority: 1 },
  { make: 'Toyota', model: 'Highlander', priority: 1 },
  { make: 'Honda', model: 'Pilot', priority: 2 },
  { make: 'Jeep', model: 'Grand Cherokee', priority: 1 },
  { make: 'Jeep', model: 'Wrangler', priority: 1 },
  { make: 'Ford', model: 'Explorer', priority: 1 },
  { make: 'Chevrolet', model: 'Equinox', priority: 2 },
  { make: 'Ford', model: 'Escape', priority: 2 },
  { make: 'Mazda', model: 'CX-5', priority: 2 },
  { make: 'Subaru', model: 'Outback', priority: 2 },
  { make: 'Subaru', model: 'Forester', priority: 2 },
  { make: 'Hyundai', model: 'Tucson', priority: 2 },
  { make: 'Kia', model: 'Sportage', priority: 2 },
  { make: 'Nissan', model: 'Rogue', priority: 2 },
  { make: 'Volkswagen', model: 'Tiguan', priority: 3 },
  
  // Full-size SUVs
  { make: 'Ford', model: 'Expedition', priority: 2 },
  { make: 'Chevrolet', model: 'Tahoe', priority: 2 },
  { make: 'Chevrolet', model: 'Suburban', priority: 2 },
  { make: 'GMC', model: 'Yukon', priority: 2 },
  { make: 'Toyota', model: '4Runner', priority: 2 },
  { make: 'Ford', model: 'Bronco', priority: 2 },
  { make: 'Jeep', model: 'Gladiator', priority: 2 },
  
  // Sedans (still significant)
  { make: 'Toyota', model: 'Camry', priority: 1 },
  { make: 'Honda', model: 'Civic', priority: 1 },
  { make: 'Honda', model: 'Accord', priority: 2 },
  { make: 'Toyota', model: 'Corolla', priority: 2 },
  { make: 'Tesla', model: 'Model 3', priority: 2 },
  { make: 'Nissan', model: 'Altima', priority: 3 },
  { make: 'Hyundai', model: 'Elantra', priority: 3 },
  
  // Performance/Enthusiast vehicles (high wheel upgrade market)
  { make: 'Ford', model: 'Mustang', priority: 2 },
  { make: 'Chevrolet', model: 'Camaro', priority: 2 },
  { make: 'Dodge', model: 'Challenger', priority: 2 },
  { make: 'Dodge', model: 'Charger', priority: 2 },
  { make: 'Chevrolet', model: 'Corvette', priority: 3 },
  { make: 'BMW', model: '3 Series', priority: 3 },
  { make: 'BMW', model: '5 Series', priority: 3 },
];

async function analyzeVehicleCoverage() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('WAREHOUSE TIRE DIRECT - COVERAGE ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    // 1. Overall stats
    const overallStats = await client.query(`
      SELECT 
        COUNT(DISTINCT CONCAT(year, make, model)) AS total_ymm_combos,
        COUNT(*) AS total_fitments,
        COUNT(DISTINCT make) AS total_makes,
        COUNT(DISTINCT CONCAT(make, model)) AS total_models
      FROM vehicle_fitments
    `);
    
    console.log('📊 OVERALL DATABASE STATS');
    console.log('-'.repeat(40));
    console.log(`Total Makes: ${overallStats.rows[0].total_makes}`);
    console.log(`Total Models: ${overallStats.rows[0].total_models}`);
    console.log(`Total Y/M/M Combos: ${overallStats.rows[0].total_ymm_combos}`);
    console.log(`Total Fitment Records: ${overallStats.rows[0].total_fitments}`);
    console.log();

    // 2. Data quality breakdown
    const qualityStats = await client.query(`
      WITH ymm_trims AS (
        SELECT 
          year, make, model,
          COUNT(*) AS trim_count,
          COUNT(CASE WHEN display_trim = 'Base' THEN 1 END) AS base_count,
          bool_and(bolt_pattern IS NOT NULL) AS has_bolt_pattern,
          bool_and(center_bore_mm IS NOT NULL) AS has_center_bore
        FROM vehicle_fitments
        GROUP BY year, make, model
      )
      SELECT
        SUM(CASE WHEN trim_count > 1 AND base_count < trim_count THEN 1 ELSE 0 END) AS real_trims,
        SUM(CASE WHEN trim_count = 1 AND base_count = 1 THEN 1 ELSE 0 END) AS only_base,
        SUM(CASE WHEN has_bolt_pattern AND has_center_bore THEN 1 ELSE 0 END) AS complete_specs,
        COUNT(*) AS total
      FROM ymm_trims
    `);
    
    const quality = qualityStats.rows[0];
    console.log('📋 DATA QUALITY BREAKDOWN');
    console.log('-'.repeat(40));
    console.log(`Y/M/M with real trims: ${quality.real_trims} (${(quality.real_trims/quality.total*100).toFixed(1)}%)`);
    console.log(`Y/M/M with only "Base": ${quality.only_base} (${(quality.only_base/quality.total*100).toFixed(1)}%)`);
    console.log(`Y/M/M with complete specs: ${quality.complete_specs} (${(quality.complete_specs/quality.total*100).toFixed(1)}%)`);
    console.log();

    // 3. Year coverage (focus on 2015-2026)
    const yearStats = await client.query(`
      SELECT 
        year,
        COUNT(DISTINCT CONCAT(make, model)) AS model_count,
        COUNT(*) AS trim_count,
        ROUND(100.0 * COUNT(CASE WHEN display_trim != 'Base' THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS real_trim_pct
      FROM vehicle_fitments
      WHERE year >= 2015
      GROUP BY year
      ORDER BY year DESC
    `);
    
    console.log('📅 YEAR COVERAGE (2015-2026)');
    console.log('-'.repeat(60));
    console.log('Year  | Models | Trims | Real Trim %');
    console.log('-'.repeat(60));
    for (const row of yearStats.rows) {
      console.log(`${row.year}  | ${String(row.model_count).padStart(6)} | ${String(row.trim_count).padStart(5)} | ${row.real_trim_pct || 0}%`);
    }
    console.log();

    // 4. High-value vehicle analysis
    console.log('🎯 HIGH-VALUE VEHICLE COVERAGE');
    console.log('='.repeat(80));
    
    const results = [];
    for (const vehicle of HIGH_VALUE_VEHICLES) {
      const vehicleData = await client.query(`
        SELECT 
          year,
          COUNT(*) AS trim_count,
          COUNT(CASE WHEN display_trim != 'Base' THEN 1 END) AS real_trims,
          bool_and(bolt_pattern IS NOT NULL) AS has_bolt_pattern,
          array_agg(DISTINCT display_trim) AS trims
        FROM vehicle_fitments
        WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) AND year >= 2018
        GROUP BY year
        ORDER BY year DESC
      `, [vehicle.make, vehicle.model]);
      
      const yearCount = vehicleData.rows.length;
      const totalTrims = vehicleData.rows.reduce((sum, r) => sum + parseInt(r.trim_count), 0);
      const realTrims = vehicleData.rows.reduce((sum, r) => sum + parseInt(r.real_trims), 0);
      const hasCompleteData = vehicleData.rows.some(r => r.has_bolt_pattern);
      
      const status = yearCount === 0 ? '❌ MISSING' :
                     realTrims > 0 ? '✅ GOOD' :
                     hasCompleteData ? '⚠️ BASE ONLY' : '❌ INCOMPLETE';
      
      results.push({
        ...vehicle,
        years: yearCount,
        totalTrims,
        realTrims,
        hasCompleteData,
        status,
        sampleTrims: vehicleData.rows[0]?.trims?.slice(0, 3) || []
      });
    }
    
    // Group by priority
    for (const priority of [1, 2, 3]) {
      const priorityLabel = priority === 1 ? 'TIER 1 (Must Have)' : 
                           priority === 2 ? 'TIER 2 (High Value)' : 
                           'TIER 3 (Nice to Have)';
      console.log(`\n${priorityLabel}:`);
      console.log('-'.repeat(70));
      
      const priorityVehicles = results.filter(r => r.priority === priority);
      for (const v of priorityVehicles) {
        const trimInfo = v.realTrims > 0 ? `${v.realTrims}/${v.totalTrims} real trims` : 
                        v.totalTrims > 0 ? `${v.totalTrims} Base trims` : 'none';
        console.log(`${v.status} ${v.make} ${v.model}: ${v.years} years, ${trimInfo}`);
        if (v.sampleTrims.length > 0 && v.realTrims > 0) {
          console.log(`    Sample trims: ${v.sampleTrims.join(', ')}`);
        }
      }
    }
    
    // 5. Summary stats
    const tier1 = results.filter(r => r.priority === 1);
    const tier1Good = tier1.filter(r => r.status === '✅ GOOD').length;
    const tier1BaseOnly = tier1.filter(r => r.status === '⚠️ BASE ONLY').length;
    const tier1Missing = tier1.filter(r => r.status === '❌ MISSING' || r.status === '❌ INCOMPLETE').length;
    
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📈 SUMMARY');
    console.log('='.repeat(80));
    console.log();
    console.log('TIER 1 (Must Have) Status:');
    console.log(`  ✅ Good data: ${tier1Good}/${tier1.length} vehicles`);
    console.log(`  ⚠️ Base only: ${tier1BaseOnly}/${tier1.length} vehicles`);
    console.log(`  ❌ Missing/Incomplete: ${tier1Missing}/${tier1.length} vehicles`);
    console.log();
    
    // 6. Makes with best/worst coverage
    const makeCoverage = await client.query(`
      WITH make_stats AS (
        SELECT 
          make,
          COUNT(DISTINCT model) AS models,
          COUNT(*) AS total_trims,
          COUNT(CASE WHEN display_trim != 'Base' THEN 1 END) AS real_trims
        FROM vehicle_fitments
        WHERE year >= 2018
        GROUP BY make
      )
      SELECT 
        make, 
        models, 
        total_trims, 
        real_trims,
        ROUND(100.0 * real_trims / NULLIF(total_trims, 0), 1) AS real_trim_pct
      FROM make_stats
      ORDER BY real_trim_pct DESC, total_trims DESC
    `);
    
    console.log('MAKES WITH BEST COVERAGE (2018+, by real trim %):');
    console.log('-'.repeat(60));
    for (const row of makeCoverage.rows.slice(0, 10)) {
      console.log(`  ${row.make}: ${row.models} models, ${row.real_trim_pct || 0}% real trims (${row.real_trims}/${row.total_trims})`);
    }
    
    console.log('\nMAKES WITH WORST COVERAGE:');
    console.log('-'.repeat(60));
    for (const row of makeCoverage.rows.slice(-10)) {
      console.log(`  ${row.make}: ${row.models} models, ${row.real_trim_pct || 0}% real trims (${row.real_trims}/${row.total_trims})`);
    }
    
    // 7. Output JSON for documentation
    const reportData = {
      timestamp: new Date().toISOString(),
      overall: overallStats.rows[0],
      quality: quality,
      highValueVehicles: results,
      makeCoverage: makeCoverage.rows
    };
    
    const fs = require('fs');
    fs.writeFileSync('scripts/coverage-analysis-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n📁 Full report saved to: scripts/coverage-analysis-report.json');
    
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeVehicleCoverage().catch(console.error);
