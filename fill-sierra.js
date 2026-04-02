/**
 * GMC SIERRA TRIM FILL
 * 
 * Sierra 1500 (1999-2026) - same platform as Silverado
 * Sierra 2500HD (2001-2026)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// SIERRA 1500 (mirrors Silverado 1500)
const SIERRA_1500 = {
  // Gen 1: 1999-2006 (GMT800)
  gen1: {
    years: [1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }, // 2002+
    ],
  },
  // Gen 2: 2007-2013 (GMT900)
  gen2: {
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }] },
    ],
  },
  // Gen 3: 2014-2018 (K2XX)
  gen3: {
    years: [2014, 2015, 2016, 2017, 2018],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'All Terrain', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
    ],
  },
  // Gen 4: 2019-2026 (T1XX)
  gen4: {
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'Elevation', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'AT4', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'AT4X', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] }, // 2022+
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] },
      { display_trim: 'Denali Ultimate', oem_wheel_sizes: [{ diameter: 22, width: 9.0 }] }, // 2022+
    ],
  },
  // Pre-1999 (C/K era)
  ck: {
    years: [1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998],
    bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
    ],
  },
};

// SIERRA 2500HD
const SIERRA_2500HD = {
  gen1: {
    years: [2001, 2002, 2003, 2004, 2005, 2006],
    bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ],
  },
  gen2: {
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
    bolt_pattern: '8x180',
    trims: [
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
  gen3: {
    years: [2015, 2016, 2017, 2018, 2019],
    bolt_pattern: '8x180',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'All Terrain', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ],
  },
  gen4: {
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '8x180',
    trims: [
      { display_trim: 'Pro', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'AT4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Denali', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Denali Ultimate', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] }, // 2024+
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
        if (trim.display_trim === 'Denali' && year < 2002) continue;
        if (trim.display_trim === 'AT4X' && year < 2022) continue;
        if (trim.display_trim === 'Denali Ultimate' && year < 2022) continue;

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
  console.log('GMC SIERRA TRIM FILL');
  console.log('='.repeat(70));

  let totalAdded = 0;

  totalAdded += await fillTrucks(pool, 'gmc', 'sierra-1500', SIERRA_1500);
  totalAdded += await fillTrucks(pool, 'gmc', 'sierra-2500hd', SIERRA_2500HD);

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${totalAdded} records added`);

  await pool.end();
}

main().catch(console.error);
