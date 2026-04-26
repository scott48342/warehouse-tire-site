import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function debug() {
  // Get samples of remaining bad records
  const samples = await pool.query(`
    SELECT DISTINCT make, model, ROUND((oem_wheel_sizes::jsonb->0->>'diameter')::numeric)::int as wheel_diam
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (submodel IS NULL OR submodel = '' OR LOWER(submodel) = 'base')
    ORDER BY make, model
    LIMIT 50
  `);
  
  console.log('Remaining unmatched make/model/diameter combos:\n');
  for (const r of samples.rows) {
    console.log(`  ${r.make} | ${r.model} | ${r.wheel_diam}"`);
  }
  
  await pool.end();
}
debug();
