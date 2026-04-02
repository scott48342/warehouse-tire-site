/**
 * WRANGLER YJ (1987-1995)
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

const WRANGLER_YJ = {
  years: [1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995],
  bolt_pattern: '5x114.3',
  trims: [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'S', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Laredo', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Sahara', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Islander', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
    { display_trim: 'Renegade', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
  ],
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Adding Wrangler YJ (1987-1995)...\n');

  const existing = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = 'jeep' AND model = 'wrangler' AND year <= 1996
  `);
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));

  let added = 0;
  for (const year of WRANGLER_YJ.years) {
    for (const trim of WRANGLER_YJ.trims) {
      const key = `${year}|${trim.display_trim}`;
      if (existingSet.has(key)) continue;

      const modId = genModId('jeep', 'wrangler', trim.display_trim, year);
      await pool.query(`
        INSERT INTO vehicle_fitments (
          modification_id, year, make, model, display_trim, raw_trim,
          bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
        ) VALUES ($1, $2, 'jeep', 'wrangler', $3, $4, $5, $6, 'generation_inherit', NOW(), NOW())
      `, [modId, year, trim.display_trim, trim.display_trim, WRANGLER_YJ.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
      added++;
    }
  }

  console.log(`Added: ${added} records`);
  
  // Verify
  const verify = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = 'jeep' AND model = 'wrangler' AND year = 1994
    ORDER BY display_trim
  `);
  console.log('\n1994 Wrangler trims:');
  for (const r of verify.rows) console.log(`  ${r.display_trim}`);

  await pool.end();
}
main();
