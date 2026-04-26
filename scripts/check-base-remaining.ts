import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Records that still have 'Base' as submodel - are they from our mapping?
  const result = await pool.query(`
    SELECT make, model, submodel, 
           ROUND((oem_wheel_sizes::jsonb->0->>'diameter')::numeric)::int as wheel_diam,
           COUNT(*) as c 
    FROM vehicle_fitments 
    WHERE year >= 2000 AND LOWER(submodel) = 'base'
    GROUP BY make, model, submodel, wheel_diam
    ORDER BY c DESC
    LIMIT 30
  `);
  
  console.log('Records with submodel = "Base":');
  for (const r of result.rows) {
    console.log(`  ${r.make} ${r.model} (${r.wheel_diam}"): ${r.c} records`);
  }
  
  await pool.end();
}
check();
