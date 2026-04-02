/**
 * TRUCK TRIM FILL - BATCH 1
 * 
 * 1. Chevy Silverado 1500 (1999-2026)
 * 2. Ford F-150 (1997-2026)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// SILVERADO 1500 GENERATIONS
const SILVERADO_1500 = {
  // Gen 1: 1999-2006 (GMT800)
  gen1: {
    years: [1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'LS', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }, { diameter: 17, width: 7.5 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Z71', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] }, // 2003-2006
    ],
  },
  // Gen 2: 2007-2013 (GMT900)
  gen2: {
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'LS', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'LTZ', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'Z71', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
  // Gen 3: 2014-2018 (K2XX)
  gen3: {
    years: [2014, 2015, 2016, 2017, 2018],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'LS', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'LT Z71', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'LTZ', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'High Country', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
    ],
  },
  // Gen 4: 2019-2026 (T1XX)
  gen4: {
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Custom', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'RST', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'LT Trail Boss', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'LTZ', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'High Country', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'ZR2', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] }, // 2022+
    ],
  },
};

// F-150 GENERATIONS
const F150 = {
  // Gen 10: 1997-2003
  gen10: {
    years: [1997, 1998, 1999, 2000, 2001, 2002, 2003],
    bolt_pattern: '5x135',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }, { diameter: 17, width: 7.5 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Lightning', oem_wheel_sizes: [{ diameter: 18, width: 9.5 }] }, // SVT
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }, // 2001+
    ],
  },
  // Gen 11: 2004-2008
  gen11: {
    years: [2004, 2005, 2006, 2007, 2008],
    bolt_pattern: '6x135',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'STX', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8.0 }] },
      { display_trim: 'FX4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
  // Gen 12: 2009-2014
  gen12: {
    years: [2009, 2010, 2011, 2012, 2013, 2014],
    bolt_pattern: '6x135',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'STX', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'FX2', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'FX4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] }, // 2009+
      { display_trim: 'Raptor', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }] }, // 2010+
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] }, // 2013+
    ],
  },
  // Gen 13: 2015-2020
  gen13: {
    years: [2015, 2016, 2017, 2018, 2019, 2020],
    bolt_pattern: '6x135',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8.0 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 20, width: 8.5 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'Raptor', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }] },
    ],
  },
  // Gen 14: 2021-2026
  gen14: {
    years: [2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '6x135',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'Tremor', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'Raptor', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }] },
      { display_trim: 'Raptor R', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }] }, // 2023+
      { display_trim: 'Lightning', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] }, // EV 2022+
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
        // Year-specific availability
        if (trim.display_trim === 'SS' && year < 2003) continue;
        if (trim.display_trim === 'King Ranch' && make === 'ford' && model === 'f-150' && year < 2001) continue;
        if (trim.display_trim === 'Lightning' && make === 'ford' && genName === 'gen10' && year > 2004) continue;
        if (trim.display_trim === 'Platinum' && year < 2009) continue;
        if (trim.display_trim === 'Raptor' && year < 2010) continue;
        if (trim.display_trim === 'Limited' && year < 2013) continue;
        if (trim.display_trim === 'Raptor R' && year < 2023) continue;
        if (trim.display_trim === 'Lightning' && make === 'ford' && genName === 'gen14' && year < 2022) continue;
        if (trim.display_trim === 'ZR2' && year < 2022) continue;

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

  console.log(`Total added: ${added}, skipped: ${skipped}`);
  return added;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(70));
  console.log('TRUCK TRIM FILL - BATCH 1');
  console.log('='.repeat(70));

  let totalAdded = 0;

  // 1. Silverado 1500
  totalAdded += await fillTrucks(pool, 'chevrolet', 'silverado-1500', SILVERADO_1500);

  // 2. F-150
  totalAdded += await fillTrucks(pool, 'ford', 'f-150', F150);

  console.log('\n' + '─'.repeat(60));
  console.log(`BATCH 1 TOTAL: ${totalAdded} records added`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
