/**
 * CAMARO CLASSIC YEARS (1967-1992)
 * 
 * Gen 1: 1967-1969 (First F-body)
 *   - Base, SS, RS, Z/28
 *   - Bolt: 5x120.65 (5x4.75")
 * 
 * Gen 2: 1970-1981 (Second F-body)
 *   - Base, SS (until 1972), LT, Z28, Rally Sport
 *   - Bolt: 5x120.65
 * 
 * Gen 3: 1982-1992 (Third F-body)
 *   - Sport Coupe, Berlinetta, Z28, IROC-Z (1985-1990), RS
 *   - Bolt: 5x120.65
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

const BOLT_PATTERN = '5x120.65'; // Classic GM 5x4.75"

// Gen 1: 1967-1969
const GEN1 = {
  years: [1967, 1968, 1969],
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6.0 }] },
    { display_trim: 'RS', oem_wheel_sizes: [{ diameter: 14, width: 6.0 }] }, // Rally Sport
    { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 14, width: 7.0 }, { diameter: 15, width: 7.0 }] },
    { display_trim: 'SS 396', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }, // Big block
    { display_trim: 'Z/28', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }, // Trans-Am special
  ],
};

// Gen 2: 1970-1981
const GEN2_EARLY = {
  years: [1970, 1971, 1972, 1973],
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6.0 }] },
    { display_trim: 'RS', oem_wheel_sizes: [{ diameter: 14, width: 7.0 }] },
    { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }, // Discontinued after 1972
    { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 14, width: 7.0 }] }, // Luxury Touring
  ],
};

const GEN2_LATE = {
  years: [1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981],
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6.0 }] },
    { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 14, width: 7.0 }, { diameter: 15, width: 7.0 }] },
    { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] }, // Returned 1977
    { display_trim: 'Rally Sport', oem_wheel_sizes: [{ diameter: 14, width: 7.0 }] },
  ],
};

// Gen 3: 1982-1992 (IROC-Z era)
const GEN3_EARLY = {
  years: [1982, 1983, 1984],
  trims: [
    { display_trim: 'Sport Coupe', oem_wheel_sizes: [{ diameter: 14, width: 6.0 }] },
    { display_trim: 'Berlinetta', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }, { diameter: 16, width: 8.0 }] },
  ],
};

const GEN3_IROC = {
  years: [1985, 1986, 1987, 1988, 1989, 1990],
  trims: [
    { display_trim: 'Sport Coupe', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 16, width: 8.0 }] },
    { display_trim: 'IROC-Z', oem_wheel_sizes: [{ diameter: 16, width: 8.0 }] }, // THE iconic 80s trim
  ],
};

const GEN3_LATE = {
  years: [1991, 1992],
  trims: [
    { display_trim: 'RS', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 16, width: 8.0 }] },
    { display_trim: 'Z28 1LE', oem_wheel_sizes: [{ diameter: 16, width: 9.5 }] }, // Track package
  ],
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(70));
  console.log('CAMARO CLASSIC YEARS (1967-1992)');
  console.log('='.repeat(70));

  // Get existing
  const existing = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'camaro' AND year <= 1992
  `);
  
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  console.log(`Existing classic Camaro records: ${existing.rows.length}\n`);

  let added = 0, skipped = 0;

  const generations = [
    { name: 'Gen 1 (1967-1969)', data: GEN1 },
    { name: 'Gen 2 Early (1970-1973)', data: GEN2_EARLY },
    { name: 'Gen 2 Late (1974-1981)', data: GEN2_LATE },
    { name: 'Gen 3 Early (1982-1984)', data: GEN3_EARLY },
    { name: 'Gen 3 IROC (1985-1990)', data: GEN3_IROC },
    { name: 'Gen 3 Late (1991-1992)', data: GEN3_LATE },
  ];

  for (const gen of generations) {
    console.log(`\n${gen.name}:`);
    let genAdded = 0;

    for (const year of gen.data.years) {
      for (const trim of gen.data.trims) {
        // Skip SS after 1972 (discontinued)
        if (trim.display_trim === 'SS' && year > 1972 && year < 1996) continue;
        // Skip SS 396 after 1969
        if (trim.display_trim === 'SS 396' && year > 1969) continue;
        // Z28 was discontinued 1975-1976
        if (trim.display_trim === 'Z28' && (year === 1975 || year === 1976)) continue;
        // IROC-Z only 1985-1990
        if (trim.display_trim === 'IROC-Z' && (year < 1985 || year > 1990)) continue;

        const key = `${year}|${trim.display_trim}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        const modId = genModId('chevrolet', 'camaro', trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (
            modification_id, year, make, model, display_trim, raw_trim,
            bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, 'chevrolet', 'camaro', $3, $4, $5, $6, 'generation_inherit', NOW(), NOW())
        `, [modId, year, trim.display_trim, trim.display_trim, BOLT_PATTERN, JSON.stringify(trim.oem_wheel_sizes)]);

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

  // Verify final coverage
  const verify = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT year) as years,
      COUNT(DISTINCT display_trim) as trims,
      SUM(CASE WHEN year <= 1992 THEN 1 ELSE 0 END) as classic_records
    FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'camaro'
  `);
  const v = verify.rows[0];
  console.log(`\nTotal Camaro coverage: ${v.total} records, ${v.years} years, ${v.trims} trims`);
  console.log(`Classic (≤1992): ${v.classic_records} records`);

  // Multi-trim check
  const multiTrim = await pool.query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT year FROM vehicle_fitments
      WHERE make = 'chevrolet' AND model = 'camaro'
      GROUP BY year HAVING COUNT(*) > 1
    ) sub
  `);
  console.log(`Multi-trim years: ${multiTrim.rows[0].cnt}`);

  // Sample classic years
  console.log('\nSample: 1969 Camaro trims:');
  const sample = await pool.query(`
    SELECT display_trim FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'camaro' AND year = 1969
    ORDER BY display_trim
  `);
  for (const r of sample.rows) console.log(`  • ${r.display_trim}`);

  console.log('\nSample: 1987 Camaro trims:');
  const sample2 = await pool.query(`
    SELECT display_trim FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'camaro' AND year = 1987
    ORDER BY display_trim
  `);
  for (const r of sample2.rows) console.log(`  • ${r.display_trim}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
