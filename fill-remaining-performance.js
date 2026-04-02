/**
 * REMAINING PERFORMANCE FILLS
 * BMW M3/M5, Mercedes C/E/AMG-GT, Corvette, Bronco, WRX, BRZ, GR86, GT-R, RAM
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// BMW 5-SERIES (1981-1996 gaps)
const BMW_5_SERIES = {
  e28: { years: [1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988], bolt_pattern: '5x120',
    trims: [
      { display_trim: '528i', oem_wheel_sizes: [{ diameter: 14, width: 6.5 }] },
      { display_trim: '533i', oem_wheel_sizes: [{ diameter: 14, width: 6.5 }] },
      { display_trim: '535i', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]},
  e34: { years: [1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996], bolt_pattern: '5x120',
    trims: [
      { display_trim: '525i', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '530i', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '535i', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: '540i', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
    ]}
};

// BMW M3 (early years 1986-1991)
const BMW_M3 = {
  e30: { years: [1986, 1987, 1988, 1989, 1990, 1991], bolt_pattern: '5x120',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Evolution', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'Sport Evolution', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
    ]}
};

// BMW M5 (1989-2003 gaps)
const BMW_M5 = {
  e34: { years: [1989, 1990, 1991, 1992, 1993], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 17, width: 8 }] }]},
  e39: { years: [1998, 1999, 2000, 2001, 2002, 2003], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 18, width: 8 }, { diameter: 18, width: 9.5 }] }]}
};

// MERCEDES C-CLASS (gaps in 1994-2007, 2015-2022)
const MERCEDES_C_CLASS = {
  w202: { years: [1994, 1995, 1996, 1997, 1998, 1999, 2000], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'C220', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'C230', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'C280', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'C43 AMG', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]},
  w203: { years: [2001, 2002, 2003, 2004, 2005, 2006, 2007], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'C230', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'C240', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'C320', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'C55 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    ]},
  w205: { years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'C300', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'C43 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8 }, { diameter: 18, width: 9 }] },
      { display_trim: 'C63 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8 }, { diameter: 19, width: 9.5 }] },
      { display_trim: 'C63 S AMG', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 19, width: 10 }] },
    ]}
};

// MERCEDES E-CLASS (1985-2017 gaps)
const MERCEDES_E_CLASS = {
  w124: { years: [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995], bolt_pattern: '5x112',
    trims: [
      { display_trim: '300E', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '300CE', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '400E', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: '500E', oem_wheel_sizes: [{ diameter: 16, width: 8 }] },
    ]},
  w210: { years: [1996, 1997, 1998, 1999, 2000, 2001, 2002], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'E300', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'E320', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'E430', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'E55 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    ]},
  w211: { years: [2003, 2004, 2005, 2006, 2007, 2008, 2009], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'E320', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'E350', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'E500', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'E55 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'E63 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
    ]},
  w212: { years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'E350', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'E400', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'E550', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'E63 AMG', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
      { display_trim: 'E63 S AMG', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
    ]}
};

// MERCEDES AMG-GT (2015-2026)
const MERCEDES_AMG_GT = {
  gen1: { years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'AMG GT', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 20, width: 11 }] },
      { display_trim: 'AMG GT S', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 20, width: 11 }] },
      { display_trim: 'AMG GT C', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 20, width: 11 }] },
      { display_trim: 'AMG GT R', oem_wheel_sizes: [{ diameter: 19, width: 10 }, { diameter: 20, width: 12 }] },
      { display_trim: 'AMG GT R Pro', oem_wheel_sizes: [{ diameter: 19, width: 10 }, { diameter: 20, width: 12 }] },
      { display_trim: 'AMG GT Black Series', oem_wheel_sizes: [{ diameter: 19, width: 10 }, { diameter: 20, width: 12 }] },
    ]}
};

// CHEVROLET CORVETTE (1953-1956)
const CORVETTE = {
  c1_early: { years: [1953, 1954, 1955, 1956], bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 5 }] },
    ]}
};

// FORD BRONCO (1992-1996 + 2021-2026)
const FORD_BRONCO = {
  gen5: { years: [1992, 1993, 1994, 1995, 1996], bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'XL', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'XLT', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Eddie Bauer', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]},
  gen6: { years: [2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Big Bend', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Black Diamond', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Outer Banks', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Badlands', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Wildtrak', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }] },
      { display_trim: 'Raptor', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }] },
    ]}
};

// SUBARU WRX (2002-2026)
const SUBARU_WRX = {
  gen1: { years: [2002, 2003, 2004, 2005, 2006, 2007], bolt_pattern: '5x100',
    trims: [
      { display_trim: 'WRX', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'WRX STI', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
    ]},
  gen2: { years: [2008, 2009, 2010, 2011, 2012, 2013, 2014], bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'WRX', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'WRX Premium', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'WRX Limited', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'WRX STI', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'WRX STI Limited', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
    ]},
  gen3: { years: [2015, 2016, 2017, 2018, 2019, 2020, 2021], bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'WRX', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'WRX Premium', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'WRX Limited', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'WRX STI', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
      { display_trim: 'WRX STI Limited', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
    ]},
  gen4: { years: [2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'WRX', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'WRX Premium', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'WRX Limited', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
      { display_trim: 'WRX GT', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
    ]}
};

// SUBARU BRZ (2012-2026)
const SUBARU_BRZ = {
  gen1: { years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020], bolt_pattern: '5x100',
    trims: [
      { display_trim: 'Premium', oem_wheel_sizes: [{ diameter: 17, width: 7 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 17, width: 7 }] },
      { display_trim: 'tS', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    ]},
  gen2: { years: [2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x100',
    trims: [
      { display_trim: 'Premium', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
      { display_trim: 'tS', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    ]}
};

// TOYOTA GR86 (2022-2026)
const TOYOTA_GR86 = {
  gen1: { years: [2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x100',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Premium', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
      { display_trim: 'Special Edition', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    ]}
};

// NISSAN GT-R (2009-2026)
const NISSAN_GTR = {
  r35: { years: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Premium', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
      { display_trim: 'Black Edition', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
      { display_trim: 'Track Edition', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
      { display_trim: 'NISMO', oem_wheel_sizes: [{ diameter: 20, width: 10 }, { diameter: 20, width: 10.5 }] },
      { display_trim: 'T-Spec', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
    ]}
};

// RAM 1500/2500/3500 (older years)
const RAM_1500 = {
  ds: { years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018], bolt_pattern: '5x139.7',
    trims: [
      { display_trim: 'Tradesman', oem_wheel_sizes: [{ diameter: 17, width: 7 }] },
      { display_trim: 'Big Horn', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Rebel', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]},
  dt: { years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '6x139.7',
    trims: [
      { display_trim: 'Tradesman', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Big Horn', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
      { display_trim: 'Rebel', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 22, width: 9 }] },
      { display_trim: 'TRX', oem_wheel_sizes: [{ diameter: 18, width: 9 }] },
      { display_trim: 'Longhorn', oem_wheel_sizes: [{ diameter: 20, width: 8 }] },
    ]}
};

const RAM_2500 = {
  dj: { years: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]},
  d1: { years: [2003, 2004, 2005, 2006, 2007, 2008, 2009], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Power Wagon', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
    ]}
};

const RAM_3500 = {
  dj: { years: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]},
  d1: { years: [2003, 2004, 2005], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]}
};

const RAM_2500_NAMED = {
  dj: { years: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Power Wagon', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
    ]}
};

const RAM_3500_NAMED = {
  dj: { years: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009], bolt_pattern: '8x165.1',
    trims: [
      { display_trim: 'ST', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'SLT', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Laramie', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
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
  console.log('REMAINING PERFORMANCE FILLS');
  console.log('='.repeat(51) + '\n');

  let total = 0;
  total += await fillVehicle(pool, 'BMW', '5-Series', BMW_5_SERIES);
  total += await fillVehicle(pool, 'BMW', 'M3', BMW_M3);
  total += await fillVehicle(pool, 'BMW', 'M5', BMW_M5);
  total += await fillVehicle(pool, 'Mercedes', 'C-Class', MERCEDES_C_CLASS);
  total += await fillVehicle(pool, 'Mercedes', 'E-Class', MERCEDES_E_CLASS);
  total += await fillVehicle(pool, 'Mercedes', 'AMG-GT', MERCEDES_AMG_GT);
  total += await fillVehicle(pool, 'Chevrolet', 'Corvette', CORVETTE);
  total += await fillVehicle(pool, 'Ford', 'Bronco', FORD_BRONCO);
  total += await fillVehicle(pool, 'Subaru', 'WRX', SUBARU_WRX);
  total += await fillVehicle(pool, 'Subaru', 'BRZ', SUBARU_BRZ);
  total += await fillVehicle(pool, 'Toyota', 'GR86', TOYOTA_GR86);
  total += await fillVehicle(pool, 'Nissan', 'GT-R', NISSAN_GTR);
  total += await fillVehicle(pool, 'RAM', '1500', RAM_1500);
  total += await fillVehicle(pool, 'RAM', '2500', RAM_2500);
  total += await fillVehicle(pool, 'RAM', '3500', RAM_3500);
  total += await fillVehicle(pool, 'RAM', 'RAM-2500', RAM_2500_NAMED);
  total += await fillVehicle(pool, 'RAM', 'RAM-3500', RAM_3500_NAMED);

  console.log('─'.repeat(60));
  console.log(`TOTAL: ${total} records added`);
  
  await pool.end();
}

main().catch(console.error);
