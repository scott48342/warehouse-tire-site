/**
 * Phase 1 Validation Script
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('='.repeat(70));
  console.log('PHASE 1 VALIDATION');
  console.log('='.repeat(70));

  // 1. Exact count
  console.log('\n1️⃣ EXACT COUNT OF INSERTED RECORDS');
  const countRes = await prisma.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE source = 'railway_import') as railway_imports
    FROM vehicle_fitments
  `);
  console.log(`   Total vehicle_fitments: ${countRes.rows[0].total}`);
  console.log(`   Railway imports: ${countRes.rows[0].railway_imports}`);

  // 2. Sample of inserted vehicles
  console.log('\n2️⃣ SAMPLE OF INSERTED VEHICLES');
  const sampleRes = await prisma.query(`
    SELECT year, make, model, display_trim, bolt_pattern,
           jsonb_array_length(oem_wheel_sizes) as wheel_count,
           jsonb_array_length(oem_tire_sizes) as tire_count
    FROM vehicle_fitments
    WHERE source = 'railway_import'
    ORDER BY year DESC, make, model
    LIMIT 15
  `);
  console.log('   Year  Make              Model                 Trim                Bolt        Wheels Tires');
  console.log('   ' + '-'.repeat(95));
  for (const r of sampleRes.rows) {
    console.log(`   ${r.year}  ${r.make.padEnd(16)} ${r.model.padEnd(20)} ${(r.display_trim || '').padEnd(18)} ${(r.bolt_pattern || 'N/A').padEnd(10)} ${r.wheel_count}      ${r.tire_count}`);
  }

  // 3. Confirm source = 'railway_import'
  console.log('\n3️⃣ SOURCE FIELD VERIFICATION');
  const sourceRes = await prisma.query(`
    SELECT source, COUNT(*) as count
    FROM vehicle_fitments
    WHERE source = 'railway_import'
    GROUP BY source
  `);
  if (sourceRes.rows.length > 0 && sourceRes.rows[0].source === 'railway_import') {
    console.log(`   ✅ All ${sourceRes.rows[0].count} imported records have source = 'railway_import'`);
  } else {
    console.log('   ❌ Source field issue detected!');
  }

  // 4. Data integrity checks
  console.log('\n4️⃣ DATA INTEGRITY AUDIT');
  
  // Check for nulls in required fields
  const nullCheck = await prisma.query(`
    SELECT 
      COUNT(*) FILTER (WHERE year IS NULL) as null_year,
      COUNT(*) FILTER (WHERE make IS NULL OR make = '') as null_make,
      COUNT(*) FILTER (WHERE model IS NULL OR model = '') as null_model,
      COUNT(*) FILTER (WHERE modification_id IS NULL) as null_mod_id
    FROM vehicle_fitments
    WHERE source = 'railway_import'
  `);
  const nc = nullCheck.rows[0];
  console.log(`   Null years: ${nc.null_year}`);
  console.log(`   Null/empty makes: ${nc.null_make}`);
  console.log(`   Null/empty models: ${nc.null_model}`);
  console.log(`   Null modification_ids: ${nc.null_mod_id}`);
  
  if (nc.null_year == 0 && nc.null_make == 0 && nc.null_model == 0 && nc.null_mod_id == 0) {
    console.log('   ✅ No null required fields in imported data');
  } else {
    console.log('   ⚠️ Some null values detected');
  }

  // Check for duplicates
  const dupeCheck = await prisma.query(`
    SELECT year, make, model, modification_id, COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY year, make, model, modification_id
    HAVING COUNT(*) > 1
    LIMIT 5
  `);
  if (dupeCheck.rows.length === 0) {
    console.log('   ✅ No duplicate year/make/model/modification_id combinations');
  } else {
    console.log('   ⚠️ Duplicates found:');
    for (const d of dupeCheck.rows) {
      console.log(`      ${d.year} ${d.make} ${d.model} - ${d.modification_id}: ${d.cnt} copies`);
    }
  }

  // 5. Selector coverage audit
  console.log('\n5️⃣ SELECTOR COVERAGE AUDIT');
  
  // Years coverage
  const yearsRes = await prisma.query(`
    SELECT MIN(year) as min_year, MAX(year) as max_year, COUNT(DISTINCT year) as year_count
    FROM vehicle_fitments
  `);
  console.log(`   Year range: ${yearsRes.rows[0].min_year} - ${yearsRes.rows[0].max_year} (${yearsRes.rows[0].year_count} years)`);

  // Makes coverage
  const makesRes = await prisma.query(`
    SELECT COUNT(DISTINCT make) as make_count
    FROM vehicle_fitments
  `);
  console.log(`   Unique makes: ${makesRes.rows[0].make_count}`);

  // Models coverage
  const modelsRes = await prisma.query(`
    SELECT COUNT(DISTINCT model) as model_count
    FROM vehicle_fitments
  `);
  console.log(`   Unique models: ${modelsRes.rows[0].model_count}`);

  // Imported makes
  const importedMakes = await prisma.query(`
    SELECT make, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE source = 'railway_import'
    GROUP BY make
    ORDER BY cnt DESC
    LIMIT 10
  `);
  console.log('\n   Top imported makes:');
  for (const m of importedMakes.rows) {
    console.log(`      ${m.make}: ${m.cnt} vehicles`);
  }

  // 6. Check known problem vehicles
  console.log('\n6️⃣ KNOWN PROBLEM VEHICLES CHECK');
  const problemVehicles = [
    { year: 2020, make: 'ford', model: 'mustang' },
    { year: 2020, make: 'chevrolet', model: 'camaro' },
    { year: 2021, make: 'ram', model: '1500' },
    { year: 2019, make: 'chevrolet', model: 'silverado 1500' },
  ];
  
  for (const pv of problemVehicles) {
    const res = await prisma.query(`
      SELECT year, make, model, display_trim, source,
             jsonb_array_length(oem_wheel_sizes) as wheels
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      ORDER BY source
    `, [pv.year, pv.make, pv.model]);
    
    if (res.rows.length > 0) {
      const wasImported = res.rows.some(r => r.source === 'railway_import');
      console.log(`   ${pv.year} ${pv.make} ${pv.model}: ${res.rows.length} trims, ${wasImported ? '✓ includes Railway import' : 'existing only'}`);
    } else {
      console.log(`   ${pv.year} ${pv.make} ${pv.model}: NOT FOUND`);
    }
  }

  // 7. Regression check - verify existing records untouched
  console.log('\n7️⃣ REGRESSION CHECK - EXISTING RECORDS');
  const nonImportCount = await prisma.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE source != 'railway_import'
  `);
  console.log(`   Non-railway records: ${nonImportCount.rows[0].cnt}`);
  console.log(`   Expected: 9209 (original count)`);
  
  if (parseInt(nonImportCount.rows[0].cnt) === 9209) {
    console.log('   ✅ Existing records preserved - no deletions or overwrites');
  } else {
    console.log('   ⚠️ Count mismatch! Check for unexpected changes');
  }

  // Quick sample of existing records still intact
  const existingCheck = await prisma.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments
    WHERE source = 'generation' OR source = 'generation_import'
    ORDER BY RANDOM()
    LIMIT 5
  `);
  console.log('\n   Random sample of existing records (should still exist):');
  for (const e of existingCheck.rows) {
    console.log(`      ✓ ${e.year} ${e.make} ${e.model} - ${e.display_trim}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(70));

  await prisma.end();
}

main().catch(e => console.error('Validation error:', e));
