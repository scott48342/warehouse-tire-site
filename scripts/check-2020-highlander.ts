import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const result = await pool.query(`
    SELECT year, display_trim, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' AND LOWER(model) LIKE '%highlander%'
      AND source = 'google-ai-overview'
      AND year >= 2020
    ORDER BY year, display_trim
    LIMIT 20
  `);
  
  console.log("2020+ Highlander records currently in DB:\n");
  for (const row of result.rows) {
    // oem_wheel_sizes is already parsed by pg driver
    const wheels = Array.isArray(row.oem_wheel_sizes) ? row.oem_wheel_sizes : [];
    const diam = wheels[0]?.diameter || "N/A";
    console.log(`${row.year} ${row.display_trim}: ${diam}"`);
  }
  
  await pool.end();
}

main();
