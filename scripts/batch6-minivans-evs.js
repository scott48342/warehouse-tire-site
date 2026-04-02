/**
 * Batch 6: Minivans, EVs & Quick Wins
 * - Chrysler Pacifica 2017-2026
 * - Chrysler Town & Country 2000-2016
 * - Kia Sedona 2002-2021
 * - Kia Carnival 2022-2026
 * - Chevy Bolt EV 2017-2023
 * - Ford F-150 Lightning 2022-2026
 * - Quick wins: Murano 2008, Durango 2010, Passat 2011, Maxima 2015, Escape 2000
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function genId() {
  return `batch6_${crypto.randomBytes(6).toString('hex')}`;
}

const records = [];

// =============================================================================
// QUICK WINS - Single year gaps
// =============================================================================

// Ford Escape 2000 - 5x114.3, 67.1mm CB
records.push({
  year: 2000, make: 'ford', model: 'escape',
  display_trim: 'XLS/XLT',
  bolt_pattern: '5x114.3', center_bore_mm: 67.1,
  offset_min: 40, offset_max: 50,
  thread_size: 'M12x1.5', seat_type: 'conical',
  oem_wheel_sizes: ['15x6.5'],
  oem_tire_sizes: ['225/70R15'],
});

// Nissan Murano 2008 - 5x114.3, 66.1mm CB
records.push({
  year: 2008, make: 'nissan', model: 'murano',
  display_trim: 'S/SL/SE',
  bolt_pattern: '5x114.3', center_bore_mm: 66.1,
  offset_min: 40, offset_max: 50,
  thread_size: 'M12x1.25', seat_type: 'conical',
  oem_wheel_sizes: ['18x7.5', '20x7.5'],
  oem_tire_sizes: ['235/65R18', '235/55R20'],
});

// Dodge Durango 2010 - 5x127, 71.5mm CB
records.push({
  year: 2010, make: 'dodge', model: 'durango',
  display_trim: 'SXT/Crew/R/T',
  bolt_pattern: '5x127', center_bore_mm: 71.5,
  offset_min: 40, offset_max: 55,
  thread_size: 'M14x1.5', seat_type: 'conical',
  oem_wheel_sizes: ['18x8', '20x8'],
  oem_tire_sizes: ['265/60R18', '265/50R20'],
});

// VW Passat 2011 - 5x112, 57.1mm CB
records.push({
  year: 2011, make: 'volkswagen', model: 'passat',
  display_trim: 'S/SE/SEL',
  bolt_pattern: '5x112', center_bore_mm: 57.1,
  offset_min: 40, offset_max: 50,
  thread_size: 'M14x1.5', seat_type: 'ball',
  oem_wheel_sizes: ['16x7', '17x7', '18x8'],
  oem_tire_sizes: ['215/55R16', '235/45R17', '235/40R18'],
});

// Nissan Maxima 2015 - 5x114.3, 66.1mm CB
records.push({
  year: 2015, make: 'nissan', model: 'maxima',
  display_trim: 'S/SV/SL/Platinum',
  bolt_pattern: '5x114.3', center_bore_mm: 66.1,
  offset_min: 40, offset_max: 50,
  thread_size: 'M12x1.25', seat_type: 'conical',
  oem_wheel_sizes: ['18x8'],
  oem_tire_sizes: ['245/45R18'],
});

// =============================================================================
// CHRYSLER PACIFICA (2017-2026) - 5x127, 71.5mm CB
// =============================================================================
for (let year = 2017; year <= 2026; year++) {
  // LX/Touring - 17" wheels
  records.push({
    year, make: 'chrysler', model: 'pacifica',
    display_trim: 'LX/Touring',
    bolt_pattern: '5x127', center_bore_mm: 71.5,
    offset_min: 40, offset_max: 50,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7.5'],
    oem_tire_sizes: ['235/65R17'],
  });
  
  // Limited/Pinnacle - 18" wheels
  records.push({
    year, make: 'chrysler', model: 'pacifica',
    display_trim: 'Limited/Pinnacle',
    bolt_pattern: '5x127', center_bore_mm: 71.5,
    offset_min: 40, offset_max: 50,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x7.5', '20x7.5'],
    oem_tire_sizes: ['235/55R18', '235/50R20'],
  });
}

// =============================================================================
// CHRYSLER TOWN & COUNTRY (2000-2016) - 5x114.3, 71.5mm CB
// =============================================================================
for (let year = 2000; year <= 2016; year++) {
  // LX/Touring - 16"/17" wheels
  records.push({
    year, make: 'chrysler', model: 'town-and-country',
    display_trim: 'LX/Touring',
    bolt_pattern: '5x114.3', center_bore_mm: 71.5,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x6.5'],
    oem_tire_sizes: ['215/65R16', '225/65R17'],
  });
  
  // Limited - 17" wheels
  records.push({
    year, make: 'chrysler', model: 'town-and-country',
    display_trim: 'Limited',
    bolt_pattern: '5x114.3', center_bore_mm: 71.5,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x6.5'],
    oem_tire_sizes: ['225/65R17'],
  });
}

// =============================================================================
// KIA SEDONA (2002-2021) - 5x114.3, 67.1mm CB
// =============================================================================
for (let year = 2002; year <= 2021; year++) {
  // LX - 16"/17" wheels
  records.push({
    year, make: 'kia', model: 'sedona',
    display_trim: 'LX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2015 ? ['17x6.5'] : ['16x6.5'],
    oem_tire_sizes: year >= 2015 ? ['235/65R17'] : ['215/70R16'],
  });
  
  // EX/SX - 17"/18" wheels
  records.push({
    year, make: 'kia', model: 'sedona',
    display_trim: 'EX/SX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: year >= 2015 ? ['18x7'] : ['17x6.5'],
    oem_tire_sizes: year >= 2015 ? ['235/60R18'] : ['225/60R17'],
  });
}

// =============================================================================
// KIA CARNIVAL (2022-2026) - 5x114.3, 67.1mm CB
// =============================================================================
for (let year = 2022; year <= 2026; year++) {
  // LX/LXS - 17" wheels
  records.push({
    year, make: 'kia', model: 'carnival',
    display_trim: 'LX/LXS',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7'],
    oem_tire_sizes: ['235/65R17'],
  });
  
  // EX/SX - 19" wheels
  records.push({
    year, make: 'kia', model: 'carnival',
    display_trim: 'EX/SX/SX Prestige',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['19x7.5'],
    oem_tire_sizes: ['235/55R19'],
  });
}

// =============================================================================
// CHEVROLET BOLT EV (2017-2023) - 5x105, 56.6mm CB
// =============================================================================
for (let year = 2017; year <= 2023; year++) {
  records.push({
    year, make: 'chevrolet', model: 'bolt-ev',
    display_trim: 'LT/Premier',
    bolt_pattern: '5x105', center_bore_mm: 56.6,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7'],
    oem_tire_sizes: ['215/50R17'],
  });
}

// =============================================================================
// FORD F-150 LIGHTNING (2022-2026) - 6x135, 87.1mm CB
// =============================================================================
for (let year = 2022; year <= 2026; year++) {
  // Standard Range - 18" wheels
  records.push({
    year, make: 'ford', model: 'f-150-lightning',
    display_trim: 'Pro/XLT',
    bolt_pattern: '6x135', center_bore_mm: 87.1,
    offset_min: 34, offset_max: 44,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x8'],
    oem_tire_sizes: ['275/65R18'],
  });
  
  // Extended Range - 20"/22" wheels
  records.push({
    year, make: 'ford', model: 'f-150-lightning',
    display_trim: 'Lariat/Platinum',
    bolt_pattern: '6x135', center_bore_mm: 87.1,
    offset_min: 34, offset_max: 44,
    thread_size: 'M14x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['20x8.5', '22x9'],
    oem_tire_sizes: ['275/55R20', '275/50R22'],
  });
}

// =============================================================================
// INSERT RECORDS
// =============================================================================
async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 6: MINIVANS, EVs & QUICK WINS');
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
      'batch6-minivans-evs'
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
