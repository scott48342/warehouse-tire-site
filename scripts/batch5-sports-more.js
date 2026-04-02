/**
 * Batch 5: More Sports Cars
 * - Nissan 370Z 2009-2020 (STAGGERED)
 * - Mazda MX-5 Miata 2000-2015
 * - Toyota Supra 2020-2026 (STAGGERED)
 * - Camaro 2016-2024 (6th Gen, STAGGERED SS)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function genId() {
  return `batch5_${crypto.randomBytes(6).toString('hex')}`;
}

const records = [];

// =============================================================================
// NISSAN 370Z (2009-2020) - 5x114.3, 66.1mm CB - STAGGERED
// =============================================================================
for (let year = 2009; year <= 2020; year++) {
  // Base - 18" staggered
  records.push({
    year, make: 'nissan', model: '370z',
    display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1,
    offset_min: 30, offset_max: 45,
    thread_size: 'M12x1.25', seat_type: 'conical',
    oem_wheel_sizes: ['18x8 front', '18x9 rear'],
    oem_tire_sizes: ['225/50R18 front', '245/45R18 rear'],
  });
  
  // Sport/Touring - 19" staggered
  records.push({
    year, make: 'nissan', model: '370z',
    display_trim: 'Sport/Touring',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1,
    offset_min: 30, offset_max: 47,
    thread_size: 'M12x1.25', seat_type: 'conical',
    oem_wheel_sizes: ['19x9 front', '19x10 rear'],
    oem_tire_sizes: ['245/40R19 front', '275/35R19 rear'],
  });
  
  // NISMO (2009-2020)
  records.push({
    year, make: 'nissan', model: '370z',
    display_trim: 'NISMO',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1,
    offset_min: 30, offset_max: 47,
    thread_size: 'M12x1.25', seat_type: 'conical',
    oem_wheel_sizes: ['19x9.5 front', '19x10.5 rear'],
    oem_tire_sizes: ['245/40R19 front', '285/35R19 rear'],
  });
}

// =============================================================================
// MAZDA MX-5 MIATA (2000-2005) - NB - 4x100, 54.1mm CB
// =============================================================================
for (let year = 2000; year <= 2005; year++) {
  // Base/LS
  records.push({
    year, make: 'mazda', model: 'mx-5-miata',
    display_trim: 'Base/LS',
    bolt_pattern: '4x100', center_bore_mm: 54.1,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x6.5'],
    oem_tire_sizes: ['185/60R14', '195/50R15', '205/45R16'],
  });
  
  // Mazdaspeed (2004-2005)
  if (year >= 2004) {
    records.push({
      year, make: 'mazda', model: 'mx-5-miata',
      display_trim: 'Mazdaspeed',
      bolt_pattern: '4x100', center_bore_mm: 54.1,
      offset_min: 40, offset_max: 50,
      thread_size: 'M12x1.5', seat_type: 'conical',
      oem_wheel_sizes: ['17x7'],
      oem_tire_sizes: ['205/40R17'],
    });
  }
}

// =============================================================================
// MAZDA MX-5 MIATA (2006-2015) - NC - 5x114.3, 67.1mm CB
// =============================================================================
for (let year = 2006; year <= 2015; year++) {
  // Sport
  records.push({
    year, make: 'mazda', model: 'mx-5-miata',
    display_trim: 'Sport',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['195/50R16'],
  });
  
  // Touring/Grand Touring
  records.push({
    year, make: 'mazda', model: 'mx-5-miata',
    display_trim: 'Touring/Grand Touring',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7'],
    oem_tire_sizes: ['205/45R17'],
  });
}

// =============================================================================
// TOYOTA SUPRA (2020-2026) - A90 - 5x112, 66.5mm CB - STAGGERED
// =============================================================================
for (let year = 2020; year <= 2026; year++) {
  // 2.0 (2021+) - 18" non-staggered
  if (year >= 2021) {
    records.push({
      year, make: 'toyota', model: 'supra',
      display_trim: '2.0',
      bolt_pattern: '5x112', center_bore_mm: 66.5,
      offset_min: 25, offset_max: 45,
      thread_size: 'M14x1.25', seat_type: 'conical',
      oem_wheel_sizes: ['18x8'],
      oem_tire_sizes: ['255/40R18'],
    });
  }
  
  // 3.0 - 19" staggered
  records.push({
    year, make: 'toyota', model: 'supra',
    display_trim: '3.0',
    bolt_pattern: '5x112', center_bore_mm: 66.5,
    offset_min: 25, offset_max: 45,
    thread_size: 'M14x1.25', seat_type: 'conical',
    oem_wheel_sizes: ['19x9 front', '19x10 rear'],
    oem_tire_sizes: ['255/35R19 front', '275/35R19 rear'],
  });
}

// =============================================================================
// CHEVROLET CAMARO (2016-2024) - 6th Gen - 5x120, 67.1mm CB
// =============================================================================
for (let year = 2016; year <= 2024; year++) {
  // LT - 18" wheels
  records.push({
    year, make: 'chevrolet', model: 'camaro',
    display_trim: 'LT',
    bolt_pattern: '5x120', center_bore_mm: 67.1,
    offset_min: 27, offset_max: 40,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x8.5'],
    oem_tire_sizes: ['245/50R18'],
  });
  
  // SS - 20" staggered
  records.push({
    year, make: 'chevrolet', model: 'camaro',
    display_trim: 'SS',
    bolt_pattern: '5x120', center_bore_mm: 67.1,
    offset_min: 27, offset_max: 40,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['20x8.5 front', '20x9.5 rear'],
    oem_tire_sizes: ['245/40R20 front', '275/35R20 rear'],
  });
  
  // ZL1 - 20" staggered wider
  records.push({
    year, make: 'chevrolet', model: 'camaro',
    display_trim: 'ZL1',
    bolt_pattern: '5x120', center_bore_mm: 67.1,
    offset_min: 27, offset_max: 35,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['20x10 front', '20x11 rear'],
    oem_tire_sizes: ['285/30R20 front', '305/30R20 rear'],
  });
}

// =============================================================================
// INSERT RECORDS
// =============================================================================
async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 5: MORE SPORTS CARS');
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
      'batch5-sports-more'
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
