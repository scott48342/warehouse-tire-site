/**
 * TRUCK TRIM FILL - BATCH 3
 * 
 * 1. RAM 2500 (ram/ram-2500)
 * 2. RAM 3500 (ram/ram-3500)
 * 3. RAM 1500 (ram/1500)
 * 4. Dodge RAM 1500 (dodge/ram-1500)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// RAM 2500/3500 HD (post-2010 RAM brand)
const RAM_HD = {
  gen4: {
    years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'Tradesman', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }, { diameter: 18, width: 8.0 }] },
      { display_trim: 'Big Horn', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Laramie Longhorn', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Power Wagon', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] }, // 2500 only
    ],
  },
  gen5: {
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'Tradesman', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Big Horn', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Laramie Longhorn', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Limited Longhorn', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Power Wagon', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
    ],
  },
};

// Older RAM 2500/3500 under Dodge (1994-2009)
const DODGE_RAM_HD = {
  gen2: {
    years: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ],
  },
  gen3: {
    years: [2003, 2004, 2005, 2006, 2007, 2008, 2009],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Power Wagon', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] }, // 2005+ 2500
    ],
  },
};

// RAM 1500 (ram brand, 2009+)
const RAM_1500 = {
  ds: {
    years: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018],
    bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'Tradesman', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
      { display_trim: 'Express', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Big Horn', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'Laramie Longhorn', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'Rebel', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] }, // 2015+
    ],
  },
  dt: {
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Tradesman', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Big Horn', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'Rebel', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'Limited Longhorn', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'TRX', oem_wheel_sizes: [{ diameter: 18, width: 9.0 }] }, // 2021+
    ],
  },
};

// Dodge RAM 1500 (pre-2010)
const DODGE_RAM_1500 = {
  gen2: {
    years: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001],
    bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
    ],
  },
  gen3: {
    years: [2002, 2003, 2004, 2005, 2006, 2007, 2008],
    bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'SRT-10', oem_wheel_sizes: [{ diameter: 22, width: 10.0 }] }, // 2004-2006
    ],
  },
};

async function fillTrucks(pool, make, model, generations) {
  const existing = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = $1 AND model = $2
  `, [make, model]);
  
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${make.toUpperCase()} ${model.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Existing: ${existing.rows.length}`);

  let added = 0, skipped = 0;

  for (const [genName, gen] of Object.entries(generations)) {
    let genAdded = 0;
    
    for (const year of gen.years) {
      for (const trim of gen.trims) {
        // Year-specific
        if (trim.display_trim === 'Power Wagon' && year < 2005) continue;
        if (trim.display_trim === 'Rebel' && year < 2015) continue;
        if (trim.display_trim === 'TRX' && year < 2021) continue;
        if (trim.display_trim === 'SRT-10' && (year < 2004 || year > 2006)) continue;

        const key = `${year}|${trim.display_trim}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        const modId = genModId(make, model, trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (
            modification_id, year, make, model, display_trim, raw_trim,
            bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generation_inherit', NOW(), NOW())
        `, [modId, year, make, model, trim.display_trim, trim.display_trim, gen.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);

        genAdded++;
        added++;
      }
    }
    console.log(`  ${genName}: +${genAdded}`);
  }

  console.log(`Total: +${added}, skipped: ${skipped}`);
  return added;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(70));
  console.log('TRUCK TRIM FILL - BATCH 3 (RAM)');
  console.log('='.repeat(70));

  let totalAdded = 0;

  // RAM brand (2010+)
  totalAdded += await fillTrucks(pool, 'ram', 'ram-2500', RAM_HD);
  totalAdded += await fillTrucks(pool, 'ram', 'ram-3500', RAM_HD);
  totalAdded += await fillTrucks(pool, 'ram', '1500', RAM_1500);

  // Dodge RAM (pre-2010)
  totalAdded += await fillTrucks(pool, 'dodge', 'ram-1500', DODGE_RAM_1500);
  totalAdded += await fillTrucks(pool, 'dodge', 'ram-2500', DODGE_RAM_HD);
  totalAdded += await fillTrucks(pool, 'dodge', 'ram-3500', DODGE_RAM_HD);

  console.log('\n' + '─'.repeat(60));
  console.log(`BATCH 3 TOTAL: ${totalAdded} records added`);

  await pool.end();
}

main().catch(console.error);
