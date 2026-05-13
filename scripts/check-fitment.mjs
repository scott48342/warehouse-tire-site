import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const connString = process.env.POSTGRES_URL;
if (!connString) {
  console.error("No POSTGRES_URL found");
  process.exit(1);
}

console.log("Connecting to:", connString.substring(0, 50) + "...");

const pool = new Pool({
  connectionString: connString,
  ssl: true,
});

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT display_trim, oem_tire_sizes 
      FROM vehicle_fitments 
      WHERE year = 2024 
        AND LOWER(make) = 'ford' 
        AND LOWER(model) = 'f-150'
      LIMIT 3
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main();
