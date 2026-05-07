import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 3,
    ssl: { rejectUnauthorized: false },
  });
  
  console.log('=== Gladiator Rubicon Data ===');
  const { rows } = await pool.query(`
    SELECT id, year, raw_trim, oem_tire_sizes, oem_wheel_sizes, quality_tier
    FROM vehicle_fitments
    WHERE make ILIKE 'jeep' 
      AND model ILIKE 'gladiator'
      AND raw_trim ILIKE '%rubicon%'
      AND year = 2024
    LIMIT 5
  `);
  
  console.log('Found:', rows.length, 'records');
  rows.forEach(r => {
    console.log(`\nID: ${r.id}`);
    console.log(`Year: ${r.year}, Trim: ${r.raw_trim}`);
    console.log(`Tier: ${r.quality_tier}`);
    console.log(`oem_tire_sizes type: ${typeof r.oem_tire_sizes}`);
    console.log(`oem_tire_sizes value:`, JSON.stringify(r.oem_tire_sizes));
    console.log(`oem_wheel_sizes type: ${typeof r.oem_wheel_sizes}`);
    console.log(`oem_wheel_sizes value:`, JSON.stringify(r.oem_wheel_sizes));
  });
  
  await pool.end();
}

main().catch(console.error);
