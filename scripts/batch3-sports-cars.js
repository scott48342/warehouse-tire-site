/**
 * Batch 3: Sports Cars + Quick Wins
 * - Ford Mustang (2000-2004 SN95, 2005-2009 S197)
 * - Chevrolet Camaro (2010-2015 5th Gen) - includes staggered SS
 * - Jeep Cherokee XJ (2000-2001)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function genId() {
  return `batch3_${crypto.randomBytes(6).toString('hex')}`;
}

const records = [];

// =============================================================================
// FORD MUSTANG (2000-2004) - SN95 / New Edge - 5x114.3, 70.5mm CB
// =============================================================================
for (let year = 2000; year <= 2004; year++) {
  // Base / V6 - 15" wheels
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'Base/V6',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 24, offset_max: 45,
    thread_size: '1/2-20', seat_type: 'conical',
    oem_wheel_sizes: ['15x7'],
    oem_tire_sizes: ['205/65R15'],
  });
  
  // GT - 16"/17" wheels
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'GT',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 24, offset_max: 45,
    thread_size: '1/2-20', seat_type: 'conical',
    oem_wheel_sizes: ['16x7.5', '17x8'],
    oem_tire_sizes: ['225/55R16', '245/45R17'],
  });
  
  // Cobra (2001, 2003-2004) - 17" wheels
  if (year === 2001 || year >= 2003) {
    records.push({
      year, make: 'ford', model: 'mustang',
      display_trim: 'Cobra',
      bolt_pattern: '5x114.3', center_bore_mm: 70.5,
      offset_min: 24, offset_max: 45,
      thread_size: '1/2-20', seat_type: 'conical',
      oem_wheel_sizes: ['17x9'],
      oem_tire_sizes: ['275/40R17'],
    });
  }
}

// =============================================================================
// FORD MUSTANG (2005-2009) - S197 - 5x114.3, 70.5mm CB
// =============================================================================
for (let year = 2005; year <= 2009; year++) {
  // V6 - 16" wheels
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'V6',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 35, offset_max: 50,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x7'],
    oem_tire_sizes: ['215/65R16'],
  });
  
  // GT - 17"/18" wheels
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'GT',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 35, offset_max: 50,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x8', '18x8.5'],
    oem_tire_sizes: ['235/55R17', '235/50R18'],
  });
  
  // Shelby GT500 (2007-2009) - 18" wheels
  if (year >= 2007) {
    records.push({
      year, make: 'ford', model: 'mustang',
      display_trim: 'Shelby GT500',
      bolt_pattern: '5x114.3', center_bore_mm: 70.5,
      offset_min: 35, offset_max: 50,
      thread_size: 'M14x1.5', seat_type: 'conical',
      oem_wheel_sizes: ['18x9.5'],
      oem_tire_sizes: ['255/45R18'],
    });
  }
}

// =============================================================================
// CHEVROLET CAMARO (2010-2015) - 5th Gen - 5x120, 67.1mm CB
// =============================================================================
for (let year = 2010; year <= 2015; year++) {
  // LS - 18" wheels
  records.push({
    year, make: 'chevrolet', model: 'camaro',
    display_trim: 'LS',
    bolt_pattern: '5x120', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x7.5'],
    oem_tire_sizes: ['245/55R18'],
  });
  
  // LT - 18"/19" wheels
  records.push({
    year, make: 'chevrolet', model: 'camaro',
    display_trim: 'LT',
    bolt_pattern: '5x120', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x7.5', '19x8'],
    oem_tire_sizes: ['245/55R18', '245/50R19'],
  });
  
  // SS - 20" STAGGERED wheels (different front/rear!)
  records.push({
    year, make: 'chevrolet', model: 'camaro',
    display_trim: 'SS',
    bolt_pattern: '5x120', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['20x8 front', '20x9 rear'],
    oem_tire_sizes: ['245/45R20 front', '275/40R20 rear'],
  });
  
  // ZL1 (2012-2015) - 20" STAGGERED
  if (year >= 2012) {
    records.push({
      year, make: 'chevrolet', model: 'camaro',
      display_trim: 'ZL1',
      bolt_pattern: '5x120', center_bore_mm: 67.1,
      offset_min: 27, offset_max: 35,
      thread_size: 'M14x1.5', seat_type: 'conical',
      oem_wheel_sizes: ['20x10 front', '20x11 rear'],
      oem_tire_sizes: ['285/35R20 front', '305/35R20 rear'],
    });
  }
}

// =============================================================================
// JEEP CHEROKEE XJ (2000-2001) - 5x114.3, 71.5mm CB
// =============================================================================
for (let year = 2000; year <= 2001; year++) {
  // SE - 15" wheels
  records.push({
    year, make: 'jeep', model: 'cherokee',
    display_trim: 'SE',
    bolt_pattern: '5x114.3', center_bore_mm: 71.5,
    offset_min: 0, offset_max: 35,
    thread_size: '1/2-20', seat_type: 'conical',
    oem_wheel_sizes: ['15x7'],
    oem_tire_sizes: ['215/75R15', '225/75R15'],
  });
  
  // Sport - 15" wheels
  records.push({
    year, make: 'jeep', model: 'cherokee',
    display_trim: 'Sport',
    bolt_pattern: '5x114.3', center_bore_mm: 71.5,
    offset_min: 0, offset_max: 35,
    thread_size: '1/2-20', seat_type: 'conical',
    oem_wheel_sizes: ['15x7'],
    oem_tire_sizes: ['225/70R15', '225/75R15'],
  });
  
  // Classic/Limited - 16" wheels
  records.push({
    year, make: 'jeep', model: 'cherokee',
    display_trim: 'Classic/Limited',
    bolt_pattern: '5x114.3', center_bore_mm: 71.5,
    offset_min: 0, offset_max: 35,
    thread_size: '1/2-20', seat_type: 'conical',
    oem_wheel_sizes: ['16x7'],
    oem_tire_sizes: ['225/70R16'],
  });
}

// =============================================================================
// INSERT RECORDS
// =============================================================================
async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 3: SPORTS CARS + QUICK WINS');
  console.log('═'.repeat(70));
  console.log(`\nRecords to add: ${records.length}\n`);

  let added = 0;
  let skipped = 0;

  for (const rec of records) {
    const existing = await pool.query(`
      SELECT id FROM vehicle_fitments 
      WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4
      LIMIT 1
    `, [rec.year, rec.make, rec.model, rec.display_trim]);

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(`
      INSERT INTO vehicle_fitments (
        year, make, model, modification_id, raw_trim, display_trim,
        bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
        thread_size, seat_type, oem_wheel_sizes, oem_tire_sizes, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      rec.year, rec.make, rec.model, genId(),
      rec.display_trim, rec.display_trim,
      rec.bolt_pattern, rec.center_bore_mm,
      rec.offset_min, rec.offset_max,
      rec.thread_size, rec.seat_type,
      JSON.stringify(rec.oem_wheel_sizes),
      JSON.stringify(rec.oem_tire_sizes),
      'batch3-sports-cars'
    ]);
    added++;
  }

  console.log(`✅ Added: ${added}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  const summary = {};
  for (const rec of records) {
    const key = `${rec.make} ${rec.model}`;
    summary[key] = (summary[key] || 0) + 1;
  }
  console.log('\n📊 Records by Vehicle:');
  for (const [v, c] of Object.entries(summary)) {
    console.log(`   ${v}: ${c} records`);
  }

  const total = await pool.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  console.log(`\n📈 Total records: ${total.rows[0].count}`);

  await pool.end();
}

main().catch(console.error);
