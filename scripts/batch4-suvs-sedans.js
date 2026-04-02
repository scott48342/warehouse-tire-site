/**
 * Batch 4: SUVs & Korean Sedans
 * - Ford Escape 2001
 * - Nissan Frontier 2000-2004
 * - Hyundai Santa Fe 2001-2006
 * - Kia Sportage 2000-2002 (NOT MADE 2003-2004!)
 * - Kia Sorento 2003-2009
 * - Hyundai Elantra 2000-2006
 * - Hyundai Sonata 2000-2005
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function genId() {
  return `batch4_${crypto.randomBytes(6).toString('hex')}`;
}

const records = [];

// =============================================================================
// FORD ESCAPE (2001) - First year only - 5x114.3, 67.1mm CB
// =============================================================================
// XLS/XLT - 15" wheels
records.push({
  year: 2001, make: 'ford', model: 'escape',
  display_trim: 'XLS/XLT',
  bolt_pattern: '5x114.3', center_bore_mm: 67.1,
  offset_min: 40, offset_max: 50,
  thread_size: 'M12x1.5', seat_type: 'conical',
  oem_wheel_sizes: ['15x6.5'],
  oem_tire_sizes: ['225/70R15'],
});

// XLT V6 - 16" wheels
records.push({
  year: 2001, make: 'ford', model: 'escape',
  display_trim: 'XLT V6',
  bolt_pattern: '5x114.3', center_bore_mm: 67.1,
  offset_min: 40, offset_max: 50,
  thread_size: 'M12x1.5', seat_type: 'conical',
  oem_wheel_sizes: ['16x7'],
  oem_tire_sizes: ['235/70R16'],
});

// =============================================================================
// NISSAN FRONTIER (2000-2004) - D22 - 6x139.7 (4WD), 66.1mm CB
// =============================================================================
for (let year = 2000; year <= 2004; year++) {
  // XE 2WD - 15" wheels (5x114.3 for 2WD)
  records.push({
    year, make: 'nissan', model: 'frontier',
    display_trim: 'XE 2WD',
    bolt_pattern: '5x114.3', center_bore_mm: 66.1,
    offset_min: 0, offset_max: 30,
    thread_size: 'M12x1.25', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['225/70R15'],
  });
  
  // XE/SE 4WD - 15"/16" wheels (6x139.7)
  records.push({
    year, make: 'nissan', model: 'frontier',
    display_trim: 'XE/SE 4WD',
    bolt_pattern: '6x139.7', center_bore_mm: 66.1,
    offset_min: 0, offset_max: 30,
    thread_size: 'M12x1.25', seat_type: 'conical',
    oem_wheel_sizes: ['15x7', '16x7'],
    oem_tire_sizes: ['265/70R15', '265/70R16'],
  });
  
  // SC (Supercharged) - 17" wheels
  if (year >= 2001) {
    records.push({
      year, make: 'nissan', model: 'frontier',
      display_trim: 'SC',
      bolt_pattern: '6x139.7', center_bore_mm: 66.1,
      offset_min: 0, offset_max: 30,
      thread_size: 'M12x1.25', seat_type: 'conical',
      oem_wheel_sizes: ['17x8'],
      oem_tire_sizes: ['265/65R17'],
    });
  }
}

// =============================================================================
// HYUNDAI SANTA FE (2001-2006) - 1st Gen - 5x139.7, 67.1mm CB
// =============================================================================
for (let year = 2001; year <= 2006; year++) {
  // Base/GLS - all came with 16" wheels
  records.push({
    year, make: 'hyundai', model: 'santa-fe',
    display_trim: 'Base/GLS/LX',
    bolt_pattern: '5x139.7', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['225/70R16'],
  });
}

// =============================================================================
// KIA SPORTAGE (2000-2002) - 1st Gen - 5x139.7, 67.1mm CB
// NOTE: Sportage NOT PRODUCED in 2003-2004!
// =============================================================================
for (let year = 2000; year <= 2002; year++) {
  records.push({
    year, make: 'kia', model: 'sportage',
    display_trim: 'Base/LX/EX',
    bolt_pattern: '5x139.7', center_bore_mm: 67.1,
    offset_min: 0, offset_max: 30,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x7'],
    oem_tire_sizes: ['205/75R15', '235/60R16'],
  });
}

// =============================================================================
// KIA SORENTO (2003-2009) - 1st Gen - 5x139.7, 67.1mm CB
// =============================================================================
for (let year = 2003; year <= 2009; year++) {
  // LX - 16" wheels
  records.push({
    year, make: 'kia', model: 'sorento',
    display_trim: 'LX',
    bolt_pattern: '5x139.7', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x7'],
    oem_tire_sizes: ['245/70R16'],
  });
  
  // EX - 17" wheels
  records.push({
    year, make: 'kia', model: 'sorento',
    display_trim: 'EX',
    bolt_pattern: '5x139.7', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7'],
    oem_tire_sizes: ['245/65R17'],
  });
}

// =============================================================================
// HYUNDAI ELANTRA (2000-2006) - 4x114.3, 67.1mm CB
// =============================================================================
for (let year = 2000; year <= 2006; year++) {
  // GLS/GT - all came with 15" wheels
  records.push({
    year, make: 'hyundai', model: 'elantra',
    display_trim: 'GLS/GT',
    bolt_pattern: '4x114.3', center_bore_mm: 67.1,
    offset_min: 38, offset_max: 48,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['195/60R15'],
  });
}

// =============================================================================
// HYUNDAI SONATA (2000-2005) - 5x114.3, 67.1mm CB
// =============================================================================
for (let year = 2000; year <= 2005; year++) {
  // Base - 15" wheels
  records.push({
    year, make: 'hyundai', model: 'sonata',
    display_trim: 'Base',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 46,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['205/65R15'],
  });
  
  // GLS/LX - 16" wheels
  records.push({
    year, make: 'hyundai', model: 'sonata',
    display_trim: 'GLS/LX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 46,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['205/60R16'],
  });
}

// =============================================================================
// INSERT RECORDS
// =============================================================================
async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 4: SUVs & KOREAN SEDANS');
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
      'batch4-suvs-sedans'
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
