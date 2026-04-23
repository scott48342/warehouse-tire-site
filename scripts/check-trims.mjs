import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool } = pg;

const url = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url?.includes('neon') || url?.includes('prisma') ? { rejectUnauthorized: false } : undefined
});

async function main() {
  // Count total fitments
  const count = await pool.query(`SELECT COUNT(*) FROM vehicle_fitments`);
  console.log(`Total fitments: ${count.rows[0].count}`);

  // Check how trims are stored - sample Mustang
  console.log('\n=== Sample trim data (Mustang 2020+) ===');
  const mustang = await pool.query(`
    SELECT DISTINCT year, make, model, raw_trim, display_trim, submodel
    FROM vehicle_fitments 
    WHERE model ILIKE '%mustang%' AND year >= 2020
    ORDER BY year DESC, raw_trim
    LIMIT 30
  `);
  for (const v of mustang.rows) {
    console.log(`${v.year} ${v.make} ${v.model} | raw="${v.raw_trim || ''}" | display="${v.display_trim || ''}" | submodel="${v.submodel || ''}"`);
  }

  // Check Camaro trims
  console.log('\n=== Sample trim data (Camaro 2019+) ===');
  const camaro = await pool.query(`
    SELECT DISTINCT year, make, model, raw_trim, display_trim, submodel
    FROM vehicle_fitments 
    WHERE model ILIKE '%camaro%' AND year >= 2019
    ORDER BY year DESC, raw_trim
    LIMIT 30
  `);
  for (const v of camaro.rows) {
    console.log(`${v.year} ${v.make} ${v.model} | raw="${v.raw_trim || ''}" | display="${v.display_trim || ''}" | submodel="${v.submodel || ''}"`);
  }

  // Check for missing display_trim where raw_trim exists
  console.log('\n=== Missing display_trim (has raw_trim) ===');
  const missing = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE raw_trim IS NOT NULL AND raw_trim != '' 
      AND (display_trim IS NULL OR display_trim = '')
  `);
  console.log(`Fitments with raw_trim but no display_trim: ${missing.rows[0].cnt}`);

  // Check raw_trim patterns
  console.log('\n=== Sample raw_trim values ===');
  const samples = await pool.query(`
    SELECT DISTINCT raw_trim, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE raw_trim IS NOT NULL AND raw_trim != ''
    GROUP BY raw_trim
    ORDER BY cnt DESC
    LIMIT 30
  `);
  for (const v of samples.rows) {
    console.log(`"${v.raw_trim}" (${v.cnt})`);
  }

  await pool.end();
}

main().catch(console.error);
