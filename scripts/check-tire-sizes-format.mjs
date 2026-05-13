import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

const result = await pool.query(`
  SELECT id, year, make, model, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE oem_tire_sizes IS NOT NULL 
    AND jsonb_array_length(oem_tire_sizes) > 0
  LIMIT 10
`);

console.log('Sample oem_tire_sizes formats:');
for (const row of result.rows) {
  console.log(`\n${row.year} ${row.make} ${row.model}:`);
  console.log(`  Type: ${typeof row.oem_tire_sizes}`);
  console.log(`  Value: ${JSON.stringify(row.oem_tire_sizes)}`);
}

await pool.end();
