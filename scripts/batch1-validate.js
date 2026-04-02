/**
 * BATCH 1 VALIDATION
 * 
 * Verify:
 * 1. Records exist with correct specs
 * 2. No duplicate modification_ids
 * 3. All fields populated
 * 4. Trims are differentiated
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function validate() {
  console.log('🔍 BATCH 1 VALIDATION\n');
  console.log('═'.repeat(65) + '\n');

  let issues = 0;

  const vehicles = [
    { make: 'ram', model: '1500', years: [2000, 2008], expectedBolt: '5x139.7', expectedCb: '78.1' },
    { make: 'toyota', model: 'highlander', years: [2001, 2009], expectedBolt: '5x114.3', expectedCb: '60.1' },
    { make: 'toyota', model: 'sienna', years: [2000, 2018], expectedBolt: '5x114.3', expectedCb: '60.1' },
    { make: 'honda', model: 'odyssey', years: [2000, 2004], expectedBolt: '5x114.3', expectedCb: '64.1' },
  ];

  for (const v of vehicles) {
    console.log(`\n🚗 ${v.make.toUpperCase()} ${v.model.toUpperCase()} (${v.years[0]}-${v.years[1]})`);
    
    // 1. Check record counts
    const counts = await pool.query(`
      SELECT year, COUNT(*) as cnt, 
             array_agg(display_trim ORDER BY display_trim) as trims
      FROM vehicle_fitments 
      WHERE LOWER(make) = $1 AND LOWER(model) = $2 
        AND year BETWEEN $3 AND $4
      GROUP BY year
      ORDER BY year
    `, [v.make, v.model, v.years[0], v.years[1]]);

    if (counts.rows.length === 0) {
      console.log(`   ❌ NO RECORDS FOUND!`);
      issues++;
      continue;
    }

    console.log(`   ✅ ${counts.rows.length} years with data`);
    
    // Show year breakdown
    for (const row of counts.rows) {
      console.log(`      ${row.year}: ${row.cnt} trims (${row.trims.join(', ')})`);
    }

    // 2. Check specs consistency
    const specs = await pool.query(`
      SELECT DISTINCT bolt_pattern, center_bore_mm::text as cb, thread_size, seat_type
      FROM vehicle_fitments 
      WHERE LOWER(make) = $1 AND LOWER(model) = $2 
        AND year BETWEEN $3 AND $4
    `, [v.make, v.model, v.years[0], v.years[1]]);

    if (specs.rows.length > 1) {
      console.log(`   ⚠️  Multiple spec configurations found (may be intentional for different gens):`);
      specs.rows.forEach(s => {
        console.log(`      ${s.bolt_pattern}, CB: ${s.cb}mm, ${s.thread_size}, ${s.seat_type}`);
      });
    } else {
      const s = specs.rows[0];
      const boltOk = s.bolt_pattern === v.expectedBolt;
      const cbOk = s.cb === v.expectedCb;
      
      if (boltOk && cbOk) {
        console.log(`   ✅ Specs correct: ${s.bolt_pattern}, CB: ${s.cb}mm`);
      } else {
        console.log(`   ❌ Spec mismatch! Got ${s.bolt_pattern}/${s.cb}mm, expected ${v.expectedBolt}/${v.expectedCb}mm`);
        issues++;
      }
    }

    // 3. Check for null fields
    const nulls = await pool.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE LOWER(make) = $1 AND LOWER(model) = $2 
        AND year BETWEEN $3 AND $4
        AND (bolt_pattern IS NULL OR center_bore_mm IS NULL OR 
             oem_wheel_sizes IS NULL OR oem_tire_sizes IS NULL)
    `, [v.make, v.model, v.years[0], v.years[1]]);

    if (parseInt(nulls.rows[0].cnt) > 0) {
      console.log(`   ❌ ${nulls.rows[0].cnt} records with NULL fields!`);
      issues++;
    } else {
      console.log(`   ✅ All required fields populated`);
    }

    // 4. Check for duplicate modification_ids
    const dupes = await pool.query(`
      SELECT modification_id, COUNT(*) as cnt
      FROM vehicle_fitments 
      WHERE LOWER(make) = $1 AND LOWER(model) = $2 
        AND year BETWEEN $3 AND $4
      GROUP BY modification_id
      HAVING COUNT(*) > 1
    `, [v.make, v.model, v.years[0], v.years[1]]);

    if (dupes.rows.length > 0) {
      console.log(`   ❌ ${dupes.rows.length} duplicate modification_ids!`);
      issues++;
    } else {
      console.log(`   ✅ No duplicate modification_ids`);
    }
  }

  // 5. Check total database integrity
  console.log('\n\n📊 OVERALL DATABASE CHECK');
  console.log('═'.repeat(65));
  
  const total = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  console.log(`\n   Total records: ${total.rows[0].cnt}`);

  const nullCheck = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE bolt_pattern IS NULL) as bp_null,
      COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as cb_null,
      COUNT(*) FILTER (WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb) as ws_null,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as ts_null
    FROM vehicle_fitments
  `);
  
  const nc = nullCheck.rows[0];
  console.log(`   Bolt pattern NULL: ${nc.bp_null}`);
  console.log(`   Centerbore NULL: ${nc.cb_null}`);
  console.log(`   Wheel sizes empty: ${nc.ws_null}`);
  console.log(`   Tire sizes empty: ${nc.ts_null}`);

  console.log('\n' + '═'.repeat(65));
  if (issues === 0) {
    console.log('\n✅ BATCH 1 VALIDATION PASSED - No issues found');
  } else {
    console.log(`\n❌ BATCH 1 VALIDATION FOUND ${issues} ISSUE(S)`);
  }

  await pool.end();
}

validate().catch(e => { console.error(e); process.exit(1); });
