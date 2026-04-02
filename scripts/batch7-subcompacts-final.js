/**
 * Batch 7: Subcompacts & Final Gaps
 * - Toyota Yaris 2000-2020
 * - Hyundai Accent 2000-2022
 * - Kia Rio 2001-2026
 * - Honda Fit 2007-2020
 * - Chevy Spark 2013-2022
 * - Mitsubishi Mirage 2014-2026
 * - Toyota Prius 2000-2003
 * - Toyota Avalon 2000-2022
 * - Ford Mustang 2025-2026
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function genId() {
  return `batch7_${crypto.randomBytes(6).toString('hex')}`;
}

const records = [];

// =============================================================================
// TOYOTA YARIS (2000-2020) - 4x100, 54.1mm CB
// =============================================================================
for (let year = 2000; year <= 2020; year++) {
  records.push({
    year, make: 'toyota', model: 'yaris',
    display_trim: 'Base/LE/XLE',
    bolt_pattern: '4x100', center_bore_mm: 54.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2007 ? ['15x5.5', '16x6'] : ['14x5.5', '15x5.5'],
    oem_tire_sizes: year >= 2007 ? ['175/65R15', '185/60R16'] : ['175/65R14', '175/65R15'],
  });
}

// =============================================================================
// HYUNDAI ACCENT (2000-2022) - 4x100, 54.1mm CB
// =============================================================================
for (let year = 2000; year <= 2022; year++) {
  records.push({
    year, make: 'hyundai', model: 'accent',
    display_trim: 'GLS/SE/SEL',
    bolt_pattern: '4x100', center_bore_mm: 54.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2018 ? ['15x6', '17x7'] : (year >= 2012 ? ['14x5.5', '16x6'] : ['14x5.5', '15x5.5']),
    oem_tire_sizes: year >= 2018 ? ['185/65R15', '205/45R17'] : (year >= 2012 ? ['175/70R14', '195/50R16'] : ['175/70R14', '185/60R15']),
  });
}

// =============================================================================
// KIA RIO (2001-2026) - 4x100, 54.1mm CB
// =============================================================================
for (let year = 2001; year <= 2026; year++) {
  records.push({
    year, make: 'kia', model: 'rio',
    display_trim: 'LX/S/EX',
    bolt_pattern: '4x100', center_bore_mm: 54.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2018 ? ['15x6', '17x7'] : (year >= 2012 ? ['15x5.5', '16x6'] : ['14x5.5', '15x5.5']),
    oem_tire_sizes: year >= 2018 ? ['185/65R15', '205/45R17'] : (year >= 2012 ? ['185/65R15', '195/55R16'] : ['175/65R14', '185/65R15']),
  });
}

// =============================================================================
// HONDA FIT (2007-2020) - 4x100, 56.1mm CB
// =============================================================================
for (let year = 2007; year <= 2020; year++) {
  records.push({
    year, make: 'honda', model: 'fit',
    display_trim: 'LX/Sport/EX',
    bolt_pattern: '4x100', center_bore_mm: 56.1,
    offset_min: 40, offset_max: 53,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2015 ? ['15x6', '16x6'] : ['15x5.5', '16x6'],
    oem_tire_sizes: year >= 2015 ? ['185/60R15', '185/55R16'] : ['175/65R15', '185/55R16'],
  });
}

// =============================================================================
// CHEVROLET SPARK (2013-2022) - 4x100, 56.6mm CB
// =============================================================================
for (let year = 2013; year <= 2022; year++) {
  records.push({
    year, make: 'chevrolet', model: 'spark',
    display_trim: 'LS/LT/ACTIV',
    bolt_pattern: '4x100', center_bore_mm: 56.6,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x5.5'],
    oem_tire_sizes: ['185/55R15'],
  });
}

// =============================================================================
// MITSUBISHI MIRAGE (2014-2026) - 4x100, 56.1mm CB
// =============================================================================
for (let year = 2014; year <= 2026; year++) {
  records.push({
    year, make: 'mitsubishi', model: 'mirage',
    display_trim: 'ES/SE/GT',
    bolt_pattern: '4x100', center_bore_mm: 56.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['14x5', '15x5.5'],
    oem_tire_sizes: ['165/65R14', '175/55R15'],
  });
}

// =============================================================================
// TOYOTA PRIUS (2000-2003) - 5x100, 54.1mm CB
// =============================================================================
for (let year = 2000; year <= 2003; year++) {
  records.push({
    year, make: 'toyota', model: 'prius',
    display_trim: 'Base',
    bolt_pattern: '5x100', center_bore_mm: 54.1,
    offset_min: 39, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['175/65R15', '185/65R15'],
  });
}

// =============================================================================
// TOYOTA AVALON (2000-2022) - 5x114.3, 60.1mm CB
// =============================================================================
for (let year = 2000; year <= 2022; year++) {
  // XL/XLE - 16"/17" wheels
  records.push({
    year, make: 'toyota', model: 'avalon',
    display_trim: 'XL/XLE',
    bolt_pattern: '5x114.3', center_bore_mm: 60.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2013 ? ['17x7'] : (year >= 2005 ? ['16x6.5', '17x7'] : ['16x6.5']),
    oem_tire_sizes: year >= 2013 ? ['215/55R17'] : (year >= 2005 ? ['205/60R16', '215/55R17'] : ['205/65R16']),
  });
  
  // Limited/Touring (2005+) - 17"/18" wheels
  if (year >= 2005) {
    records.push({
      year, make: 'toyota', model: 'avalon',
      display_trim: year >= 2019 ? 'XSE/Limited/Touring' : 'Limited/Touring',
      bolt_pattern: '5x114.3', center_bore_mm: 60.1,
      offset_min: 35, offset_max: 50,
      thread_size: 'M12x1.5', seat_type: 'conical',
      oem_wheel_sizes: year >= 2019 ? ['18x8', '19x8'] : ['17x7', '18x7.5'],
      oem_tire_sizes: year >= 2019 ? ['235/45R18', '235/40R19'] : ['215/55R17', '225/45R18'],
    });
  }
}

// =============================================================================
// FORD MUSTANG (2025-2026) - 5x114.3, 70.5mm CB
// =============================================================================
for (let year = 2025; year <= 2026; year++) {
  // EcoBoost - 17"/18" wheels
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'EcoBoost',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 35, offset_max: 55,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7.5', '18x8'],
    oem_tire_sizes: ['215/65R17', '225/55R18'],
  });
  
  // GT - 19" staggered
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'GT',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 35, offset_max: 55,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['19x9 front', '19x9.5 rear'],
    oem_tire_sizes: ['255/40R19 front', '275/40R19 rear'],
  });
  
  // Dark Horse - 19" staggered
  records.push({
    year, make: 'ford', model: 'mustang',
    display_trim: 'Dark Horse',
    bolt_pattern: '5x114.3', center_bore_mm: 70.5,
    offset_min: 35, offset_max: 55,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['19x10.5 front', '19x11 rear'],
    oem_tire_sizes: ['275/35R19 front', '305/35R19 rear'],
  });
}

// =============================================================================
// INSERT RECORDS
// =============================================================================
async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 7: SUBCOMPACTS & FINAL GAPS');
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
      'batch7-subcompacts-final'
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
