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
  // Check vehicles where model contains hyphen (might be trim encoded in model)
  console.log('=== Models with hyphens (may be trims embedded in model) ===');
  const hyphen = await pool.query(`
    SELECT DISTINCT model, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE model LIKE '%-%'
    GROUP BY model
    ORDER BY model
    LIMIT 50
  `);
  for (const v of hyphen.rows) {
    console.log(`"${v.model}" (${v.cnt})`);
  }

  // Check vehicles with only "Base" trim (no real trim variants)
  console.log('\n=== Vehicles with ONLY Base trim (no variants) ===');
  const onlyBase = await pool.query(`
    SELECT year, make, model, COUNT(DISTINCT raw_trim) as trim_count
    FROM vehicle_fitments
    WHERE year >= 2020
    GROUP BY year, make, model
    HAVING COUNT(DISTINCT raw_trim) = 1 
      AND MAX(raw_trim) IN ('Base', '', NULL)
    ORDER BY year DESC, make, model
    LIMIT 40
  `);
  for (const v of onlyBase.rows) {
    console.log(`${v.year} ${v.make} ${v.model}`);
  }

  // Check Challenger trims
  console.log('\n=== Challenger trim coverage ===');
  const challenger = await pool.query(`
    SELECT DISTINCT year, raw_trim, display_trim
    FROM vehicle_fitments 
    WHERE model ILIKE '%challenger%' AND year >= 2019
    ORDER BY year DESC, raw_trim
  `);
  for (const v of challenger.rows) {
    console.log(`${v.year} | raw="${v.raw_trim || ''}" | display="${v.display_trim || ''}"`);
  }

  // Check Charger trims
  console.log('\n=== Charger trim coverage ===');
  const charger = await pool.query(`
    SELECT DISTINCT year, raw_trim, display_trim
    FROM vehicle_fitments 
    WHERE model ILIKE '%charger%' AND year >= 2019
    ORDER BY year DESC, raw_trim
  `);
  for (const v of charger.rows) {
    console.log(`${v.year} | raw="${v.raw_trim || ''}" | display="${v.display_trim || ''}"`);
  }

  await pool.end();
}

main().catch(console.error);
