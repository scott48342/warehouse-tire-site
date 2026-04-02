/**
 * CORVETTE ALL GENERATIONS (1953-2026)
 * 
 * C1: 1953-1962 (First gen, solid axle)
 * C2: 1963-1967 (Sting Ray, IRS)
 * C3: 1968-1982 (Stingray/Corvette)
 * C4: 1984-1996 (Modern era begins)
 * C5: 1997-2004 (LS1 era)
 * C6: 2005-2013 (LS3/LS7/LS9)
 * C7: 2014-2019 (LT1/LT4/LT5)
 * C8: 2020-2026 (Mid-engine revolution)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// C1: 1953-1962 (5x4.75 = 5x120.65)
const C1 = {
  years: [1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1962],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 5.5 }] },
    { display_trim: 'Fuel Injection', oem_wheel_sizes: [{ diameter: 15, width: 5.5 }] }, // 1957+
  ],
};

// C2: 1963-1967 Sting Ray
const C2 = {
  years: [1963, 1964, 1965, 1966, 1967],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 6.0 }] },
    { display_trim: 'Z06', oem_wheel_sizes: [{ diameter: 15, width: 6.0 }] }, // Race package
    { display_trim: '427', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }, // Big block
  ],
};

// C3: 1968-1982
const C3 = {
  years: [1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'LT-1', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] }, // 1970-1972
    { display_trim: 'ZR-1', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] }, // Race package 1970-1972
    { display_trim: 'L82', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }, // 1973-1980
    { display_trim: 'Collector Edition', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] }, // 1982
  ],
};

// C4: 1984-1996 (no 1983 - retooling year)
const C4 = {
  years: [1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 8.5 }] },
    { display_trim: 'Z51', oem_wheel_sizes: [{ diameter: 16, width: 9.5 }] }, // Performance handling
    { display_trim: 'Z52', oem_wheel_sizes: [{ diameter: 16, width: 9.5 }] }, // Sport handling
    { display_trim: 'ZR-1', oem_wheel_sizes: [{ diameter: 17, width: 9.5 }, { diameter: 17, width: 11.0, rear: true }] }, // 1990-1995
    { display_trim: 'Grand Sport', oem_wheel_sizes: [{ diameter: 17, width: 9.5 }, { diameter: 17, width: 11.0, rear: true }] }, // 1996
  ],
};

// C5: 1997-2004
const C5 = {
  years: [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }, { diameter: 18, width: 9.5, rear: true }] },
    { display_trim: 'Z51', oem_wheel_sizes: [{ diameter: 17, width: 8.5 }, { diameter: 18, width: 9.5, rear: true }] },
    { display_trim: 'Z06', oem_wheel_sizes: [{ diameter: 17, width: 9.5 }, { diameter: 18, width: 10.5, rear: true }] }, // 2001-2004
  ],
};

// C6: 2005-2013
const C6 = {
  years: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 19, width: 10.0, rear: true }] },
    { display_trim: 'Z51', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 19, width: 10.0, rear: true }] },
    { display_trim: 'Z06', oem_wheel_sizes: [{ diameter: 18, width: 9.5 }, { diameter: 19, width: 12.0, rear: true }] },
    { display_trim: 'Grand Sport', oem_wheel_sizes: [{ diameter: 18, width: 9.5 }, { diameter: 19, width: 12.0, rear: true }] }, // 2010+
    { display_trim: 'ZR1', oem_wheel_sizes: [{ diameter: 19, width: 10.0 }, { diameter: 20, width: 12.0, rear: true }] }, // 2009-2013
  ],
};

// C7: 2014-2019
const C7 = {
  years: [2014, 2015, 2016, 2017, 2018, 2019],
  bolt_pattern: '5x120.65',
  trims: [
    { display_trim: 'Stingray', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 19, width: 10.0, rear: true }] },
    { display_trim: 'Stingray Z51', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 20, width: 10.0, rear: true }] },
    { display_trim: 'Grand Sport', oem_wheel_sizes: [{ diameter: 19, width: 10.0 }, { diameter: 20, width: 12.0, rear: true }] },
    { display_trim: 'Z06', oem_wheel_sizes: [{ diameter: 19, width: 10.0 }, { diameter: 20, width: 12.0, rear: true }] },
    { display_trim: 'ZR1', oem_wheel_sizes: [{ diameter: 19, width: 10.0 }, { diameter: 20, width: 12.0, rear: true }] }, // 2019
  ],
};

// C8: 2020-2026
const C8 = {
  years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
  bolt_pattern: '5x120',
  trims: [
    { display_trim: 'Stingray', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 20, width: 11.0, rear: true }] },
    { display_trim: 'Stingray Z51', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 20, width: 11.0, rear: true }] },
    { display_trim: 'Z06', oem_wheel_sizes: [{ diameter: 20, width: 10.0 }, { diameter: 21, width: 13.0, rear: true }] }, // 2023+
    { display_trim: 'E-Ray', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 21, width: 12.0, rear: true }] }, // 2024+ hybrid
    { display_trim: 'ZR1', oem_wheel_sizes: [{ diameter: 20, width: 10.0 }, { diameter: 21, width: 13.0, rear: true }] }, // 2025+
  ],
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(70));
  console.log('CORVETTE ALL GENERATIONS (1953-2026)');
  console.log('='.repeat(70));

  // Get existing
  const existing = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'corvette'
  `);
  
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  console.log(`Existing Corvette records: ${existing.rows.length}\n`);

  let added = 0, skipped = 0;

  const generations = [
    { name: 'C1 (1953-1962)', data: C1 },
    { name: 'C2 (1963-1967) Sting Ray', data: C2 },
    { name: 'C3 (1968-1982)', data: C3 },
    { name: 'C4 (1984-1996)', data: C4 },
    { name: 'C5 (1997-2004)', data: C5 },
    { name: 'C6 (2005-2013)', data: C6 },
    { name: 'C7 (2014-2019)', data: C7 },
    { name: 'C8 (2020-2026)', data: C8 },
  ];

  for (const gen of generations) {
    console.log(`\n${gen.name}:`);
    let genAdded = 0;

    for (const year of gen.data.years) {
      for (const trim of gen.data.trims) {
        // Year-specific trim availability
        if (trim.display_trim === 'Fuel Injection' && year < 1957) continue;
        if (trim.display_trim === 'Z06' && gen.name.includes('C2') && year < 1963) continue;
        if (trim.display_trim === '427' && year < 1966) continue;
        if (trim.display_trim === 'LT-1' && (year < 1970 || year > 1972)) continue;
        if (trim.display_trim === 'ZR-1' && gen.name.includes('C3') && (year < 1970 || year > 1972)) continue;
        if (trim.display_trim === 'L82' && (year < 1973 || year > 1980)) continue;
        if (trim.display_trim === 'Collector Edition' && year !== 1982) continue;
        if (trim.display_trim === 'ZR-1' && gen.name.includes('C4') && (year < 1990 || year > 1995)) continue;
        if (trim.display_trim === 'Grand Sport' && gen.name.includes('C4') && year !== 1996) continue;
        if (trim.display_trim === 'Z06' && gen.name.includes('C5') && year < 2001) continue;
        if (trim.display_trim === 'Grand Sport' && gen.name.includes('C6') && year < 2010) continue;
        if (trim.display_trim === 'ZR1' && gen.name.includes('C6') && (year < 2009 || year > 2013)) continue;
        if (trim.display_trim === 'ZR1' && gen.name.includes('C7') && year !== 2019) continue;
        if (trim.display_trim === 'Z06' && gen.name.includes('C8') && year < 2023) continue;
        if (trim.display_trim === 'E-Ray' && year < 2024) continue;
        if (trim.display_trim === 'ZR1' && gen.name.includes('C8') && year < 2025) continue;

        const key = `${year}|${trim.display_trim}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        const modId = genModId('chevrolet', 'corvette', trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (
            modification_id, year, make, model, display_trim, raw_trim,
            bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, 'chevrolet', 'corvette', $3, $4, $5, $6, 'generation_inherit', NOW(), NOW())
        `, [modId, year, trim.display_trim, trim.display_trim, gen.data.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);

        genAdded++;
        added++;
      }
    }
    console.log(`  Added ${genAdded} records`);
  }

  // Results
  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS');
  console.log('─'.repeat(60));
  console.log(`Added: ${added}`);
  console.log(`Skipped (existed): ${skipped}`);

  // Verify
  const verify = await pool.query(`
    SELECT COUNT(*) as total, COUNT(DISTINCT year) as years, COUNT(DISTINCT display_trim) as trims
    FROM vehicle_fitments WHERE make = 'chevrolet' AND model = 'corvette'
  `);
  const v = verify.rows[0];
  console.log(`\nCorvette coverage: ${v.total} records, ${v.years} years, ${v.trims} trims`);

  // Multi-trim check
  const multiTrim = await pool.query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT year FROM vehicle_fitments WHERE make = 'chevrolet' AND model = 'corvette'
      GROUP BY year HAVING COUNT(*) > 1
    ) sub
  `);
  const singleTrim = await pool.query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT year FROM vehicle_fitments WHERE make = 'chevrolet' AND model = 'corvette'
      GROUP BY year HAVING COUNT(*) = 1
    ) sub
  `);
  console.log(`Multi-trim years: ${multiTrim.rows[0].cnt}`);
  console.log(`Single-trim years: ${singleTrim.rows[0].cnt}`);

  // Samples
  const samples = [1963, 1982, 1995, 2006, 2019, 2024];
  for (const yr of samples) {
    const s = await pool.query(`
      SELECT display_trim FROM vehicle_fitments 
      WHERE make = 'chevrolet' AND model = 'corvette' AND year = $1
      ORDER BY display_trim
    `, [yr]);
    if (s.rows.length > 0) {
      console.log(`\n${yr}: ${s.rows.map(r => r.display_trim).join(', ')}`);
    }
  }

  await pool.end();
  console.log('\n\nDone!');
}

main().catch(console.error);
