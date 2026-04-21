/**
 * COMPREHENSIVE FITMENT DATABASE AUDIT
 * 
 * Checks every vehicle 2000-2026 for:
 * - Tire sizes (oem_tire_sizes)
 * - Wheel specs (oem_wheel_sizes with diameter, width, offset)
 * - Bolt pattern
 * - Hub bore
 * - Trims/modifications
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function audit() {
  const client = await pool.connect();
  
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE FITMENT DATABASE AUDIT');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toISOString()}\n`);

  try {
    // =========================================================================
    // OVERALL STATS
    // =========================================================================
    console.log('📊 OVERALL DATABASE STATS\n');
    
    const totalResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
        COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels,
        COUNT(CASE WHEN bolt_pattern IS NOT NULL AND bolt_pattern != '' THEN 1 END) as has_bolt,
        COUNT(CASE WHEN center_bore_mm IS NOT NULL THEN 1 END) as has_hub,
        COUNT(CASE WHEN 
          oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 AND
          oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 AND
          bolt_pattern IS NOT NULL AND bolt_pattern != '' AND
          center_bore_mm IS NOT NULL
        THEN 1 END) as complete
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
    `);
    
    const stats = totalResult.rows[0];
    console.log(`Total Records (2000-2026): ${stats.total}`);
    console.log(`With Tire Sizes:          ${stats.has_tires} (${(stats.has_tires/stats.total*100).toFixed(1)}%)`);
    console.log(`With Wheel Specs:         ${stats.has_wheels} (${(stats.has_wheels/stats.total*100).toFixed(1)}%)`);
    console.log(`With Bolt Pattern:        ${stats.has_bolt} (${(stats.has_bolt/stats.total*100).toFixed(1)}%)`);
    console.log(`With Hub Bore:            ${stats.has_hub} (${(stats.has_hub/stats.total*100).toFixed(1)}%)`);
    console.log(`COMPLETE (all fields):    ${stats.complete} (${(stats.complete/stats.total*100).toFixed(1)}%)`);

    // =========================================================================
    // BY YEAR BREAKDOWN
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📅 BREAKDOWN BY YEAR\n');
    
    const yearResult = await client.query(`
      SELECT 
        year,
        COUNT(*) as total,
        COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
        COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels,
        COUNT(CASE WHEN 
          oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 AND
          oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 AND
          bolt_pattern IS NOT NULL AND bolt_pattern != '' AND
          center_bore_mm IS NOT NULL
        THEN 1 END) as complete
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
      GROUP BY year
      ORDER BY year DESC
    `);
    
    console.log('Year  | Total | Tires | Wheels | Complete | Coverage');
    console.log('-'.repeat(60));
    for (const row of yearResult.rows) {
      const coverage = row.total > 0 ? (row.complete/row.total*100).toFixed(0) : 0;
      console.log(`${row.year}  | ${String(row.total).padStart(5)} | ${String(row.has_tires).padStart(5)} | ${String(row.has_wheels).padStart(6)} | ${String(row.complete).padStart(8)} | ${coverage}%`);
    }

    // =========================================================================
    // BY MAKE BREAKDOWN  
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🏭 BREAKDOWN BY MAKE (2000-2026)\n');
    
    const makeResult = await client.query(`
      SELECT 
        make,
        COUNT(*) as total,
        COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
        COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels,
        COUNT(CASE WHEN 
          oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 AND
          oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 AND
          bolt_pattern IS NOT NULL AND bolt_pattern != '' AND
          center_bore_mm IS NOT NULL
        THEN 1 END) as complete
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
      GROUP BY make
      ORDER BY total DESC
      LIMIT 50
    `);
    
    console.log('Make               | Total | Tires | Wheels | Complete | Coverage');
    console.log('-'.repeat(70));
    for (const row of makeResult.rows) {
      const coverage = row.total > 0 ? (row.complete/row.total*100).toFixed(0) : 0;
      const makeName = row.make.substring(0, 18).padEnd(18);
      console.log(`${makeName} | ${String(row.total).padStart(5)} | ${String(row.has_tires).padStart(5)} | ${String(row.has_wheels).padStart(6)} | ${String(row.complete).padStart(8)} | ${coverage}%`);
    }

    // =========================================================================
    // PROBLEM VEHICLES - Missing Tires
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('❌ VEHICLES MISSING TIRE SIZES (Popular US Makes, 2015-2026)\n');
    
    const missingTiresResult = await client.query(`
      SELECT year, make, model, COUNT(*) as trim_count
      FROM vehicle_fitments
      WHERE year >= 2015 AND year <= 2026
        AND make IN ('Toyota', 'Honda', 'Ford', 'Chevrolet', 'GMC', 'Ram', 'Dodge', 
                     'Jeep', 'Nissan', 'Hyundai', 'Kia', 'Subaru', 'Mazda', 'Volkswagen',
                     'BMW', 'Mercedes', 'Audi', 'Lexus', 'Acura', 'Infiniti', 'Tesla')
        AND (oem_tire_sizes IS NULL OR jsonb_array_length(oem_tire_sizes) = 0)
      GROUP BY year, make, model
      ORDER BY year DESC, make, model
      LIMIT 100
    `);
    
    if (missingTiresResult.rows.length === 0) {
      console.log('✅ No major gaps in popular US makes!');
    } else {
      console.log(`Found ${missingTiresResult.rows.length} vehicles missing tire sizes:`);
      for (const row of missingTiresResult.rows) {
        console.log(`  ${row.year} ${row.make} ${row.model} (${row.trim_count} trims)`);
      }
    }

    // =========================================================================
    // PROBLEM VEHICLES - Missing Wheel Specs
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('❌ VEHICLES MISSING WHEEL SPECS (Popular US Makes, 2015-2026)\n');
    
    const missingWheelsResult = await client.query(`
      SELECT year, make, model, COUNT(*) as trim_count
      FROM vehicle_fitments
      WHERE year >= 2015 AND year <= 2026
        AND make IN ('Toyota', 'Honda', 'Ford', 'Chevrolet', 'GMC', 'Ram', 'Dodge', 
                     'Jeep', 'Nissan', 'Hyundai', 'Kia', 'Subaru', 'Mazda', 'Volkswagen',
                     'BMW', 'Mercedes', 'Audi', 'Lexus', 'Acura', 'Infiniti', 'Tesla')
        AND (oem_wheel_sizes IS NULL OR jsonb_array_length(oem_wheel_sizes) = 0)
      GROUP BY year, make, model
      ORDER BY year DESC, make, model
      LIMIT 100
    `);
    
    if (missingWheelsResult.rows.length === 0) {
      console.log('✅ No major gaps in popular US makes!');
    } else {
      console.log(`Found ${missingWheelsResult.rows.length} vehicles missing wheel specs:`);
      for (const row of missingWheelsResult.rows) {
        console.log(`  ${row.year} ${row.make} ${row.model} (${row.trim_count} trims)`);
      }
    }

    // =========================================================================
    // SAMPLE DATA CHECK - Verify data quality
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DATA QUALITY SAMPLES\n');
    
    const sampleResult = await client.query(`
      SELECT year, make, model, display_trim, 
             bolt_pattern, center_bore_mm,
             oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year >= 2020 AND year <= 2025
        AND make IN ('Toyota', 'Ford', 'Chevrolet')
        AND oem_tire_sizes IS NOT NULL 
        AND jsonb_array_length(oem_tire_sizes) > 0
      ORDER BY RANDOM()
      LIMIT 10
    `);
    
    for (const row of sampleResult.rows) {
      console.log(`\n${row.year} ${row.make} ${row.model} - ${row.display_trim}`);
      console.log(`  Bolt: ${row.bolt_pattern || 'MISSING'} | Hub: ${row.center_bore_mm || 'MISSING'}mm`);
      console.log(`  Tires: ${JSON.stringify(row.oem_tire_sizes)}`);
      const wheels = row.oem_wheel_sizes || [];
      if (wheels.length > 0) {
        const wheelStr = wheels.map(w => `${w.diameter}"x${w.width}" +${w.offset || '?'}`).join(', ');
        console.log(`  Wheels: ${wheelStr}`);
      } else {
        console.log(`  Wheels: MISSING`);
      }
    }

    // =========================================================================
    // CASE SENSITIVITY CHECK
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔤 CASE SENSITIVITY CHECK\n');
    
    const caseResult = await client.query(`
      SELECT make, COUNT(*) as count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY make
      ORDER BY make
    `);
    
    const makeVariants = {};
    for (const row of caseResult.rows) {
      const lower = row.make.toLowerCase();
      if (!makeVariants[lower]) makeVariants[lower] = [];
      makeVariants[lower].push({ make: row.make, count: row.count });
    }
    
    const problematicMakes = Object.entries(makeVariants).filter(([_, variants]) => variants.length > 1);
    if (problematicMakes.length > 0) {
      console.log('⚠️  FOUND CASE VARIANTS (may cause lookup issues):');
      for (const [_, variants] of problematicMakes) {
        console.log(`  ${variants.map(v => `"${v.make}" (${v.count})`).join(' vs ')}`);
      }
    } else {
      console.log('✅ No problematic case variants found');
    }

    // =========================================================================
    // EXPORT FULL REPORT
    // =========================================================================
    const reportData = {
      generatedAt: new Date().toISOString(),
      overall: stats,
      byYear: yearResult.rows,
      byMake: makeResult.rows,
      missingTires: missingTiresResult.rows,
      missingWheels: missingWheelsResult.rows,
      caseVariants: problematicMakes
    };
    
    fs.writeFileSync('scripts/audit/audit-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n' + '='.repeat(80));
    console.log('📁 Full report saved to: scripts/audit/audit-report.json');
    console.log('='.repeat(80));

  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch(console.error);
