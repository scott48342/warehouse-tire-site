/**
 * Batch 2 v2: Commercial Coverage Gap Fill - PROPER TRIM GROUPINGS
 * Groups trims by tire size to reduce records while maintaining accuracy
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function genId() {
  return `batch2v2_${crypto.randomBytes(6).toString('hex')}`;
}

const records = [];

// =============================================================================
// FORD FOCUS (2000-2007) - 4x108, 63.4mm CB
// =============================================================================
for (let year = 2000; year <= 2007; year++) {
  // LX - 14" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'LX',
    bolt_pattern: '4x108', center_bore_mm: 63.4,
    offset_min: 35, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['14x5.5'],
    oem_tire_sizes: ['185/65R14'],
  });
  
  // SE/ZX3/ZX5/Wagon - 15" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'SE/ZX3/ZX5',
    bolt_pattern: '4x108', center_bore_mm: 63.4,
    offset_min: 35, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['195/60R15'],
  });
  
  // ZTS/SES/ST/SVT - 16" wheels  
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'ZTS/SES/ST',
    bolt_pattern: '4x108', center_bore_mm: 63.4,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['205/50R16'],
  });
}

// =============================================================================
// FORD FOCUS (2008-2011) - 4x108, 63.4mm CB
// =============================================================================
for (let year = 2008; year <= 2011; year++) {
  // S - 15" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'S',
    bolt_pattern: '4x108', center_bore_mm: 63.4,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['195/60R15'],
  });
  
  // SE - 15" or 16" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'SE',
    bolt_pattern: '4x108', center_bore_mm: 63.4,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x6.5'],
    oem_tire_sizes: ['195/60R15', '205/50R16'],
  });
  
  // SES - 16" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'SES',
    bolt_pattern: '4x108', center_bore_mm: 63.4,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['205/50R16'],
  });
}

// =============================================================================
// FORD FOCUS (2012-2018) - 5x108, 63.4mm CB (bolt pattern changed!)
// =============================================================================
for (let year = 2012; year <= 2018; year++) {
  // S - 15" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'S',
    bolt_pattern: '5x108', center_bore_mm: 63.4,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6'],
    oem_tire_sizes: ['195/65R15'],
  });
  
  // SE - 16" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'SE',
    bolt_pattern: '5x108', center_bore_mm: 63.4,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x7'],
    oem_tire_sizes: ['215/55R16'],
  });
  
  // Titanium - 17"/18" wheels
  records.push({
    year, make: 'ford', model: 'focus',
    display_trim: 'Titanium',
    bolt_pattern: '5x108', center_bore_mm: 63.4,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7', '18x8'],
    oem_tire_sizes: ['215/50R17', '235/40R18'],
  });
  
  // ST - 18" wheels (2013+)
  if (year >= 2013) {
    records.push({
      year, make: 'ford', model: 'focus',
      display_trim: 'ST',
      bolt_pattern: '5x108', center_bore_mm: 63.4,
      offset_min: 45, offset_max: 55,
      thread_size: 'M12x1.5', seat_type: 'conical',
      oem_wheel_sizes: ['18x8'],
      oem_tire_sizes: ['235/40R18'],
    });
  }
}

// =============================================================================
// FORD FUSION (2006-2012) - 5x114.3, 67.1mm CB
// =============================================================================
for (let year = 2006; year <= 2012; year++) {
  // S - 16" wheels
  records.push({
    year, make: 'ford', model: 'fusion',
    display_trim: 'S',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['205/60R16'],
  });
  
  // SE/Hybrid - 17" wheels
  records.push({
    year, make: 'ford', model: 'fusion',
    display_trim: 'SE/Hybrid',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7.5'],
    oem_tire_sizes: ['225/50R17'],
  });
  
  // SEL/Sport - 18" wheels
  records.push({
    year, make: 'ford', model: 'fusion',
    display_trim: 'SEL/Sport',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x8'],
    oem_tire_sizes: ['225/45R18'],
  });
}

// =============================================================================
// FORD FUSION (2013-2020) - 5x108, 63.4mm CB (bolt pattern changed!)
// =============================================================================
for (let year = 2013; year <= 2020; year++) {
  // S - 16" wheels
  records.push({
    year, make: 'ford', model: 'fusion',
    display_trim: 'S',
    bolt_pattern: '5x108', center_bore_mm: 63.4,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x7'],
    oem_tire_sizes: ['215/60R16'],
  });
  
  // SE - 17" wheels
  records.push({
    year, make: 'ford', model: 'fusion',
    display_trim: 'SE',
    bolt_pattern: '5x108', center_bore_mm: 63.4,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7.5'],
    oem_tire_sizes: ['235/50R17'],
  });
  
  // Titanium/Sport - 18"/19" wheels
  records.push({
    year, make: 'ford', model: 'fusion',
    display_trim: 'Titanium/Sport',
    bolt_pattern: '5x108', center_bore_mm: 63.4,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['18x8', '19x8.5'],
    oem_tire_sizes: ['235/45R18', '235/40R19'],
  });
}

// =============================================================================
// KIA OPTIMA (2001-2006) - 5x114.3, 67.1mm CB (1st Gen)
// =============================================================================
for (let year = 2001; year <= 2006; year++) {
  // LX - 14"/15" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'LX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 35, offset_max: 45,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['14x5.5', '15x6'],
    oem_tire_sizes: ['195/70R14', '205/60R15'],
  });
  
  // EX - 15"/16" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'EX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 38, offset_max: 48,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x6.5'],
    oem_tire_sizes: ['205/60R15', '205/55R16'],
  });
}

// =============================================================================
// KIA OPTIMA (2007-2010) - 5x114.3, 67.1mm CB (2nd Gen)
// =============================================================================
for (let year = 2007; year <= 2010; year++) {
  // LX - 16" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'LX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['205/60R16'],
  });
  
  // EX/SX - 17" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'EX/SX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 40, offset_max: 50,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x6.5'],
    oem_tire_sizes: ['215/55R17'],
  });
}

// =============================================================================
// KIA OPTIMA (2011-2015) - 5x114.3, 67.1mm CB (3rd Gen)
// =============================================================================
for (let year = 2011; year <= 2015; year++) {
  // LX/Hybrid - 16"/17" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'LX/Hybrid',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 41, offset_max: 51,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7'],
    oem_tire_sizes: ['205/65R16', '215/55R17'],
  });
  
  // EX/SX - 17"/18" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'EX/SX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 41, offset_max: 51,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7', '18x7.5'],
    oem_tire_sizes: ['215/55R17', '225/45R18'],
  });
}

// =============================================================================
// KIA OPTIMA (2016-2020) - 5x114.3, 67.1mm CB (4th Gen)
// =============================================================================
for (let year = 2016; year <= 2020; year++) {
  // LX/Hybrid - 16"/17" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'LX/Hybrid',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 41, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7'],
    oem_tire_sizes: ['205/65R16', '215/55R17'],
  });
  
  // EX/SX - 17"/18" wheels
  records.push({
    year, make: 'kia', model: 'optima',
    display_trim: 'EX/SX',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 41, offset_max: 52,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7', '18x7.5'],
    oem_tire_sizes: ['215/55R17', '235/45R18'],
  });
}

// =============================================================================
// MAZDA3 (2004-2009) - 5x114.3, 67.1mm CB (1st Gen)
// =============================================================================
for (let year = 2004; year <= 2009; year++) {
  // i (base) - 15"/16" wheels
  records.push({
    year, make: 'mazda', model: 'mazda3',
    display_trim: 'i',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x6.5'],
    oem_tire_sizes: ['195/65R15', '205/55R16'],
  });
  
  // s (sport) - 16"/17" wheels
  records.push({
    year, make: 'mazda', model: 'mazda3',
    display_trim: 's',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7'],
    oem_tire_sizes: ['205/55R16', '205/50R17'],
  });
}

// =============================================================================
// MAZDA3 (2010-2013) - 5x114.3, 67.1mm CB (2nd Gen)
// =============================================================================
for (let year = 2010; year <= 2013; year++) {
  // i (all i trims) - 16" wheels
  records.push({
    year, make: 'mazda', model: 'mazda3',
    display_trim: 'i Sport/Touring/GT',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5'],
    oem_tire_sizes: ['205/55R16'],
  });
  
  // s (s Grand Touring) - 17" wheels
  records.push({
    year, make: 'mazda', model: 'mazda3',
    display_trim: 's Grand Touring',
    bolt_pattern: '5x114.3', center_bore_mm: 67.1,
    offset_min: 45, offset_max: 55,
    thread_size: 'M12x1.5', seat_type: 'conical',
    oem_wheel_sizes: ['17x7'],
    oem_tire_sizes: ['205/50R17'],
  });
}


// =============================================================================
// INSERT RECORDS
// =============================================================================
async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 2 v2: PROPER TRIM GROUPINGS');
  console.log('═'.repeat(70));
  console.log(`\nRecords to add: ${records.length}\n`);

  let added = 0;
  let skipped = 0;

  for (const rec of records) {
    // Check for existing
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
      'batch2v2-trim-groups'
    ]);
    added++;
  }

  console.log(`✅ Added: ${added}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  // Summary by vehicle
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
