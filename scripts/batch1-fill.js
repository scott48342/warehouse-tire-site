/**
 * BATCH 1 - HIGH PRIORITY GAP FILL
 * 
 * RAM 1500 (2000-2008)
 * Toyota Highlander (2001-2009)  
 * Toyota Sienna (2000-2018)
 * Honda Odyssey (2000-2004)
 * 
 * RULES:
 * - INSERT only - never update existing records
 * - Use verified specs per generation
 * - Preserve schema consistency
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const uuidv4 = () => crypto.randomUUID();

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Generation-specific specs (researched)
const SPECS = {
  // RAM 1500 2000-2008 (3rd gen DR/DH)
  ram1500_2000_2008: {
    boltPattern: '5x139.7',
    centerBoreMm: 78.1,
    threadSize: '9/16-18',  // Imperial thread on older RAMs
    seatType: 'Lug nuts',
    offsetMin: 10,
    offsetMax: 35,
    wheelSizes: ['17x7', '17x8', '20x8'],
    tireSizes: ['245/70R17', '265/70R17', '275/60R20'],
    trims: ['ST', 'SLT', 'Laramie', 'Sport']
  },
  
  // Toyota Highlander 2001-2007 (1st gen XU20)
  highlander_2001_2007: {
    boltPattern: '5x114.3',
    centerBoreMm: 60.1,
    threadSize: 'M12 x 1.5',
    seatType: 'conical',
    offsetMin: 35,
    offsetMax: 50,
    wheelSizes: ['16x6.5', '17x6.5'],
    tireSizes: ['215/70R16', '225/65R17'],
    trims: ['Base', 'Limited']
  },
  
  // Toyota Highlander 2008-2009 (2nd gen XU40)
  highlander_2008_2009: {
    boltPattern: '5x114.3',
    centerBoreMm: 60.1,
    threadSize: 'M12 x 1.5',
    seatType: 'conical',
    offsetMin: 35,
    offsetMax: 50,
    wheelSizes: ['17x6.5', '19x7.5'],
    tireSizes: ['225/65R17', '245/55R19'],
    trims: ['Base', 'Sport', 'Limited']
  },
  
  // Toyota Sienna 1998-2003 (1st gen)
  sienna_1998_2003: {
    boltPattern: '5x114.3',
    centerBoreMm: 60.1,
    threadSize: 'M12 x 1.5',
    seatType: 'conical',
    offsetMin: 45,
    offsetMax: 55,
    wheelSizes: ['15x6', '15x6.5'],
    tireSizes: ['205/65R15', '215/65R15'],
    trims: ['CE', 'LE', 'XLE']
  },
  
  // Toyota Sienna 2004-2010 (2nd gen)
  sienna_2004_2010: {
    boltPattern: '5x114.3',
    centerBoreMm: 60.1,
    threadSize: 'M12 x 1.5',
    seatType: 'conical',
    offsetMin: 35,
    offsetMax: 50,
    wheelSizes: ['16x6.5', '17x7', '18x7'],
    tireSizes: ['215/65R16', '225/60R17', '235/55R18'],
    trims: ['CE', 'LE', 'XLE', 'Limited']
  },
  
  // Toyota Sienna 2011-2018 (3rd gen)
  sienna_2011_2018: {
    boltPattern: '5x114.3',
    centerBoreMm: 60.1,
    threadSize: 'M12 x 1.5',
    seatType: 'conical',
    offsetMin: 35,
    offsetMax: 50,
    wheelSizes: ['17x7', '18x7', '19x7'],
    tireSizes: ['235/60R17', '235/55R18', '245/50R19'],
    trims: ['L', 'LE', 'SE', 'XLE', 'Limited']
  },
  
  // Honda Odyssey 1999-2004 (2nd gen RL1) - DIFFERENT BOLT PATTERN!
  odyssey_1999_2004: {
    boltPattern: '5x114.3',  // NOT 5x120 like 2005+
    centerBoreMm: 64.1,
    threadSize: 'M12 x 1.5',
    seatType: 'ball',
    offsetMin: 45,
    offsetMax: 55,
    wheelSizes: ['15x6', '16x6.5'],
    tireSizes: ['215/65R15', '215/60R16', '225/60R16'],
    trims: ['LX', 'EX', 'EX-L']
  }
};

async function checkExisting(make, model, year) {
  const result = await pool.query(
    'SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) = $2 AND year = $3',
    [make.toLowerCase(), model.toLowerCase(), year]
  );
  return parseInt(result.rows[0].cnt) > 0;
}

async function insertRecord(year, make, model, trim, specs) {
  const modificationId = `${make}-${model}-${year}-${trim}`.toLowerCase().replace(/\s+/g, '-');
  
  await pool.query(`
    INSERT INTO vehicle_fitments (
      id, year, make, model, modification_id, raw_trim, display_trim, submodel,
      bolt_pattern, center_bore_mm, thread_size, seat_type,
      offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
      source, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
    )
  `, [
    uuidv4(),
    year,
    make.toLowerCase(),
    model.toLowerCase(),
    modificationId,
    trim,
    trim,
    null,
    specs.boltPattern,
    specs.centerBoreMm,
    specs.threadSize,
    specs.seatType,
    specs.offsetMin,
    specs.offsetMax,
    JSON.stringify(specs.wheelSizes),
    JSON.stringify(specs.tireSizes),
    'batch1-fill'
  ]);
}

async function fillVehicle(make, model, yearStart, yearEnd, specsKey, specsByYear = null) {
  let inserted = 0;
  let skipped = 0;
  
  for (let year = yearStart; year <= yearEnd; year++) {
    // Check if already exists
    const exists = await checkExisting(make, model, year);
    if (exists) {
      skipped++;
      continue;
    }
    
    // Get specs for this year (allow per-year override)
    let specs;
    if (specsByYear && specsByYear[year]) {
      specs = SPECS[specsByYear[year]];
    } else {
      specs = SPECS[specsKey];
    }
    
    // Insert each trim
    for (const trim of specs.trims) {
      await insertRecord(year, make, model, trim, specs);
      inserted++;
    }
  }
  
  return { inserted, skipped };
}

async function run() {
  console.log('🚀 BATCH 1 GAP FILL\n');
  console.log('═'.repeat(65));
  console.log('⚠️  INSERT ONLY - existing records will be SKIPPED\n');

  let totalInserted = 0;
  let totalSkipped = 0;

  // 1. RAM 1500 (2000-2008)
  console.log('\n📦 RAM 1500 (2000-2008)...');
  const ram = await fillVehicle('ram', '1500', 2000, 2008, 'ram1500_2000_2008');
  console.log(`   ✅ Inserted: ${ram.inserted} records, Skipped: ${ram.skipped} years (already exist)`);
  totalInserted += ram.inserted;
  totalSkipped += ram.skipped;

  // 2. Toyota Highlander (2001-2009) - spans two generations
  console.log('\n📦 Toyota Highlander (2001-2009)...');
  const highlander1 = await fillVehicle('toyota', 'highlander', 2001, 2007, 'highlander_2001_2007');
  const highlander2 = await fillVehicle('toyota', 'highlander', 2008, 2009, 'highlander_2008_2009');
  console.log(`   ✅ Inserted: ${highlander1.inserted + highlander2.inserted} records, Skipped: ${highlander1.skipped + highlander2.skipped} years`);
  totalInserted += highlander1.inserted + highlander2.inserted;
  totalSkipped += highlander1.skipped + highlander2.skipped;

  // 3. Toyota Sienna (2000-2018) - spans three generations
  console.log('\n📦 Toyota Sienna (2000-2018)...');
  const sienna1 = await fillVehicle('toyota', 'sienna', 2000, 2003, 'sienna_1998_2003');
  const sienna2 = await fillVehicle('toyota', 'sienna', 2004, 2010, 'sienna_2004_2010');
  const sienna3 = await fillVehicle('toyota', 'sienna', 2011, 2018, 'sienna_2011_2018');
  const siennaTotal = sienna1.inserted + sienna2.inserted + sienna3.inserted;
  const siennaSkipped = sienna1.skipped + sienna2.skipped + sienna3.skipped;
  console.log(`   ✅ Inserted: ${siennaTotal} records, Skipped: ${siennaSkipped} years`);
  totalInserted += siennaTotal;
  totalSkipped += siennaSkipped;

  // 4. Honda Odyssey (2000-2004) - 2nd gen with different bolt pattern!
  console.log('\n📦 Honda Odyssey (2000-2004)...');
  console.log('   ⚠️  Note: 2000-2004 uses 5x114.3 (different from 2005+ which is 5x120)');
  const odyssey = await fillVehicle('honda', 'odyssey', 2000, 2004, 'odyssey_1999_2004');
  console.log(`   ✅ Inserted: ${odyssey.inserted} records, Skipped: ${odyssey.skipped} years`);
  totalInserted += odyssey.inserted;
  totalSkipped += odyssey.skipped;

  console.log('\n' + '═'.repeat(65));
  console.log(`\n🎯 BATCH 1 COMPLETE`);
  console.log(`   Total inserted: ${totalInserted} records`);
  console.log(`   Years skipped (existed): ${totalSkipped}`);

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
