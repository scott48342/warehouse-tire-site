/**
 * LUXURY/PERFORMANCE VEHICLE TRIM FILL
 * 
 * BMW: 3-Series, 5-Series, M3, M5
 * Mercedes: S-Class, E-Class, C-Class
 * Audi: A4, A6, S4
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// BMW 3-SERIES
const BMW_3_SERIES = {
  e30: { years: [1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991], bolt_pattern: '4x100',
    trims: [
      { display_trim: '318i', oem_wheel_sizes: [{ diameter: 14, width: 6.0 }] },
      { display_trim: '325i', oem_wheel_sizes: [{ diameter: 14, width: 6.5 }] },
      { display_trim: '325is', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    ]},
  e36: { years: [1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999], bolt_pattern: '5x120',
    trims: [
      { display_trim: '318i', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: '325i', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: '328i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
    ]},
  e46: { years: [1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006], bolt_pattern: '5x120',
    trims: [
      { display_trim: '323i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '325i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '328i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '330i', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]},
  e90: { years: [2006, 2007, 2008, 2009, 2010, 2011, 2012], bolt_pattern: '5x120',
    trims: [
      { display_trim: '328i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }, { diameter: 17, width: 8.0 }] },
      { display_trim: '335i', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }, { diameter: 18, width: 8.0 }] },
    ]},
  f30: { years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019], bolt_pattern: '5x120',
    trims: [
      { display_trim: '320i', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '328i', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8.0 }] },
      { display_trim: '330i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '340i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 19, width: 8.5 }] },
    ]},
  g20: { years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: '330i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '330i xDrive', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'M340i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 19, width: 8.5 }] },
    ]},
};

// BMW 5-SERIES
const BMW_5_SERIES = {
  e34: { years: [1989, 1990, 1991, 1992, 1993, 1994, 1995], bolt_pattern: '5x120',
    trims: [
      { display_trim: '525i', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: '535i', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: '540i', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
    ]},
  e39: { years: [1997, 1998, 1999, 2000, 2001, 2002, 2003], bolt_pattern: '5x120',
    trims: [
      { display_trim: '525i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '528i', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '530i', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: '540i', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
    ]},
  e60: { years: [2004, 2005, 2006, 2007, 2008, 2009, 2010], bolt_pattern: '5x120',
    trims: [
      { display_trim: '525i', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '530i', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '535i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '550i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 19, width: 9.0 }] },
    ]},
  f10: { years: [2011, 2012, 2013, 2014, 2015, 2016], bolt_pattern: '5x120',
    trims: [
      { display_trim: '528i', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: '535i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '550i', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 19, width: 9.5, rear: true }] },
    ]},
  g30: { years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: '530i', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '540i', oem_wheel_sizes: [{ diameter: 19, width: 8.0 }] },
      { display_trim: 'M550i', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 19, width: 9.5, rear: true }] },
    ]},
};

// BMW M3
const BMW_M3 = {
  e30: { years: [1988, 1989, 1990, 1991], bolt_pattern: '4x100',
    trims: [{ display_trim: 'M3', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }]},
  e36: { years: [1995, 1996, 1997, 1998, 1999], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M3', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }]},
  e46: { years: [2001, 2002, 2003, 2004, 2005, 2006], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M3', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 18, width: 9.0, rear: true }] }]},
  e90: { years: [2008, 2009, 2010, 2011, 2012, 2013], bolt_pattern: '5x120',
    trims: [
      { display_trim: 'M3', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 18, width: 9.5, rear: true }] },
      { display_trim: 'M3 Competition', oem_wheel_sizes: [{ diameter: 19, width: 9.0 }, { diameter: 19, width: 10.0, rear: true }] },
    ]},
  f80: { years: [2015, 2016, 2017, 2018], bolt_pattern: '5x120',
    trims: [
      { display_trim: 'M3', oem_wheel_sizes: [{ diameter: 18, width: 9.0 }, { diameter: 18, width: 10.0, rear: true }] },
      { display_trim: 'M3 Competition', oem_wheel_sizes: [{ diameter: 19, width: 9.0 }, { diameter: 19, width: 10.0, rear: true }] },
    ]},
  g80: { years: [2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'M3', oem_wheel_sizes: [{ diameter: 18, width: 9.0 }, { diameter: 18, width: 10.0, rear: true }] },
      { display_trim: 'M3 Competition', oem_wheel_sizes: [{ diameter: 19, width: 9.5 }, { diameter: 19, width: 10.5, rear: true }] },
      { display_trim: 'M3 CS', oem_wheel_sizes: [{ diameter: 19, width: 9.5 }, { diameter: 20, width: 10.5, rear: true }] },
    ]},
};

// BMW M5
const BMW_M5 = {
  e28: { years: [1985, 1986, 1987, 1988], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] }]},
  e34: { years: [1991, 1992, 1993], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] }]},
  e39: { years: [1999, 2000, 2001, 2002, 2003], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 18, width: 9.5, rear: true }] }]},
  e60: { years: [2006, 2007, 2008, 2009, 2010], bolt_pattern: '5x120',
    trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 19, width: 9.5, rear: true }] }]},
  f10: { years: [2013, 2014, 2015, 2016], bolt_pattern: '5x120',
    trims: [
      { display_trim: 'M5', oem_wheel_sizes: [{ diameter: 19, width: 9.0 }, { diameter: 19, width: 10.0, rear: true }] },
      { display_trim: 'M5 Competition', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5, rear: true }] },
    ]},
  f90: { years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'M5', oem_wheel_sizes: [{ diameter: 19, width: 9.5 }, { diameter: 19, width: 10.5, rear: true }] },
      { display_trim: 'M5 Competition', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5, rear: true }] },
      { display_trim: 'M5 CS', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5, rear: true }] },
    ]},
};

// MERCEDES S-CLASS
const MERCEDES_S_CLASS = {
  w126: { years: [1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991], bolt_pattern: '5x112',
    trims: [
      { display_trim: '300SE', oem_wheel_sizes: [{ diameter: 15, width: 6.5 }] },
      { display_trim: '420SEL', oem_wheel_sizes: [{ diameter: 15, width: 6.5 }] },
      { display_trim: '560SEL', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    ]},
  w140: { years: [1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S320', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'S420', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'S500', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'S600', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ]},
  w220: { years: [2000, 2001, 2002, 2003, 2004, 2005, 2006], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S430', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'S500', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'S55 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 18, width: 9.5, rear: true }] },
      { display_trim: 'S600', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }] },
    ]},
  w221: { years: [2007, 2008, 2009, 2010, 2011, 2012, 2013], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S450', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'S550', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 19, width: 9.0 }] },
      { display_trim: 'S63 AMG', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 19, width: 9.5, rear: true }] },
      { display_trim: 'S600', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
    ]},
  w222: { years: [2014, 2015, 2016, 2017, 2018, 2019, 2020], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S450', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'S560', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 20, width: 9.0 }] },
      { display_trim: 'S63 AMG', oem_wheel_sizes: [{ diameter: 20, width: 8.5 }, { diameter: 20, width: 9.5, rear: true }] },
      { display_trim: 'S65 AMG', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }, { diameter: 20, width: 10.0, rear: true }] },
    ]},
  w223: { years: [2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S500', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
      { display_trim: 'S580', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }, { diameter: 21, width: 9.5 }] },
      { display_trim: 'S63 AMG E Performance', oem_wheel_sizes: [{ diameter: 21, width: 9.5 }, { diameter: 21, width: 10.5, rear: true }] },
      { display_trim: 'Maybach S580', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
    ]},
};

// AUDI A4
const AUDI_A4 = {
  b5: { years: [1996, 1997, 1998, 1999, 2000, 2001], bolt_pattern: '5x112',
    trims: [
      { display_trim: '1.8T', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: '2.8', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
    ]},
  b6: { years: [2002, 2003, 2004, 2005], bolt_pattern: '5x112',
    trims: [
      { display_trim: '1.8T', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '3.0', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]},
  b7: { years: [2006, 2007, 2008], bolt_pattern: '5x112',
    trims: [
      { display_trim: '2.0T', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '3.2', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
    ]},
  b8: { years: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016], bolt_pattern: '5x112',
    trims: [
      { display_trim: '2.0T', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '2.0T Premium Plus', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '2.0T Prestige', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
    ]},
  b9: { years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: '40 TFSI', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '45 TFSI', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '45 TFSI quattro', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 19, width: 8.5 }] },
    ]},
};

// AUDI A6
const AUDI_A6 = {
  c5: { years: [1998, 1999, 2000, 2001, 2002, 2003, 2004], bolt_pattern: '5x112',
    trims: [
      { display_trim: '2.7T', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: '3.0', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '4.2', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
    ]},
  c6: { years: [2005, 2006, 2007, 2008, 2009, 2010, 2011], bolt_pattern: '5x112',
    trims: [
      { display_trim: '3.2', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: '4.2', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
    ]},
  c7: { years: [2012, 2013, 2014, 2015, 2016, 2017, 2018], bolt_pattern: '5x112',
    trims: [
      { display_trim: '2.0T', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '3.0T', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 19, width: 8.5 }] },
      { display_trim: '3.0T Prestige', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
    ]},
  c8: { years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: '45 TFSI', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '55 TFSI', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
      { display_trim: '55 TFSI Prestige', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
    ]},
};

// AUDI S4
const AUDI_S4 = {
  b5: { years: [2000, 2001, 2002], bolt_pattern: '5x112',
    trims: [{ display_trim: 'S4', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }]},
  b6: { years: [2004, 2005], bolt_pattern: '5x112',
    trims: [{ display_trim: 'S4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] }]},
  b7: { years: [2006, 2007, 2008], bolt_pattern: '5x112',
    trims: [{ display_trim: 'S4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] }]},
  b8: { years: [2010, 2011, 2012, 2013, 2014, 2015, 2016], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'S4 Premium Plus', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
    ]},
  b9: { years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], bolt_pattern: '5x112',
    trims: [
      { display_trim: 'S4', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'S4 Premium Plus', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
      { display_trim: 'S4 Prestige', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
    ]},
};

async function fillVehicle(pool, make, model, generations) {
  const existing = await pool.query(`SELECT year, display_trim FROM vehicle_fitments WHERE make = $1 AND model = $2`, [make, model]);
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  
  console.log(`\n${make.toUpperCase()} ${model.toUpperCase()} (existing: ${existing.rows.length})`);

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
  console.log(`  +${added}`);
  return added;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('='.repeat(70));
  console.log('LUXURY/PERFORMANCE VEHICLE TRIM FILL');
  console.log('='.repeat(70));

  let total = 0;
  total += await fillVehicle(pool, 'bmw', '3-series', BMW_3_SERIES);
  total += await fillVehicle(pool, 'bmw', '5-series', BMW_5_SERIES);
  total += await fillVehicle(pool, 'bmw', 'm3', BMW_M3);
  total += await fillVehicle(pool, 'bmw', 'm5', BMW_M5);
  total += await fillVehicle(pool, 'mercedes', 's-class', MERCEDES_S_CLASS);
  total += await fillVehicle(pool, 'audi', 'a4', AUDI_A4);
  total += await fillVehicle(pool, 'audi', 'a6', AUDI_A6);
  total += await fillVehicle(pool, 'audi', 's4', AUDI_S4);

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${total} records added`);

  await pool.end();
}

main().catch(console.error);
