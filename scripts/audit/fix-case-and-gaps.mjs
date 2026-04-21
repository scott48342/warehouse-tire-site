/**
 * Fix case sensitivity issues and identify specific gaps
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function fix() {
  const client = await pool.connect();
  
  console.log('='.repeat(80));
  console.log('FIXING CASE ISSUES & IDENTIFYING GAPS');
  console.log('='.repeat(80));

  try {
    // =========================================================================
    // FIX CASE SENSITIVITY - Normalize all makes to lowercase
    // =========================================================================
    console.log('\n🔧 FIXING CASE ISSUES\n');
    
    // Find all case variants
    const variants = await client.query(`
      SELECT make, COUNT(*) as count
      FROM vehicle_fitments
      WHERE make != LOWER(make)
      GROUP BY make
      ORDER BY count DESC
    `);
    
    if (variants.rows.length > 0) {
      console.log('Converting to lowercase:');
      for (const row of variants.rows) {
        console.log(`  "${row.make}" (${row.count} records) → "${row.make.toLowerCase()}"`);
        
        // Check if lowercase version exists
        const existing = await client.query(`
          SELECT COUNT(*) as count FROM vehicle_fitments WHERE make = $1
        `, [row.make.toLowerCase()]);
        
        if (parseInt(existing.rows[0].count) > 0) {
          // Lowercase exists - need to merge or handle duplicates
          console.log(`    ⚠️  Lowercase "${row.make.toLowerCase()}" already exists (${existing.rows[0].count} records)`);
          // For now, just update the make to lowercase - duplicates will be handled by unique index or later cleanup
        }
        
        await client.query(`
          UPDATE vehicle_fitments SET make = LOWER(make) WHERE make = $1
        `, [row.make]);
      }
      console.log('\n✅ Case issues fixed');
    } else {
      console.log('✅ No case issues found');
    }

    // =========================================================================
    // IDENTIFY SPECIFIC GAPS IN LOW-COVERAGE MAKES
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DETAILED GAP ANALYSIS FOR LOW-COVERAGE MAKES\n');
    
    const lowCoverageMakes = ['hyundai', 'kia', 'honda', 'volkswagen', 'mitsubishi', 'mini'];
    
    for (const make of lowCoverageMakes) {
      console.log(`\n--- ${make.toUpperCase()} ---`);
      
      // Get models missing tire sizes
      const gaps = await client.query(`
        SELECT model, 
               COUNT(*) as total,
               COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
               MIN(year) as min_year,
               MAX(year) as max_year
        FROM vehicle_fitments
        WHERE make = $1 AND year >= 2010 AND year <= 2026
        GROUP BY model
        HAVING COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) < COUNT(*)
        ORDER BY total DESC
        LIMIT 20
      `, [make]);
      
      if (gaps.rows.length > 0) {
        console.log('Models with gaps:');
        for (const row of gaps.rows) {
          const coverage = (row.has_tires / row.total * 100).toFixed(0);
          console.log(`  ${row.model}: ${row.has_tires}/${row.total} (${coverage}%) [${row.min_year}-${row.max_year}]`);
        }
      } else {
        console.log('✅ All models have data');
      }
    }

    // =========================================================================
    // POPULAR MODELS CHECK - Verify critical US models have data
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('🎯 CRITICAL US MODELS CHECK (2020-2026)\n');
    
    const criticalModels = [
      // Trucks
      { make: 'ford', model: 'f-150' },
      { make: 'chevrolet', model: 'silverado-1500' },
      { make: 'ram', model: '1500' },
      { make: 'toyota', model: 'tundra' },
      { make: 'toyota', model: 'tacoma' },
      { make: 'gmc', model: 'sierra-1500' },
      // SUVs
      { make: 'toyota', model: 'rav4' },
      { make: 'honda', model: 'cr-v' },
      { make: 'ford', model: 'explorer' },
      { make: 'jeep', model: 'wrangler' },
      { make: 'jeep', model: 'grand-cherokee' },
      { make: 'chevrolet', model: 'tahoe' },
      { make: 'toyota', model: 'highlander' },
      { make: 'honda', model: 'pilot' },
      { make: 'ford', model: 'bronco' },
      // Sedans
      { make: 'toyota', model: 'camry' },
      { make: 'honda', model: 'accord' },
      { make: 'honda', model: 'civic' },
      { make: 'toyota', model: 'corolla' },
      { make: 'hyundai', model: 'sonata' },
      { make: 'nissan', model: 'altima' },
      // Performance
      { make: 'ford', model: 'mustang' },
      { make: 'chevrolet', model: 'camaro' },
      { make: 'dodge', model: 'challenger' },
      { make: 'dodge', model: 'charger' },
      // EVs
      { make: 'tesla', model: 'model-3' },
      { make: 'tesla', model: 'model-y' },
      // Crossovers
      { make: 'hyundai', model: 'tucson' },
      { make: 'kia', model: 'sportage' },
      { make: 'kia', model: 'sorento' },
      { make: 'mazda', model: 'cx-5' },
      { make: 'subaru', model: 'outback' },
    ];
    
    const issues = [];
    for (const { make, model } of criticalModels) {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
          COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels
        FROM vehicle_fitments
        WHERE make = $1 AND model ILIKE $2 AND year >= 2020 AND year <= 2026
      `, [make, `%${model}%`]);
      
      const row = result.rows[0];
      const tiresCoverage = row.total > 0 ? (row.has_tires / row.total * 100).toFixed(0) : 0;
      const wheelsCoverage = row.total > 0 ? (row.has_wheels / row.total * 100).toFixed(0) : 0;
      
      const status = row.total === 0 ? '❌ NO DATA' : 
                    (tiresCoverage < 80 || wheelsCoverage < 80) ? '⚠️  GAPS' : '✅';
      
      if (status !== '✅') {
        issues.push({ make, model, total: row.total, tiresCoverage, wheelsCoverage });
      }
      console.log(`${status} ${make} ${model}: ${row.total} trims, ${tiresCoverage}% tires, ${wheelsCoverage}% wheels`);
    }
    
    if (issues.length > 0) {
      console.log(`\n⚠️  ${issues.length} critical models need attention`);
    } else {
      console.log('\n✅ All critical models have good coverage!');
    }

    // =========================================================================
    // SUMMARY AFTER FIX
    // =========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 UPDATED STATS AFTER FIXES\n');
    
    const finalStats = await client.query(`
      SELECT 
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
    `);
    
    const s = finalStats.rows[0];
    console.log(`Total Records: ${s.total}`);
    console.log(`With Tire Sizes: ${s.has_tires} (${(s.has_tires/s.total*100).toFixed(1)}%)`);
    console.log(`With Wheel Specs: ${s.has_wheels} (${(s.has_wheels/s.total*100).toFixed(1)}%)`);
    console.log(`COMPLETE: ${s.complete} (${(s.complete/s.total*100).toFixed(1)}%)`);

  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(console.error);
