/**
 * REMAINING TRUCK FILLS
 * Silverado, Sierra, F-150, F-250, F-350, RAM, Titan
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// CHEVROLET SILVERADO-1500 (1988-1998)
const SILVERADO_1500 = {
  gmt400: { years: [1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998], bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Cheyenne', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Scottsdale', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Silverado', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Z71', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
    ]}
};

// CHEVROLET SILVERADO-2500HD (1988-2000)
const SILVERADO_2500HD = {
  gmt400: { years: [1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'WT', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Cheyenne', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Silverado', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Z71', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]}
};

// GMC SIERRA-2500HD (1988-1998)
const SIERRA_2500HD = {
  gmt400: { years: [1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'SLE', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]}
};

// FORD F-150 (1992-1996)
const FORD_F150 = {
  gen9: { years: [1992, 1993, 1994, 1995, 1996], bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Eddie Bauer', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Lightning', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
    ]}
};

// FORD F-250 (2011-2026)
const FORD_F250 = {
  gen13: { years: [2011, 2012, 2013, 2014, 2015, 2016], bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]},
  gen14: { years: [2017, 2018, 2019, 2020, 2021, 2022], bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Tremor', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    ]},
  gen15: { years: [2023, 2024, 2025, 2026], bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Tremor', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    ]}
};

// FORD F-350 (2011-2026)
const FORD_F350 = {
  gen13: { years: [2011, 2012, 2013, 2014, 2015, 2016], bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]},
  gen14: { years: [2017, 2018, 2019, 2020, 2021, 2022], bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]},
  gen15: { years: [2023, 2024, 2025, 2026], bolt_pattern: '8x170',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Lariat', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'King Ranch', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]}
};

// DODGE RAM-1500 (2009-2010)
const DODGE_RAM1500 = {
  ds: { years: [2009, 2010], bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 7 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7 }] },
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]}
};

// NISSAN TITAN (2004-2026)
const NISSAN_TITAN = {
  gen1: { years: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015], bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'S', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SV', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Pro-4X', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'LE', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]},
  gen2: { years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'S', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SV', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Pro-4X', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'SL', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Platinum Reserve', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'XD', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    ]}
};

async function fillVehicle(pool, make, model, generations) {
  const existing = await pool.query(`SELECT year, display_trim FROM vehicle_fitments WHERE make = $1 AND model = $2`, [make, model]);
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  
  console.log(`${make.toUpperCase()} ${model.toUpperCase()} (existing: ${existing.rows.length})`);

  let added = 0;
  for (const [genName, gen] of Object.entries(generations)) {
    for (const year of gen.years) {
      for (const trim of gen.trims) {
        const key = `${year}|${trim.display_trim}`;
        if (existingSet.has(key)) continue;

        const modId = genModId(make, model, trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generation_inherit', NOW(), NOW())
        `, [modId, year, make, model, trim.display_trim, trim.display_trim, gen.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
        added++;
      }
    }
  }
  console.log(`  +${added}\n`);
  return added;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('='.repeat(51));
  console.log('REMAINING TRUCK FILLS');
  console.log('='.repeat(51) + '\n');

  let total = 0;
  total += await fillVehicle(pool, 'Chevrolet', 'Silverado-1500', SILVERADO_1500);
  total += await fillVehicle(pool, 'Chevrolet', 'Silverado-2500HD', SILVERADO_2500HD);
  total += await fillVehicle(pool, 'GMC', 'Sierra-2500HD', SIERRA_2500HD);
  total += await fillVehicle(pool, 'Ford', 'F-150', FORD_F150);
  total += await fillVehicle(pool, 'Ford', 'F-250', FORD_F250);
  total += await fillVehicle(pool, 'Ford', 'F-350', FORD_F350);
  total += await fillVehicle(pool, 'Dodge', 'RAM-1500', DODGE_RAM1500);
  total += await fillVehicle(pool, 'Nissan', 'Titan', NISSAN_TITAN);

  console.log('─'.repeat(60));
  console.log(`TOTAL: ${total} records added`);
  
  await pool.end();
}

main().catch(console.error);
