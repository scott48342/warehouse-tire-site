/**
 * TRUCK TRIM FILL - BATCH 2
 * 
 * 1. Chevy Silverado 2500HD
 * 2. Ford F-250 / F-350 (non-Super Duty)
 * 3. Ford F-250 Super Duty / F-350 Super Duty
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// SILVERADO 2500HD
const SILVERADO_2500HD = {
  gen1: {
    years: [2001, 2002, 2003, 2004, 2005, 2006],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'LS', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ],
  },
  gen2: {
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
    bolt_pattern: '8x180',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'LTZ', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Z71', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
  gen3: {
    years: [2015, 2016, 2017, 2018, 2019],
    bolt_pattern: '8x180',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'LTZ', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'High Country', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Z71', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
  gen4: {
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '8x180',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Custom', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'LTZ', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'High Country', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'ZR2', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] }, // 2024+
    ],
  },
};

// F-250 (standalone, pre-1999 or specific years)
const F250 = {
  gen1: {
    years: [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010],
    bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] }, // 2001+
    ],
  },
};

// F-350 (standalone)
const F350 = {
  gen1: {
    years: [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010],
    bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
};

// F-250 Super Duty (gaps before 1999)
const F250_SD = {
  gen0: {
    years: [1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
    ],
  },
};

// F-350 Super Duty (gaps before 1999)
const F350_SD = {
  gen0: {
    years: [1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
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
        if (trim.display_trim === 'King Ranch' && year < 2001) continue;
        if (trim.display_trim === 'ZR2' && year < 2024) continue;

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
  console.log('TRUCK TRIM FILL - BATCH 2');
  console.log('='.repeat(70));

  let totalAdded = 0;

  totalAdded += await fillTrucks(pool, 'chevrolet', 'silverado-2500hd', SILVERADO_2500HD);
  totalAdded += await fillTrucks(pool, 'ford', 'f-250', F250);
  totalAdded += await fillTrucks(pool, 'ford', 'f-350', F350);
  totalAdded += await fillTrucks(pool, 'ford', 'f-250-super-duty', F250_SD);
  totalAdded += await fillTrucks(pool, 'ford', 'f-350-super-duty', F350_SD);

  console.log('\n' + '─'.repeat(60));
  console.log(`BATCH 2 TOTAL: ${totalAdded} records added`);

  await pool.end();
}

main().catch(console.error);
